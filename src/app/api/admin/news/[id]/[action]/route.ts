import { z } from "zod";
import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { News } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { transition, type NewsAction, type NewsStatus } from "@/lib/news-state";
import { objectId } from "@/lib/crud";
import { revalidate } from "@/lib/settings";

const ACTIONS: Record<string, NewsAction> = {
  "submit-review": "submit_review",
  withdraw: "withdraw",
  "request-revision": "request_revision",
  approve: "approve",
  publish: "publish",
  archive: "archive",
  restore: "restore",
};

const body = z
  .object({ publishedAt: z.coerce.date().optional(), previewed: z.boolean().optional(), note: z.string().max(300).optional() })
  .strict();

export const POST = route(async ({ req, ctx, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("news.write");
  const { id, action: slug } = await ctx.params;
  const action = ACTIONS[slug];
  if (!action) throw new ApiError("NOT_FOUND");
  const input = await readJson(req, body, 5_000);

  await connectDb();
  const current = await News.findById(objectId(id));
  if (!current) throw new ApiError("NOT_FOUND");
  const isOwner = String(current.authorId) === user.id;
  if (!isOwner && !can(user.role, "news.manage_others")) throw new ApiError("NOT_FOUND");

  const result = transition({ action, from: current.status as NewsStatus, role: user.role, isOwner });
  if (!result.ok) {
    throw result.reason === "forbidden"
      ? new ApiError("FORBIDDEN")
      : new ApiError("CONFLICT", "Transisi status tidak valid untuk keadaan saat ini.");
  }
  if ((action === "approve" || action === "publish") && current.contentMode === "html_raw" && !input.previewed) {
    throw new ApiError("VALIDATION_ERROR", "Pratinjau wajib sebelum menerbitkan berita HTML mentah.");
  }

  const now = new Date();
  const set: Record<string, unknown> = { status: result.to };
  if (action === "approve") {
    set.publishedAt = input.publishedAt ?? now;
    set.reviewedBy = user.id;
    set.reviewedAt = now;
  }
  if (action === "publish") {
    const keep = current.publishedAt && current.publishedAt <= now ? current.publishedAt : now;
    set.publishedAt = input.publishedAt && input.publishedAt <= now ? input.publishedAt : keep;
    set.publishedBy = user.id;
    set.publishedAtActual = now;
  }
  if (action === "request_revision") {
    set.reviewedBy = user.id;
    set.reviewedAt = now;
  }

  // Update atomik bersyarat: gagal bila status berubah di antara baca dan tulis.
  const updated = await News.findOneAndUpdate({ _id: current._id, status: current.status }, { $set: set }, { new: true });
  if (!updated) throw new ApiError("CONFLICT", "Status berubah oleh pengguna lain. Muat ulang.");

  await audit({
    actorId: user.id,
    action: `news.${action}`,
    entity: "news",
    entityId: String(updated._id),
    summary: `${current.status} -> ${updated.status}${input.note ? `: ${input.note}` : ""}`,
    ip: clientIp(req),
    requestId,
  });
  revalidate("news");
  return ok({ status: updated.status, publishedAt: updated.publishedAt }, requestId);
});

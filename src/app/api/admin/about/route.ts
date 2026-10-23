import { z } from "zod";
import { assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { About } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { revalidate } from "@/lib/settings";
import { sanitizeContent } from "@/lib/sanitize";
import { optionalHttpsUrl } from "@/lib/schemas";

const schema = z
  .object({
    title: z.string().min(1).max(160),
    body: z.string().max(500_000),
    bodyJson: z.unknown(),
    image: optionalHttpsUrl,
    imageAlt: z.string().max(200),
    stats: z.array(z.object({ value: z.string().max(30), label: z.string().max(80) }).strict()).max(8),
  })
  .partial()
  .strict();

export const GET = route(async ({ requestId }) => {
  await requireUser("content.manage");
  await connectDb();
  const doc = await About.findOneAndUpdate({ key: "singleton" }, { $setOnInsert: { key: "singleton" } }, { upsert: true, new: true }).lean();
  return ok(doc, requestId);
});

export const PUT = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("content.manage");
  const data = await readJson(req, schema, 1_000_000);
  if (typeof data.body === "string") data.body = sanitizeContent(data.body);
  await connectDb();
  const doc = await About.findOneAndUpdate({ key: "singleton" }, { $set: data }, { upsert: true, new: true }).lean();
  await audit({ actorId: user.id, action: "about.update", entity: "about", ip: clientIp(req), requestId });
  revalidate("about");
  return ok(doc, requestId);
});

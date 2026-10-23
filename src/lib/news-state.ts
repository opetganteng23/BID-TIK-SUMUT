import type { Role } from "@/lib/rbac";

export type NewsStatus = "draft" | "review" | "scheduled" | "published" | "archived";
export type NewsAction =
  | "submit_review"
  | "withdraw"
  | "request_revision"
  | "approve"
  | "publish"
  | "archive"
  | "restore";

type Rule = { from: NewsStatus[]; to: NewsStatus; adminOnly: boolean };

const RULES: Record<NewsAction, Rule> = {
  submit_review: { from: ["draft"], to: "review", adminOnly: false },
  withdraw: { from: ["review"], to: "draft", adminOnly: false },
  request_revision: { from: ["review"], to: "draft", adminOnly: true },
  approve: { from: ["review"], to: "scheduled", adminOnly: true },
  publish: { from: ["review", "scheduled", "draft"], to: "published", adminOnly: true },
  archive: { from: ["draft", "review", "scheduled", "published"], to: "archived", adminOnly: true },
  restore: { from: ["archived"], to: "draft", adminOnly: true },
};

export type TransitionResult = { ok: true; to: NewsStatus } | { ok: false; reason: "forbidden" | "invalid" };

/** Aturan transisi status berita (MTS Section 21.1). Selalu dipanggil di server. */
export function transition(opts: {
  action: NewsAction;
  from: NewsStatus;
  role: Role;
  isOwner: boolean;
}): TransitionResult {
  const rule = RULES[opts.action];
  if (!rule) return { ok: false, reason: "invalid" };
  const isAdmin = opts.role === "admin" || opts.role === "super_admin";
  if (rule.adminOnly && !isAdmin) return { ok: false, reason: "forbidden" };
  if (!isAdmin && !opts.isOwner) return { ok: false, reason: "forbidden" };
  if (!rule.from.includes(opts.from)) return { ok: false, reason: "invalid" };
  return { ok: true, to: rule.to };
}

/** Kondisi tampil publik; dievaluasi saat query tanpa cron (MTS Section 6.5). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function publicNewsFilter(now = new Date()): Record<string, any> {
  return {
    $or: [
      { status: "published", publishedAt: { $lte: now } },
      { status: "scheduled", publishedAt: { $lte: now } },
    ],
  };
}

export function isPubliclyVisible(n: { status: NewsStatus; publishedAt?: Date | null }, now = new Date()) {
  return (n.status === "published" || n.status === "scheduled") && !!n.publishedAt && n.publishedAt <= now;
}

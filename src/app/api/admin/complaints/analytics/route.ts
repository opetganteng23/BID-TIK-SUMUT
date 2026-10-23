import { ok, parseQuery, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { analyticsQuery, loadAnalytics } from "@/lib/complaint-analytics";

/** Analitik agregat pengaduan (tanpa data pribadi). Semua admin yang dapat melihat pengaduan boleh membuka. */
export const GET = route(async ({ req, requestId }) => {
  await requireUser("complaints.view");
  const q = parseQuery(req, analyticsQuery);
  return ok(await loadAnalytics(q), requestId, 200, { "cache-control": "private, no-store" });
});

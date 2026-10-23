import { clientIp, parseQuery, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { analyticsQuery, loadAnalytics } from "@/lib/complaint-analytics";
import { reportLabels } from "@/lib/complaint-report-meta";
import { buildComplaintDeck } from "@/lib/complaint-report-pptx";

export const maxDuration = 60;

/** Ringkasan eksekutif PPTX (agregat saja). Hanya yang berizin ekspor; tercatat di audit. */
export const GET = route(async ({ req, requestId }) => {
  const user = await requireUser("complaints.export");
  const q = parseQuery(req, analyticsQuery);
  const now = new Date();
  const [analytics, labels] = await Promise.all([loadAnalytics(q, now), reportLabels(q, now)]);
  const buf = await buildComplaintDeck(analytics, { periodLabel: labels.periodLabel, filterLabel: labels.filterLabel, exportedAt: now });
  await audit({ actorId: user.id, action: "complaint.report_pptx", entity: "complaint", summary: JSON.stringify({ period: labels.periodLabel, filters: analytics.filters, total: analytics.kpi.total }), ip: clientIp(req), requestId });
  const name = `ringkasan-eksekutif-pengaduan-${now.toISOString().slice(0, 10)}.pptx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});

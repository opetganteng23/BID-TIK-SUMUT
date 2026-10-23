import { clientIp, parseQuery, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { analyticsQuery, loadAnalytics, loadReportRows } from "@/lib/complaint-analytics";
import { reportLabels } from "@/lib/complaint-report-meta";
import { buildComplaintWorkbook } from "@/lib/complaint-report-xlsx";

export const maxDuration = 60;

/** Laporan Excel multi-lembar. Hanya yang berizin ekspor; tanpa identitas pelapor; tercatat di audit. */
export const GET = route(async ({ req, requestId }) => {
  const user = await requireUser("complaints.export");
  const q = parseQuery(req, analyticsQuery);
  const now = new Date();
  const [analytics, rows, labels] = await Promise.all([loadAnalytics(q, now), loadReportRows(q, now), reportLabels(q, now)]);
  const buf = await buildComplaintWorkbook(analytics, rows, { periodLabel: labels.periodLabel, filterLabel: labels.filterLabel || "Tanpa filter", exportedAt: now, exportedBy: user.name });
  await audit({ actorId: user.id, action: "complaint.report_xlsx", entity: "complaint", summary: JSON.stringify({ period: labels.periodLabel, filters: analytics.filters, rows: rows.length }), ip: clientIp(req), requestId });
  const name = `analitik-pengaduan-${now.toISOString().slice(0, 10)}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});

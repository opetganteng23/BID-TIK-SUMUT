import { REGION_BY_SLUG } from "@/lib/regions";
import { STATUS_LABEL, type ComplaintStatus } from "@/lib/complaint-state";
import { ComplaintCategory } from "@/lib/models";
import type { AnalyticsQuery } from "@/lib/complaint-analytics";
import { effectivePeriod } from "@/lib/complaint-analytics";
import { connectDb } from "@/lib/db";

const d = (x: Date) => x.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** Label periode dan filter yang dicetak pada laporan. */
export async function reportLabels(q: AnalyticsQuery, now = new Date()) {
  const { from, to } = await effectivePeriod(q, now);
  await connectDb();
  const parts: string[] = [];
  if (q.categoryId) parts.push(`Kategori: ${(await ComplaintCategory.findById(q.categoryId, "name").lean())?.name ?? "-"}`);
  if (q.region) parts.push(`Wilayah: ${REGION_BY_SLUG[q.region]?.name ?? q.region}`);
  if (q.status) parts.push(`Status: ${STATUS_LABEL[q.status as ComplaintStatus]}`);
  return { periodLabel: `${d(from)} sampai ${d(to)}`, filterLabel: parts.join(" · "), stamp: now };
}

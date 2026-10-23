import { z } from "zod";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Complaint, ComplaintCategory, User } from "@/lib/models";
import { computeAnalytics, type AnalyticsRow } from "@/lib/complaint-analytics-core";
import { objectIdString } from "@/lib/schemas";

const DAY = 24 * 3_600_000;
const MAX_ROWS = 50_000;

export const analyticsQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  categoryId: objectIdString.optional(),
  region: z.string().regex(/^[a-z-]{2,40}$/).optional(),
  status: z.enum(["submitted", "in_progress", "waiting_reporter", "awaiting_reporter_confirmation", "closed"]).optional(),
});
export type AnalyticsQuery = z.infer<typeof analyticsQuery>;

export function resolvePeriod(q: AnalyticsQuery, now = new Date()) {
  const to = q.to ?? now;
  const from = q.from ?? new Date(to.getTime() - 30 * DAY);
  return { from: from > to ? new Date(to.getTime() - DAY) : from, to };
}

// Permintaan "semua waktu" memakai batas awal sebelum tanggal ini; periodenya dijepit ke pengaduan pertama
// agar grafik dan rata-rata per hari tidak terdistorsi oleh bertahun-tahun tanpa data.
const ALL_TIME_BEFORE = new Date("2021-01-01T00:00:00Z");

function baseFilter(q: AnalyticsQuery) {
  const base: Record<string, unknown> = {};
  if (q.categoryId) base.categoryId = new Types.ObjectId(q.categoryId);
  if (q.region) base.region = q.region;
  if (q.status) base.status = q.status;
  return base;
}

export async function effectivePeriod(q: AnalyticsQuery, now = new Date()) {
  const p = resolvePeriod(q, now);
  if (p.from >= ALL_TIME_BEFORE) return { ...p, allTime: false };
  await connectDb();
  const first = await Complaint.findOne(baseFilter(q), "createdAt").sort({ createdAt: 1 }).lean();
  const from = first ? new Date(Math.floor(first.createdAt.getTime() / DAY) * DAY) : new Date(p.to.getTime() - 30 * DAY);
  return { from, to: p.to, allTime: true };
}

/** Memuat pengaduan sesuai filter lalu menghitung analitik. Hanya agregat, tanpa data pribadi pelapor. */
export async function loadAnalytics(q: AnalyticsQuery, now = new Date()) {
  await connectDb();
  const { from, to, allTime } = await effectivePeriod(q, now);
  const base = baseFilter(q);

  const spanMs = to.getTime() - from.getTime();
  const [docs, previousTotal, categories] = await Promise.all([
    Complaint.find(
      { ...base, createdAt: { $gte: from, $lte: to } },
      "createdAt status categoryId region claimedBy claimedAt awaitingConfirmationAt confirmationDeadlineAt closedAt closureReason",
    )
      .sort({ createdAt: 1 })
      .limit(MAX_ROWS)
      .lean(),
    allTime ? Promise.resolve(undefined) : Complaint.countDocuments({ ...base, createdAt: { $gte: new Date(from.getTime() - spanMs), $lt: from } }),
    ComplaintCategory.find({}, "name").sort({ order: 1 }).lean(),
  ]);

  const officerIds = [...new Set(docs.map((d) => (d.claimedBy ? String(d.claimedBy) : "")).filter(Boolean))];
  const officers = officerIds.length ? await User.find({ _id: { $in: officerIds } }, "name").lean() : [];

  const rows: AnalyticsRow[] = docs.map((d) => ({
    createdAt: d.createdAt,
    status: d.status as AnalyticsRow["status"],
    categoryId: String(d.categoryId),
    region: d.region ?? null,
    claimedBy: d.claimedBy ? String(d.claimedBy) : null,
    claimedAt: d.claimedAt ?? null,
    awaitingConfirmationAt: d.awaitingConfirmationAt ?? null,
    confirmationDeadlineAt: d.confirmationDeadlineAt ?? null,
    closedAt: d.closedAt ?? null,
    closureReason: (d.closureReason as AnalyticsRow["closureReason"]) ?? null,
  }));

  const analytics = computeAnalytics({
    rows,
    from,
    to,
    now,
    previousTotal,
    categories: categories.map((c) => ({ id: String(c._id), name: c.name })),
    officers: Object.fromEntries(officers.map((o) => [String(o._id), o.name])),
  });
  return { ...analytics, truncated: docs.length >= MAX_ROWS, filters: { categoryId: q.categoryId ?? null, region: q.region ?? null, status: q.status ?? null } };
}

/** Baris data pengaduan untuk lembar "Data Pengaduan" pada laporan. TANPA data pribadi pelapor. */
export async function loadReportRows(q: AnalyticsQuery, now = new Date()) {
  await connectDb();
  const { from, to } = await effectivePeriod(q, now);
  const base: Record<string, unknown> = { ...baseFilter(q), createdAt: { $gte: from, $lte: to } };
  const [docs, categories] = await Promise.all([
    Complaint.find(base, "ticketNumber createdAt status categoryId region claimedBy claimedAt closedAt closureReason").sort({ createdAt: 1 }).limit(20_000).populate("claimedBy", "name").lean(),
    ComplaintCategory.find({}, "name").lean(),
  ]);
  const cat = new Map(categories.map((c) => [String(c._id), c.name]));
  return docs.map((d) => ({
    ticketNumber: d.ticketNumber,
    createdAt: d.createdAt,
    category: cat.get(String(d.categoryId)) ?? "-",
    region: d.region ?? null,
    status: d.status,
    officer: (d.claimedBy as unknown as { name?: string } | null)?.name ?? null,
    claimedAt: d.claimedAt ?? null,
    closedAt: d.closedAt ?? null,
    closureReason: d.closureReason ?? null,
  }));
}

import { REGIONS, REGION_BY_SLUG } from "@/lib/regions";
import { STATUS_LABEL, type ComplaintStatus } from "@/lib/complaint-state";

// Murni (tanpa akses database) agar mudah diuji. Semua waktu dihitung dalam Asia/Jakarta (UTC+7, tanpa DST).

export type AnalyticsRow = {
  createdAt: Date;
  status: ComplaintStatus;
  categoryId: string;
  region?: string | null;
  claimedBy?: string | null;
  claimedAt?: Date | null;
  awaitingConfirmationAt?: Date | null;
  confirmationDeadlineAt?: Date | null;
  closedAt?: Date | null;
  closureReason?: "reporter_confirmed" | "auto_closed_no_reporter_response" | null;
};

export type AnalyticsInput = {
  rows: AnalyticsRow[];
  from: Date;
  to: Date;
  now?: Date;
  categories: { id: string; name: string }[];
  officers: Record<string, string>;
  previousTotal?: number;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WIB = 7 * HOUR;
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const wibDate = (d: Date) => new Date(d.getTime() + WIB).toISOString().slice(0, 10);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (n: number | null, d = 1) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);

export const fmtNum = (n: number, d = 0) => n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtPct = (a: number, b: number) => `${fmtNum(b ? (a / b) * 100 : 0, 1)}%`;
/** Durasi ramah baca: "45 menit", "5,2 jam", "3,4 hari". */
export function fmtDuration(hours: number | null): string {
  if (hours === null) return "-";
  if (hours < 1) return `${fmtNum(Math.max(1, Math.round(hours * 60)))} menit`;
  if (hours < 48) return `${fmtNum(hours, 1)} jam`;
  return `${fmtNum(hours / 24, 1)} hari`;
}

export type Analytics = ReturnType<typeof computeAnalytics>;

export function computeAnalytics(input: AnalyticsInput) {
  const { rows, from, to, categories, officers } = input;
  const now = input.now ?? new Date();
  const total = rows.length;
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const catIndex = new Map(categories.map((c, i) => [c.id, i]));

  const closed = rows.filter((r) => r.status === "closed");
  const open = rows.filter((r) => r.status !== "closed");
  const firstResp = rows.filter((r) => r.claimedAt).map((r) => (r.claimedAt!.getTime() - r.createdAt.getTime()) / HOUR);
  const resolution = closed.filter((r) => r.closedAt).map((r) => (r.closedAt!.getTime() - r.createdAt.getTime()) / HOUR);
  const confirmed = closed.filter((r) => r.closureReason === "reporter_confirmed").length;
  const autoClosed = closed.filter((r) => r.closureReason === "auto_closed_no_reporter_response").length;
  const unclaimed = rows.filter((r) => r.status === "submitted").length;
  const overdue = rows.filter((r) => r.status === "awaiting_reporter_confirmation" && r.confirmationDeadlineAt && r.confirmationDeadlineAt < now).length;

  const prev = input.previousTotal;
  const changePct = prev === undefined ? null : prev === 0 ? (total ? 100 : 0) : ((total - prev) / prev) * 100;

  const kpi = {
    total,
    open: open.length,
    closed: closed.length,
    closedPct: total ? (closed.length / total) * 100 : 0,
    unclaimed,
    overdueConfirmation: overdue,
    avgFirstResponseHrs: round(mean(firstResp)),
    medianFirstResponseHrs: round(median(firstResp)),
    avgResolutionHrs: round(mean(resolution)),
    medianResolutionHrs: round(median(resolution)),
    reporterConfirmedPct: closed.length ? (confirmed / closed.length) * 100 : 0,
    autoClosedPct: closed.length ? (autoClosed / closed.length) * 100 : 0,
    previousTotal: prev ?? null,
    changePct: changePct === null ? null : round(changePct, 1),
  };

  const statuses = Object.keys(STATUS_LABEL) as ComplaintStatus[];
  const byStatus = statuses.map((s) => ({ key: s, label: STATUS_LABEL[s], count: rows.filter((r) => r.status === s).length }));

  const byCategory = categories
    .map((c, i) => {
      const rs = rows.filter((r) => r.categoryId === c.id);
      const res = rs.filter((r) => r.status === "closed" && r.closedAt).map((r) => (r.closedAt!.getTime() - r.createdAt.getTime()) / HOUR);
      return { id: c.id, name: c.name, color: i, count: rs.length, pct: total ? (rs.length / total) * 100 : 0, open: rs.filter((r) => r.status !== "closed").length, avgResolutionHrs: round(mean(res)) };
    })
    .sort((a, b) => b.count - a.count);

  // Wilayah: titik peta untuk wilayah yang punya data, ditambah ember "tidak diketahui" (pengaduan lama tanpa wilayah).
  const regionRows = new Map<string, AnalyticsRow[]>();
  for (const r of rows) {
    if (!r.region || !REGION_BY_SLUG[r.region]) continue;
    regionRows.set(r.region, [...(regionRows.get(r.region) ?? []), r]);
  }
  const unknownRegion = rows.filter((r) => !r.region || !REGION_BY_SLUG[r.region]).length;
  const byRegion = REGIONS.filter((g) => regionRows.has(g.slug))
    .map((g) => {
      const rs = regionRows.get(g.slug)!;
      const per: Record<string, number> = {};
      for (const r of rs) per[r.categoryId] = (per[r.categoryId] ?? 0) + 1;
      const topId = Object.entries(per).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      return {
        slug: g.slug,
        name: g.name,
        lat: g.lat,
        lng: g.lng,
        count: rs.length,
        pct: total ? (rs.length / total) * 100 : 0,
        open: rs.filter((r) => r.status !== "closed").length,
        topCategoryId: topId,
        topCategoryName: catName.get(topId) ?? "-",
        topCategoryColor: catIndex.get(topId) ?? 0,
        byCategory: per,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Tren: harian, atau mingguan bila periode panjang agar grafik tetap terbaca.
  const spanDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY));
  const weekly = spanDays > 92;
  const buckets = new Map<string, { created: number; closed: number }>();
  const key = (d: Date) => {
    const k = wibDate(d);
    if (!weekly) return k;
    const dt = new Date(`${k}T00:00:00Z`);
    const dow = (dt.getUTCDay() + 6) % 7; // Senin = 0
    return new Date(dt.getTime() - dow * DAY).toISOString().slice(0, 10);
  };
  for (let t = from.getTime(); t <= to.getTime(); t += weekly ? 7 * DAY : DAY) {
    const k = key(new Date(t));
    if (!buckets.has(k)) buckets.set(k, { created: 0, closed: 0 });
  }
  // Ujung periode (to) selalu masuk ember terakhir.
  if (!buckets.has(key(to))) buckets.set(key(to), { created: 0, closed: 0 });
  for (const r of rows) {
    const b = buckets.get(key(r.createdAt));
    if (b) b.created++;
    if (r.closedAt) {
      const c = buckets.get(key(r.closedAt));
      if (c) c.closed++;
    }
  }
  const trend = [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, v]) => ({ date, ...v }));

  const weekday = HARI.map((name, i) => ({ name, count: rows.filter((r) => new Date(r.createdAt.getTime() + WIB).getUTCDay() === i).length }));
  const hour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: rows.filter((r) => new Date(r.createdAt.getTime() + WIB).getUTCHours() === h).length }));

  const officerMap = new Map<string, AnalyticsRow[]>();
  for (const r of rows) if (r.claimedBy) officerMap.set(r.claimedBy, [...(officerMap.get(r.claimedBy) ?? []), r]);
  const byOfficer = [...officerMap.entries()]
    .map(([id, rs]) => ({
      id,
      name: officers[id] ?? "Petugas",
      handled: rs.length,
      closed: rs.filter((r) => r.status === "closed").length,
      open: rs.filter((r) => r.status !== "closed").length,
      avgFirstResponseHrs: round(mean(rs.filter((r) => r.claimedAt).map((r) => (r.claimedAt!.getTime() - r.createdAt.getTime()) / HOUR))),
      avgResolutionHrs: round(mean(rs.filter((r) => r.status === "closed" && r.closedAt).map((r) => (r.closedAt!.getTime() - r.createdAt.getTime()) / HOUR))),
    }))
    .sort((a, b) => b.handled - a.handled);

  const ageHrs = (r: AnalyticsRow) => (now.getTime() - r.createdAt.getTime()) / HOUR;
  const aging = [
    { label: "Kurang dari 1 hari", count: open.filter((r) => ageHrs(r) < 24).length },
    { label: "1 sampai 3 hari", count: open.filter((r) => ageHrs(r) >= 24 && ageHrs(r) < 96).length },
    { label: "4 sampai 7 hari", count: open.filter((r) => ageHrs(r) >= 96 && ageHrs(r) < 192).length },
    { label: "Lebih dari 7 hari", count: open.filter((r) => ageHrs(r) >= 192).length },
  ];

  const topRegions = byRegion.slice(0, 8);
  const matrix = {
    categories: byCategory.map((c) => ({ id: c.id, name: c.name, color: c.color })),
    rows: topRegions.map((g) => ({ slug: g.slug, name: g.name, counts: byCategory.map((c) => g.byCategory[c.id] ?? 0) })),
  };

  // ---- Temuan dan rekomendasi (aturan sederhana, tertelusur ke angka di atas) ----
  const insights: string[] = [];
  const fmtDay = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const periodText = `${fmtDay(from)} sampai ${fmtDay(to)}`;
  if (!total) {
    insights.push(`Tidak ada pengaduan pada periode ${periodText}.`);
  } else {
    let t = `Terdapat ${fmtNum(total)} pengaduan pada periode ${periodText}`;
    if (kpi.changePct !== null && (kpi.previousTotal ?? 0) > 0) t += `, ${kpi.changePct >= 0 ? "naik" : "turun"} ${fmtNum(Math.abs(kpi.changePct), 1)}% dibanding periode sebelumnya (${fmtNum(kpi.previousTotal ?? 0)})`;
    insights.push(`${t}.`);
    const tc = byCategory[0];
    if (tc && tc.count) insights.push(`Kategori terbanyak adalah ${tc.name} (${fmtNum(tc.count)} pengaduan, ${fmtNum(tc.pct, 1)}%).`);
    const tr = byRegion[0];
    if (tr) {
      const top3 = byRegion.slice(0, 3).reduce((a, g) => a + g.count, 0);
      insights.push(`Wilayah dengan pengaduan terbanyak adalah ${tr.name} (${fmtNum(tr.count)}, ${fmtNum(tr.pct, 1)}%); tiga wilayah teratas menyumbang ${fmtPct(top3, total)} dari seluruh pengaduan.`);
    }
    if (unknownRegion) insights.push(`${fmtNum(unknownRegion)} pengaduan (${fmtPct(unknownRegion, total)}) belum memiliki data wilayah.`);
    if (kpi.avgFirstResponseHrs !== null) insights.push(`Rata-rata waktu respons pertama (sampai tiket diklaim petugas) ${fmtDuration(kpi.avgFirstResponseHrs)}, median ${fmtDuration(kpi.medianFirstResponseHrs)}.`);
    if (kpi.avgResolutionHrs !== null) insights.push(`Rata-rata waktu penyelesaian ${fmtDuration(kpi.avgResolutionHrs)}; ${fmtNum(kpi.closed)} tiket (${fmtPct(kpi.closed, total)}) sudah ditutup.`);
    if (kpi.unclaimed || kpi.overdueConfirmation) insights.push(`${fmtNum(kpi.unclaimed)} tiket belum diambil petugas dan ${fmtNum(kpi.overdueConfirmation)} tiket menunggu konfirmasi pelapor melewati tenggat.`);
    const peakDay = [...weekday].sort((a, b) => b.count - a.count)[0];
    const peakHour = [...hour].sort((a, b) => b.count - a.count)[0];
    if (peakDay.count) insights.push(`Pengaduan paling banyak masuk pada hari ${peakDay.name} dan sekitar pukul ${String(peakHour.hour).padStart(2, "0")}.00 WIB.`);
  }

  const recommendations: string[] = [];
  if (total) {
    if (byCategory[0] && byCategory[0].pct >= 40) recommendations.push(`Prioritaskan penanganan kategori ${byCategory[0].name} karena menyumbang ${fmtNum(byCategory[0].pct, 1)}% pengaduan.`);
    if (kpi.avgFirstResponseHrs !== null && kpi.avgFirstResponseHrs > 24) recommendations.push("Percepat respons pertama (di atas 24 jam): tambahkan petugas piket atau atur rotasi klaim tiket harian.");
    if (kpi.unclaimed > 0) recommendations.push(`Segera ambil ${fmtNum(kpi.unclaimed)} tiket yang belum diklaim agar tidak menumpuk.`);
    if (kpi.autoClosedPct >= 30) recommendations.push("Banyak tiket ditutup otomatis tanpa respons pelapor; pastikan petugas menjelaskan hasil penanganan dengan jelas di percakapan tiket.");
    if (unknownRegion / total >= 0.2) recommendations.push("Wajibkan pengisian wilayah pada setiap pengaduan agar pemetaan lebih akurat.");
    if (aging[3].count > 0) recommendations.push(`Tinjau ${fmtNum(aging[3].count)} tiket terbuka yang berumur lebih dari 7 hari.`);
    if (byRegion[0] && byRegion[0].pct >= 35) recommendations.push(`Pertimbangkan penguatan layanan atau patroli informasi di ${byRegion[0].name}, wilayah dengan konsentrasi pengaduan tertinggi.`);
    if (!recommendations.length) recommendations.push("Pertahankan kinerja saat ini dan pantau tren secara berkala.");
  }

  return {
    period: { from: from.toISOString(), to: to.toISOString(), days: spanDays, granularity: weekly ? ("week" as const) : ("day" as const) },
    kpi,
    byStatus,
    byCategory,
    byRegion,
    unknownRegion,
    trend,
    weekday,
    hour,
    byOfficer,
    aging,
    matrix,
    insights,
    recommendations,
  };
}

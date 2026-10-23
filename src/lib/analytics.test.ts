import { describe, expect, it } from "vitest";
import { computeAnalytics, fmtDuration, type AnalyticsRow } from "@/lib/complaint-analytics-core";

const H = 3_600_000;
const base = new Date("2026-03-02T05:00:00Z"); // Senin, 12.00 WIB
const at = (hours: number) => new Date(base.getTime() + hours * H);
const cats = [
  { id: "c1", name: "Pelayanan" },
  { id: "c2", name: "Perilaku Petugas" },
];

const rows: AnalyticsRow[] = [
  // 1: ditutup, direspons 2 jam, selesai 10 jam, dikonfirmasi pelapor
  { createdAt: at(0), status: "closed", categoryId: "c1", region: "medan", claimedBy: "u1", claimedAt: at(2), closedAt: at(10), closureReason: "reporter_confirmed" },
  // 2: ditutup otomatis, direspons 4 jam, selesai 28 jam
  { createdAt: at(1), status: "closed", categoryId: "c1", region: "medan", claimedBy: "u1", claimedAt: at(5), closedAt: at(29), closureReason: "auto_closed_no_reporter_response" },
  // 3: belum diambil, tanpa wilayah
  { createdAt: at(24), status: "submitted", categoryId: "c2", region: null },
  // 4: menunggu konfirmasi, tenggat sudah lewat
  { createdAt: at(30), status: "awaiting_reporter_confirmation", categoryId: "c2", region: "binjai", claimedBy: "u2", claimedAt: at(36), awaitingConfirmationAt: at(40), confirmationDeadlineAt: at(40 + 168) },
];

const run = (extra: Partial<Parameters<typeof computeAnalytics>[0]> = {}) =>
  computeAnalytics({ rows, from: at(-24), to: at(24 * 6), now: at(24 * 20), categories: cats, officers: { u1: "Petugas Satu", u2: "Petugas Dua" }, previousTotal: 2, ...extra });

describe("computeAnalytics", () => {
  const a = run();

  it("menghitung KPI utama", () => {
    expect(a.kpi.total).toBe(4);
    expect(a.kpi.closed).toBe(2);
    expect(a.kpi.open).toBe(2);
    expect(a.kpi.unclaimed).toBe(1);
    expect(a.kpi.overdueConfirmation).toBe(1);
    expect(a.kpi.avgFirstResponseHrs).toBe(4); // (2 + 4 + 6) / 3
    expect(a.kpi.medianFirstResponseHrs).toBe(4);
    expect(a.kpi.avgResolutionHrs).toBe(19); // (10 + 28) / 2
    expect(a.kpi.reporterConfirmedPct).toBe(50);
    expect(a.kpi.autoClosedPct).toBe(50);
    expect(a.kpi.changePct).toBe(100); // 4 vs 2
  });

  it("memecah per kategori dan menyusun urutan menurun", () => {
    expect(a.byCategory.map((c) => [c.name, c.count])).toEqual([["Pelayanan", 2], ["Perilaku Petugas", 2]]);
    const pel = a.byCategory.find((c) => c.name === "Pelayanan")!;
    expect(pel.avgResolutionHrs).toBe(19);
    expect(pel.pct).toBe(50);
  });

  it("memetakan wilayah dan memisahkan yang tidak diketahui", () => {
    expect(a.byRegion.map((r) => [r.slug, r.count])).toEqual([["medan", 2], ["binjai", 1]]);
    expect(a.unknownRegion).toBe(1);
    expect(a.byRegion[0].topCategoryName).toBe("Pelayanan");
    expect(a.byRegion[0].lat).toBeGreaterThan(3);
  });

  it("menghitung status, petugas, umur tunggakan, dan pola waktu (WIB)", () => {
    expect(Object.fromEntries(a.byStatus.map((s) => [s.key, s.count]))).toMatchObject({ submitted: 1, closed: 2, awaiting_reporter_confirmation: 1, in_progress: 0 });
    expect(a.byOfficer[0]).toMatchObject({ name: "Petugas Satu", handled: 2, closed: 2 });
    expect(a.aging.find((x) => x.label === "Lebih dari 7 hari")!.count).toBe(2); // 2 tiket terbuka, sekarang 20 hari kemudian
    expect(a.weekday.find((d) => d.name === "Senin")!.count).toBe(2);
    expect(a.hour.find((h) => h.hour === 12)!.count).toBe(2); // tiket 1 dan 3 masuk pukul 12.00 WIB
    expect(a.hour.find((h) => h.hour === 13)!.count).toBe(1);
    expect(a.hour.reduce((n, h) => n + h.count, 0)).toBe(4);
  });

  it("tren harian menjumlah ke total dan mencatat penutupan", () => {
    expect(a.period.granularity).toBe("day");
    expect(a.trend.reduce((n, t) => n + t.created, 0)).toBe(4);
    expect(a.trend.reduce((n, t) => n + t.closed, 0)).toBe(2);
    const dates = a.trend.map((t) => t.date);
    expect(dates).toEqual([...dates].sort());
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("memakai ember mingguan untuk periode panjang", () => {
    const w = run({ from: at(-24 * 200), to: at(24 * 6) });
    expect(w.period.granularity).toBe("week");
    expect(w.trend.reduce((n, t) => n + t.created, 0)).toBe(4);
    expect(w.trend.every((t) => new Date(`${t.date}T00:00:00Z`).getUTCDay() === 1)).toBe(true); // awal pekan = Senin
  });

  it("menyusun temuan dan rekomendasi yang menyebut angka", () => {
    expect(a.insights.join(" ")).toContain("4 pengaduan");
    expect(a.insights.join(" ")).toContain("naik 100,0%");
    expect(a.insights.join(" ")).toContain("Kota Medan");
    expect(a.recommendations.join(" ")).toMatch(/belum diklaim/);
  });

  it("tanpa pembanding bila periode sebelumnya kosong atau tidak diberikan", () => {
    const zero = run({ previousTotal: 0 });
    expect(zero.insights.join(" ")).not.toMatch(/dibanding periode sebelumnya/);
    const none = run({ previousTotal: undefined });
    expect(none.kpi.changePct).toBeNull();
    expect(none.insights.join(" ")).not.toMatch(/naik|turun/);
    expect(none.insights[0]).toMatch(/2 Maret 2026|1 Maret 2026/); // tanggal berbahasa Indonesia, bukan ISO
  });

  it("aman untuk data kosong", () => {
    const e = computeAnalytics({ rows: [], from: at(0), to: at(48), categories: cats, officers: {} });
    expect(e.kpi.total).toBe(0);
    expect(e.kpi.avgResolutionHrs).toBeNull();
    expect(e.byRegion).toEqual([]);
    expect(e.insights[0]).toMatch(/Tidak ada pengaduan/);
    expect(e.recommendations).toEqual([]);
  });

  it("memformat durasi", () => {
    expect(fmtDuration(null)).toBe("-");
    expect(fmtDuration(0.25)).toBe("15 menit");
    expect(fmtDuration(5.25)).toBe("5,3 jam");
    expect(fmtDuration(72)).toBe("3,0 hari");
  });
});

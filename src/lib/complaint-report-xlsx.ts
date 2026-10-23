import ExcelJS from "exceljs";
import { STATUS_LABEL, type ComplaintStatus } from "@/lib/complaint-state";
import { regionName } from "@/lib/regions";
import { safeCell } from "@/lib/xlsx-safe";
import type { Analytics } from "@/lib/complaint-analytics-core";

type ReportRow = Awaited<ReturnType<typeof import("@/lib/complaint-analytics").loadReportRows>>[number];

const HEAD_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111113" } } as const;
const wib = (d?: Date | null) => (d ? new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const hrs = (a?: Date | null, b?: Date | null) => (a && b ? Math.round(((new Date(b).getTime() - new Date(a).getTime()) / 3_600_000) * 10) / 10 : null);
const CLOSURE: Record<string, string> = { reporter_confirmed: "Dikonfirmasi pelapor", auto_closed_no_reporter_response: "Ditutup otomatis (tanpa respons 7 hari)" };

function sheet(wb: ExcelJS.Workbook, name: string, columns: { header: string; width: number; fmt?: string }[], rows: unknown[][]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width, style: c.fmt ? { numFmt: c.fmt } : undefined }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = HEAD_FILL;
  head.alignment = { vertical: "middle", wrapText: true };
  head.height = 22;
  for (const r of rows) ws.addRow(r.map((v) => safeCell(v)));
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

/** Laporan Excel multi-lembar: Ringkasan, Data Pengaduan, dan rekap per dimensi. Semua teks dilindungi dari formula injection. */
export async function buildComplaintWorkbook(a: Analytics, rows: ReportRow[], meta: { periodLabel: string; filterLabel: string; exportedAt: Date; exportedBy: string }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Website BID TIK Polda Sumut";
  wb.created = meta.exportedAt;
  const k = a.kpi;
  const pct = (n: number) => Math.round(n * 10) / 1000; // 0-100 -> pecahan untuk format persen

  // 1. Ringkasan (Item / Nilai)
  const summary: [string, unknown][] = [
    ["Laporan", "Analitik Pengaduan Masyarakat"],
    ["Satuan kerja", "Bid TIK Polda Sumatera Utara"],
    ["Periode", meta.periodLabel],
    ["Filter", meta.filterLabel],
    ["Diekspor", `${wib(meta.exportedAt)} WIB oleh ${meta.exportedBy}`],
    ["Total pengaduan", k.total],
    ["Perubahan vs periode sebelumnya (%)", k.changePct === null ? "-" : k.changePct],
    ["Masih terbuka", k.open],
    ["Sudah ditutup", k.closed],
    ["Persentase ditutup", pct(k.closedPct)],
    ["Belum diambil petugas", k.unclaimed],
    ["Menunggu konfirmasi, lewat tenggat", k.overdueConfirmation],
    ["Rata-rata respons pertama (jam)", k.avgFirstResponseHrs ?? "-"],
    ["Median respons pertama (jam)", k.medianFirstResponseHrs ?? "-"],
    ["Rata-rata waktu penyelesaian (jam)", k.avgResolutionHrs ?? "-"],
    ["Median waktu penyelesaian (jam)", k.medianResolutionHrs ?? "-"],
    ["Ditutup karena dikonfirmasi pelapor", pct(k.reporterConfirmedPct)],
    ["Ditutup otomatis tanpa respons pelapor", pct(k.autoClosedPct)],
    ["Pengaduan tanpa data wilayah", a.unknownRegion],
  ];
  const ws = sheet(wb, "Ringkasan", [{ header: "Item", width: 44 }, { header: "Nilai", width: 60 }], summary);
  const PCT_LABELS = new Set(["Persentase ditutup", "Ditutup karena dikonfirmasi pelapor", "Ditutup otomatis tanpa respons pelapor"]);
  for (let i = 0; i < summary.length; i++) if (PCT_LABELS.has(summary[i][0])) ws.getCell(`B${i + 2}`).numFmt = "0.0%";
  ws.addRow([]);
  const h1 = ws.addRow(["Temuan utama", ""]);
  h1.font = { bold: true };
  for (const t of a.insights) ws.addRow([safeCell(t), ""]).getCell(1).alignment = { wrapText: true, vertical: "top" };
  ws.addRow([]);
  const h2 = ws.addRow(["Rekomendasi", ""]);
  h2.font = { bold: true };
  for (const t of a.recommendations) ws.addRow([safeCell(t), ""]).getCell(1).alignment = { wrapText: true, vertical: "top" };

  // 2. Data pengaduan (tanpa identitas pelapor)
  sheet(
    wb,
    "Data Pengaduan",
    [
      { header: "No", width: 6 }, { header: "Nomor Tiket", width: 18 }, { header: "Masuk (WIB)", width: 22 }, { header: "Kategori", width: 24 },
      { header: "Wilayah", width: 28 }, { header: "Status", width: 28 }, { header: "Petugas", width: 22 }, { header: "Diklaim (WIB)", width: 22 },
      { header: "Respons pertama (jam)", width: 20 }, { header: "Ditutup (WIB)", width: 22 }, { header: "Durasi penyelesaian (jam)", width: 22 }, { header: "Alasan penutupan", width: 34 },
    ],
    rows.map((r, i) => [i + 1, r.ticketNumber, wib(r.createdAt), r.category, regionName(r.region), STATUS_LABEL[r.status as ComplaintStatus] ?? r.status, r.officer ?? "", wib(r.claimedAt), hrs(r.createdAt, r.claimedAt), wib(r.closedAt), hrs(r.createdAt, r.closedAt), r.closureReason ? CLOSURE[r.closureReason] : ""]),
  );

  // 3. Rekap per dimensi
  sheet(wb, "Per Kategori", [{ header: "Kategori", width: 30 }, { header: "Jumlah", width: 10 }, { header: "% dari total", width: 14, fmt: "0.0%" }, { header: "Terbuka", width: 10 }, { header: "Rata-rata penyelesaian (jam)", width: 26 }],
    a.byCategory.map((c) => [c.name, c.count, c.pct / 100, c.open, c.avgResolutionHrs ?? ""]));
  sheet(wb, "Per Wilayah", [{ header: "Kabupaten/Kota", width: 32 }, { header: "Jumlah", width: 10 }, { header: "% dari total", width: 14, fmt: "0.0%" }, { header: "Terbuka", width: 10 }, { header: "Kategori terbanyak", width: 26 }],
    [...a.byRegion.map((r) => [r.name, r.count, r.pct / 100, r.open, r.topCategoryName]), ...(a.unknownRegion ? [["Tidak diketahui", a.unknownRegion, a.kpi.total ? a.unknownRegion / a.kpi.total : 0, "", ""]] : [])]);
  sheet(wb, "Per Status", [{ header: "Status", width: 34 }, { header: "Jumlah", width: 10 }, { header: "% dari total", width: 14, fmt: "0.0%" }],
    a.byStatus.map((s) => [s.label, s.count, k.total ? s.count / k.total : 0]));
  sheet(wb, a.period.granularity === "day" ? "Per Hari" : "Per Pekan", [{ header: a.period.granularity === "day" ? "Tanggal" : "Awal pekan (Senin)", width: 20 }, { header: "Masuk", width: 10 }, { header: "Ditutup", width: 10 }],
    a.trend.map((t) => [t.date, t.created, t.closed]));
  sheet(wb, "Per Petugas", [{ header: "Petugas", width: 28 }, { header: "Ditangani", width: 12 }, { header: "Selesai", width: 10 }, { header: "Terbuka", width: 10 }, { header: "Rata-rata respons (jam)", width: 22 }, { header: "Rata-rata penyelesaian (jam)", width: 26 }],
    a.byOfficer.map((o) => [o.name, o.handled, o.closed, o.open, o.avgFirstResponseHrs ?? "", o.avgResolutionHrs ?? ""]));
  sheet(wb, "Pola Waktu", [{ header: "Hari", width: 16 }, { header: "Jumlah", width: 10 }, { header: "", width: 4 }, { header: "Jam (WIB)", width: 12 }, { header: "Jumlah", width: 10 }],
    Array.from({ length: 24 }, (_, i) => [a.weekday[i]?.name ?? "", a.weekday[i]?.count ?? "", "", `${String(i).padStart(2, "0")}.00`, a.hour[i].count]));
  sheet(wb, "Wilayah x Kategori", [{ header: "Wilayah", width: 32 }, ...a.matrix.categories.map((c) => ({ header: c.name, width: 18 }))],
    a.matrix.rows.map((r) => [r.name, ...r.counts]));
  sheet(wb, "Umur Tiket Terbuka", [{ header: "Umur sejak masuk", width: 26 }, { header: "Jumlah tiket terbuka", width: 22 }], a.aging.map((x) => [x.label, x.count]));

  return Buffer.from(await wb.xlsx.writeBuffer());
}

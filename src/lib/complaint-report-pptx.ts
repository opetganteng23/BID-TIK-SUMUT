import PptxGenJS from "pptxgenjs";
import { fmtDuration, fmtNum, fmtPct, type Analytics } from "@/lib/complaint-analytics-core";
import { CATEGORY_COLORS, STATUS_COLORS } from "@/lib/regions";
import { LOGO_POLDA, LOGO_RATIO, LOGO_TIK } from "@/lib/report-assets";

type Slide = PptxGenJS.Slide;

// Ringkasan eksekutif (.pptx) 16:9. Koordinat diukur dari kanvas 1280 x 720 px (X() mengubahnya ke inci).
// Struktur mengikuti laporan ringkasan eksekutif: sampul, ringkasan, grafik per dimensi, rekomendasi, catatan, penutup.
const C = { cloud: "F7F7F8", ink: "0A0A0B", soft: "52525B", line: "E4E4E7", card: "F1F1F3", dark: "111113", white: "FFFFFF", warn: "B2182B" };
const FONT = "Calibri";
const X = (px: number) => px / 96;
const hex = (c: string) => c.replace("#", "");
const cat = (i: number) => hex(CATEGORY_COLORS[i % CATEGORY_COLORS.length]);

/** Campur warna dengan putih (0 = putih, 1 = warna penuh) untuk sel heatmap. */
function tint(color: string, strength: number) {
  const n = parseInt(color, 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(255 - (255 - v) * strength));
  return ch.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export type PptxMeta = { periodLabel: string; filterLabel: string; exportedAt: Date };

export async function buildComplaintDeck(a: Analytics, meta: PptxMeta): Promise<Buffer> {
  const p = new PptxGenJS();
  p.layout = "LAYOUT_WIDE";
  p.author = "Website BID TIK Polda Sumut";
  p.company = "Bid TIK Polda Sumatera Utara";
  p.title = `Ringkasan Eksekutif Pengaduan Masyarakat - ${meta.periodLabel}`;
  p.theme = { headFontFace: FONT, bodyFontFace: FONT };

  const k = a.kpi;
  const stamp = meta.exportedAt.toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
  const footer = `Laporan Analitik Pengaduan Masyarakat · ${meta.periodLabel}${meta.filterLabel ? ` · ${meta.filterLabel}` : ""}`;

  const T = (s: Slide, text: string | PptxGenJS.TextProps[], o: PptxGenJS.TextPropsOptions) => s.addText(text as never, { fontFace: FONT, color: C.ink, margin: 0, valign: "top", ...o });
  const box = (s: Slide, x: number, y: number, w: number, h: number, fill: string, line = fill) =>
    s.addShape(p.ShapeType.roundRect, { x: X(x), y: X(y), w: X(w), h: X(h), fill: { color: fill }, line: { color: line, width: line === fill ? 0 : 0.75 }, rectRadius: 0.12 });

  p.defineSlideMaster({
    title: "CONTENT",
    background: { color: C.cloud },
    objects: [
      { text: { text: footer, options: { x: X(58), y: X(676), w: X(900), h: X(22), fontFace: FONT, fontSize: 9, color: C.soft, valign: "middle", margin: 0 } } },
      { image: { data: LOGO_POLDA, x: X(1088), y: X(660), w: X(40 * LOGO_RATIO.polda), h: X(40) } },
      { image: { data: LOGO_TIK, x: X(1088 + 40 * LOGO_RATIO.polda + 10), y: X(660), w: X(40 * LOGO_RATIO.tik), h: X(40) } },
    ],
    slideNumber: { x: X(1190), y: X(676), w: X(40), h: X(22), fontFace: FONT, fontSize: 9, color: C.soft, align: "right" },
  });
  const base = (head: string, sub: string) => {
    const s = p.addSlide({ masterName: "CONTENT" });
    T(s, head, { x: X(58), y: X(40), w: X(1160), h: X(52), fontSize: 30, bold: true, valign: "middle" });
    T(s, sub, { x: X(58), y: X(96), w: X(1160), h: X(26), fontSize: 13, color: C.soft, valign: "middle" });
    return s;
  };
  const stat = (s: Slide, x: number, y: number, w: number, h: number, label: string, value: string, sub: string, warn = false) => {
    box(s, x, y, w, h, C.white, C.line);
    const small = h < 100;
    T(s, label, { x: X(x + 16), y: X(y + (small ? 8 : 12)), w: X(w - 32), h: X(18), fontSize: small ? 10.5 : 11, color: C.soft });
    T(s, value, { x: X(x + 16), y: X(y + (small ? 28 : 36)), w: X(w - 32), h: X(small ? 32 : 46), fontSize: small ? 20 : 30, bold: true, color: warn ? C.warn : C.ink, valign: "middle" });
    T(s, sub, { x: X(x + 16), y: X(y + h - (small ? 26 : 32)), w: X(w - 32), h: X(20), fontSize: 10.5, color: warn ? C.warn : C.soft, bold: warn });
  };
  const headRow = (cols: string[], align: PptxGenJS.HAlign[] = []) => cols.map((t, i) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.dark }, fontSize: 11, align: align[i] ?? "left" } }));
  const cell = (text: string, o: Partial<PptxGenJS.TableCellProps> = {}) => ({ text, options: { fontSize: 11, color: C.ink, ...o } });

  // ===== 1. Sampul =====
  {
    const s = p.addSlide();
    s.background = { color: C.dark };
    s.addImage({ data: LOGO_POLDA, x: X(80), y: X(70), w: X(110 * LOGO_RATIO.polda), h: X(110) });
    s.addImage({ data: LOGO_TIK, x: X(80 + 110 * LOGO_RATIO.polda + 24), y: X(70), w: X(110 * LOGO_RATIO.tik), h: X(110) });
    T(s, "LAPORAN UNTUK PIMPINAN", { x: X(80), y: X(250), w: X(1000), h: X(24), fontSize: 13, bold: true, color: "E69F00", charSpacing: 3 });
    T(s, "Analitik Pengaduan Masyarakat", { x: X(80), y: X(290), w: X(1100), h: X(70), fontSize: 42, bold: true, color: C.white });
    T(s, "Bid TIK Polda Sumatera Utara", { x: X(80), y: X(366), w: X(1100), h: X(40), fontSize: 24, color: "D4D4D8" });
    T(s, meta.periodLabel + (meta.filterLabel ? ` · ${meta.filterLabel}` : ""), { x: X(80), y: X(430), w: X(1100), h: X(28), fontSize: 15, color: C.white });
    T(s, `${fmtNum(k.total)} pengaduan dianalisis · ${fmtNum(k.closed)} ditutup · respons pertama rata-rata ${fmtDuration(k.avgFirstResponseHrs)}`, { x: X(80), y: X(466), w: X(1100), h: X(26), fontSize: 13, color: "A1A1AA" });
    T(s, `Data diekspor dari sistem Pengaduan Online pada ${stamp} WIB`, { x: X(80), y: X(640), w: X(1100), h: X(22), fontSize: 10.5, color: "A1A1AA" });
  }

  if (!k.total) {
    const s = base("Tidak ada data", "Tidak ada pengaduan pada periode dan filter yang dipilih");
    T(s, "Ubah periode atau filter lalu ekspor kembali untuk mendapatkan analisis.", { x: X(58), y: X(160), w: X(1100), h: X(40), fontSize: 16, color: C.soft });
    return Buffer.from((await p.write({ outputType: "nodebuffer" })) as Uint8Array);
  }

  // ===== 2. Ringkasan eksekutif =====
  {
    const s = base("Ringkasan eksekutif", "Gambaran umum pengaduan masyarakat pada periode laporan");
    stat(s, 58, 140, 275, 118, "Total pengaduan", fmtNum(k.total), k.changePct === null ? "periode ini" : `${k.changePct >= 0 ? "naik" : "turun"} ${fmtNum(Math.abs(k.changePct), 1)}% vs periode sebelumnya`);
    stat(s, 349, 140, 275, 118, "Sudah ditutup", fmtPct(k.closed, k.total), `${fmtNum(k.closed)} dari ${fmtNum(k.total)} pengaduan`);
    stat(s, 640, 140, 275, 118, "Respons pertama", fmtDuration(k.avgFirstResponseHrs), `rata-rata · median ${fmtDuration(k.medianFirstResponseHrs)}`);
    stat(s, 931, 140, 291, 118, "Waktu penyelesaian", fmtDuration(k.avgResolutionHrs), `rata-rata · median ${fmtDuration(k.medianResolutionHrs)}`);
    stat(s, 58, 274, 275, 92, "Masih terbuka", fmtNum(k.open), `${fmtNum(k.unclaimed)} belum diambil`, k.unclaimed > 0);
    stat(s, 349, 274, 275, 92, "Dikonfirmasi pelapor", `${fmtNum(k.reporterConfirmedPct, 1)}%`, "dari tiket yang ditutup");
    stat(s, 640, 274, 275, 92, "Ditutup otomatis", `${fmtNum(k.autoClosedPct, 1)}%`, "tanpa respons pelapor 7 hari");
    stat(s, 931, 274, 291, 92, "Lewat tenggat konfirmasi", fmtNum(k.overdueConfirmation), "menunggu penutupan otomatis", k.overdueConfirmation > 0);
    box(s, 58, 384, 1164, 254, C.white, C.line);
    T(s, "Temuan utama", { x: X(82), y: X(398), w: X(400), h: X(26), fontSize: 16, bold: true });
    T(s, a.insights.slice(0, 5).map((t) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: true } })), { x: X(82), y: X(430), w: X(1116), h: X(196), fontSize: 13, paraSpaceAfter: 6, valign: "top" });
  }

  // ===== 3. Tren =====
  {
    const s = base("Tren pengaduan", `Pengaduan masuk dan ditutup per ${a.period.granularity === "day" ? "hari" : "pekan"} (WIB)`);
    const labels = a.trend.map((t) => new Date(`${t.date}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }));
    s.addChart(p.ChartType.line, [{ name: "Masuk", labels, values: a.trend.map((t) => t.created) }, { name: "Ditutup", labels, values: a.trend.map((t) => t.closed) }], {
      x: X(58), y: X(140), w: X(820), h: X(490), chartColors: ["0072B2", "009E73"], lineSize: 2.5, lineDataSymbolSize: a.trend.length > 40 ? 0 : 6, showLegend: true, legendPos: "b", legendFontSize: 11,
      catAxisLabelFontSize: 10, valAxisLabelFontSize: 10, valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: "none" }, catAxisLabelFrequency: Math.max(1, Math.ceil(a.trend.length / 10)),
    } as never);
    const peakDay = [...a.weekday].sort((x, y) => y.count - x.count)[0];
    const peakHour = [...a.hour].sort((x, y) => y.count - x.count)[0];
    const peakBucket = [...a.trend].sort((x, y) => y.created - x.created)[0];
    stat(s, 904, 140, 318, 112, "Rata-rata per hari", fmtNum(k.total / Math.max(1, a.period.days), 1), `selama ${fmtNum(a.period.days)} hari`);
    stat(s, 904, 266, 318, 112, `Puncak per ${a.period.granularity === "day" ? "hari" : "pekan"}`, fmtNum(peakBucket?.created ?? 0), peakBucket ? new Date(`${peakBucket.date}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "-");
    stat(s, 904, 392, 318, 112, "Hari tersibuk", peakDay.count ? peakDay.name : "-", `${fmtNum(peakDay.count)} pengaduan`);
    stat(s, 904, 518, 318, 112, "Jam tersibuk", peakHour.count ? `${String(peakHour.hour).padStart(2, "0")}.00` : "-", `WIB · ${fmtNum(peakHour.count)} pengaduan`);
  }

  // ===== 4. Status penanganan =====
  {
    const s = base("Status penanganan", "Posisi seluruh pengaduan pada periode laporan");
    const parts = a.byStatus.filter((x) => x.count > 0);
    s.addChart(p.ChartType.doughnut, [{ name: "Status", labels: parts.map((x) => x.label), values: parts.map((x) => x.count) }], {
      x: X(58), y: X(140), w: X(560), h: X(490), chartColors: parts.map((x) => hex(STATUS_COLORS[x.key])), holeSize: 58, showLegend: true, legendPos: "b", legendFontSize: 11, showPercent: false, showValue: true, dataLabelColor: C.white, dataLabelFontSize: 12,
    } as never);
    const rows = [headRow(["Status", "Jumlah", "Persen"], ["left", "right", "right"]), ...a.byStatus.map((x) => [cell(x.label), cell(fmtNum(x.count), { align: "right" }), cell(fmtPct(x.count, k.total), { align: "right" })])];
    s.addTable(rows as never, { x: X(660), y: X(150), w: X(562), colW: [X(330), X(110), X(122)], border: { type: "solid", color: C.line, pt: 0.5 }, rowH: X(34), fontFace: FONT });
    box(s, 660, 420, 562, 210, C.white, C.line);
    T(s, [
      { text: "Yang perlu diperhatikan", options: { bold: true, fontSize: 14, breakLine: true } },
      { text: `${fmtNum(k.unclaimed)} tiket belum diambil petugas.`, options: { bullet: { indent: 14 }, breakLine: true } },
      { text: `${fmtNum(k.overdueConfirmation)} tiket menunggu konfirmasi pelapor melewati tenggat 7 hari.`, options: { bullet: { indent: 14 }, breakLine: true } },
      { text: `${fmtNum(a.aging[3].count)} tiket terbuka berumur lebih dari 7 hari.`, options: { bullet: { indent: 14 } } },
    ], { x: X(684), y: X(438), w: X(520), h: X(180), fontSize: 13, paraSpaceAfter: 6 });
  }

  // ===== 5. Kategori =====
  {
    const s = base("Pengaduan per kategori", "Jumlah pengaduan dan rata-rata waktu penyelesaian tiap kategori");
    const cs = a.byCategory.filter((c) => c.count > 0);
    s.addChart(p.ChartType.bar, [{ name: "Pengaduan", labels: cs.map((c) => c.name), values: cs.map((c) => c.count) }], {
      x: X(58), y: X(140), w: X(600), h: X(490), barDir: "bar", chartColors: cs.map((c) => cat(c.color)), showValue: true, dataLabelFontSize: 11, catAxisOrientation: "maxMin", valAxisHidden: true, valGridLine: { style: "none" },
      catAxisLabelFontSize: 11, showLegend: false,
    } as never);
    const rows = [headRow(["Kategori", "Jumlah", "%", "Terbuka", "Penyelesaian"], ["left", "right", "right", "right", "right"]), ...cs.map((c) => [cell(c.name, { bold: true }), cell(fmtNum(c.count), { align: "right" }), cell(`${fmtNum(c.pct, 1)}%`, { align: "right" }), cell(fmtNum(c.open), { align: "right" }), cell(fmtDuration(c.avgResolutionHrs), { align: "right" })])];
    s.addTable(rows as never, { x: X(690), y: X(150), w: X(532), colW: [X(190), X(70), X(70), X(90), X(112)], border: { type: "solid", color: C.line, pt: 0.5 }, rowH: X(34), fontFace: FONT });
  }

  // ===== 6. Sebaran wilayah (peta skematik) =====
  {
    const s = base("Sebaran wilayah", "Lingkaran sebesar jumlah pengaduan, berwarna menurut kategori terbanyak di wilayah itu");
    const MX = 58, MY = 140, MW = 560, MH = 490;
    box(s, MX, MY, MW, MH, C.white, C.line);
    const [lng0, lng1, lat0, lat1] = [97.2, 100.3, 0.4, 4.0];
    const px = (lng: number) => MX + 24 + ((lng - lng0) / (lng1 - lng0)) * (MW - 48);
    const py = (lat: number) => MY + 24 + (1 - (lat - lat0) / (lat1 - lat0)) * (MH - 48);
    const max = Math.max(1, ...a.byRegion.map((r) => r.count));
    const sorted = [...a.byRegion].sort((x, y) => y.count - x.count);
    for (const r of [...sorted].reverse()) {
      const d = 20 + 48 * Math.sqrt(r.count / max);
      s.addShape(p.ShapeType.ellipse, { x: X(px(r.lng) - d / 2), y: X(py(r.lat) - d / 2), w: X(d), h: X(d), fill: { color: cat(r.topCategoryColor), transparency: 18 }, line: { color: C.white, width: 1.5 } });
    }
    // Label wilayah teratas: diurutkan menurut y lalu digeser ke bawah agar tidak saling menimpa.
    let lastY = -1e9;
    const labels = sorted.slice(0, 6).map((r) => ({ r, x: px(r.lng) + 20 + 24 * Math.sqrt(r.count / max), y: py(r.lat) - 8 })).sort((u, v) => u.y - v.y);
    for (const l of labels) {
      const y = Math.max(l.y, lastY + 15);
      lastY = y;
      T(s, `${l.r.name.replace(/^(Kota|Kabupaten) /, "")} (${fmtNum(l.r.count)})`, { x: X(l.x), y: X(y), w: X(150), h: X(14), fontSize: 9, bold: true, color: C.ink, valign: "middle" });
    }
    T(s, "Peta skematik; posisi adalah titik perkiraan pusat wilayah, bukan batas administratif.", { x: X(MX + 14), y: X(MY + MH - 26), w: X(MW - 28), h: X(18), fontSize: 8.5, color: C.soft });
    const rows = [headRow(["Kabupaten/Kota", "Jumlah", "%", "Terbanyak"], ["left", "right", "right", "left"]), ...a.byRegion.slice(0, 11).map((r) => [cell(r.name), cell(fmtNum(r.count), { align: "right" }), cell(`${fmtNum(r.pct, 1)}%`, { align: "right" }), cell(r.topCategoryName, { color: cat(r.topCategoryColor), bold: true })])];
    s.addTable(rows as never, { x: X(650), y: X(140), w: X(572), colW: [X(236), X(70), X(70), X(196)], border: { type: "solid", color: C.line, pt: 0.5 }, rowH: X(32), fontFace: FONT });
    if (a.unknownRegion) T(s, `${fmtNum(a.unknownRegion)} pengaduan tanpa data wilayah tidak tampil.`, { x: X(650), y: X(560), w: X(572), h: X(22), fontSize: 11, color: C.soft });
    // legenda kategori
    a.matrix.categories.forEach((c, i) => {
      const lx = 650 + (i % 3) * 190, ly = 590 + Math.floor(i / 3) * 22;
      s.addShape(p.ShapeType.ellipse, { x: X(lx), y: X(ly + 3), w: X(12), h: X(12), fill: { color: cat(c.color) }, line: { color: cat(c.color), width: 0 } });
      T(s, c.name, { x: X(lx + 18), y: X(ly), w: X(168), h: X(18), fontSize: 10, valign: "middle" });
    });
  }

  // ===== 7. Wilayah x kategori =====
  {
    const s = base("Wilayah dan kategori", "Delapan wilayah dengan pengaduan terbanyak; intensitas warna mengikuti jumlah");
    const max = Math.max(1, ...a.matrix.rows.flatMap((r) => r.counts));
    const cols = a.matrix.categories;
    const rows = [
      [{ text: "Wilayah", options: { bold: true, color: C.white, fill: { color: C.dark }, fontSize: 11 } }, ...cols.map((c) => ({ text: c.name, options: { bold: true, color: C.white, fill: { color: C.dark }, fontSize: 10.5, align: "right" as const } })), { text: "Total", options: { bold: true, color: C.white, fill: { color: C.dark }, fontSize: 11, align: "right" as const } }],
      ...a.matrix.rows.map((r) => [cell(r.name, { bold: true }), ...r.counts.map((n, i) => cell(fmtNum(n), { align: "right", fill: { color: n ? tint(cat(cols[i].color), 0.1 + 0.5 * (n / max)) : C.white } })), cell(fmtNum(r.counts.reduce((x, y) => x + y, 0)), { align: "right", bold: true })]),
    ];
    const first = 280, rest = (1164 - first - 90) / Math.max(1, cols.length);
    s.addTable(rows as never, { x: X(58), y: X(145), w: X(1164), colW: [X(first), ...cols.map(() => X(rest)), X(90)], border: { type: "solid", color: C.line, pt: 0.5 }, rowH: X(42), fontFace: FONT });
  }

  // ===== 8. Pola waktu =====
  {
    const s = base("Pola waktu pengaduan", "Kapan pengaduan paling banyak masuk (WIB)");
    s.addChart(p.ChartType.bar, [{ name: "Pengaduan", labels: a.weekday.map((d) => d.name), values: a.weekday.map((d) => d.count) }], { x: X(58), y: X(165), w: X(520), h: X(450), chartColors: ["0072B2"], showValue: true, dataLabelFontSize: 10, valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontSize: 10, showLegend: false } as never);
    s.addChart(p.ChartType.bar, [{ name: "Pengaduan", labels: a.hour.map((h) => String(h.hour).padStart(2, "0")), values: a.hour.map((h) => h.count) }], { x: X(610), y: X(165), w: X(612), h: X(450), chartColors: ["D55E00"], showValue: false, valAxisLabelFontSize: 10, valGridLine: { color: C.line, size: 0.5 }, catAxisLabelFontSize: 9, showLegend: false } as never);
    T(s, "Per hari dalam pekan", { x: X(58), y: X(135), w: X(520), h: X(24), fontSize: 14, bold: true });
    T(s, "Per jam dalam sehari", { x: X(610), y: X(135), w: X(612), h: X(24), fontSize: 14, bold: true });
  }

  // ===== 9. Tunggakan =====
  {
    const s = base("Umur tiket yang masih terbuka", "Tunggakan dihitung sejak tiket masuk");
    s.addChart(p.ChartType.bar, [{ name: "Tiket terbuka", labels: a.aging.map((x) => x.label), values: a.aging.map((x) => x.count) }], { x: X(58), y: X(140), w: X(700), h: X(490), barDir: "bar", chartColors: ["009E73", "E69F00", "D55E00", "B2182B"], showValue: true, dataLabelFontSize: 12, catAxisOrientation: "maxMin", valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontSize: 12, showLegend: false } as never);
    stat(s, 790, 140, 432, 140, "Belum diambil petugas", fmtNum(k.unclaimed), "perlu segera diklaim", k.unclaimed > 0);
    stat(s, 790, 300, 432, 140, "Lewat tenggat konfirmasi", fmtNum(k.overdueConfirmation), "akan ditutup otomatis oleh sistem", k.overdueConfirmation > 0);
    stat(s, 790, 460, 432, 140, "Terbuka lebih dari 7 hari", fmtNum(a.aging[3].count), "prioritas tinjauan", a.aging[3].count > 0);
  }

  // ===== 10. Kinerja petugas =====
  {
    const s = base("Beban dan kinerja petugas", "Tiket yang diklaim petugas pada periode laporan");
    if (!a.byOfficer.length) T(s, "Belum ada tiket yang diklaim petugas pada periode ini.", { x: X(58), y: X(160), w: X(1100), h: X(30), fontSize: 16, color: C.soft });
    else {
      const rows = [headRow(["Petugas", "Ditangani", "Selesai", "Terbuka", "Rata-rata respons", "Rata-rata penyelesaian"], ["left", "right", "right", "right", "right", "right"]), ...a.byOfficer.slice(0, 12).map((o) => [cell(o.name, { bold: true }), cell(fmtNum(o.handled), { align: "right" }), cell(fmtNum(o.closed), { align: "right" }), cell(fmtNum(o.open), { align: "right" }), cell(fmtDuration(o.avgFirstResponseHrs), { align: "right" }), cell(fmtDuration(o.avgResolutionHrs), { align: "right" })])];
      s.addTable(rows as never, { x: X(58), y: X(145), w: X(1164), colW: [X(320), X(130), X(130), X(130), X(220), X(234)], border: { type: "solid", color: C.line, pt: 0.5 }, rowH: X(36), fontFace: FONT });
    }
  }

  // ===== 11. Rekomendasi =====
  {
    const s = base("Rekomendasi tindak lanjut", "Saran berdasarkan data periode ini; tetap memerlukan pertimbangan pimpinan");
    a.recommendations.slice(0, 6).forEach((t, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 58 + col * 586, y = 145 + row * 160;
      box(s, x, y, 570, 142, C.white, C.line);
      s.addShape(p.ShapeType.ellipse, { x: X(x + 18), y: X(y + 18), w: X(40), h: X(40), fill: { color: C.dark }, line: { color: C.dark, width: 0 } });
      T(s, String(i + 1), { x: X(x + 18), y: X(y + 18), w: X(40), h: X(40), fontSize: 16, bold: true, color: C.white, align: "center", valign: "middle" });
      T(s, t, { x: X(x + 74), y: X(y + 16), w: X(478), h: X(112), fontSize: 13.5, valign: "top" });
    });
  }

  // ===== 12. Catatan =====
  {
    const s = base("Catatan dan metodologi", "Hal yang perlu diperhatikan dalam membaca laporan ini");
    const notes = [
      "Sumber data: modul Pengaduan Online. Laporan hanya memuat angka agregat; identitas pelapor, isi pengaduan, dan lampiran tidak disertakan.",
      "Semua waktu memakai WIB (Asia/Jakarta). Respons pertama dihitung dari tiket masuk sampai diklaim petugas; waktu penyelesaian dari tiket masuk sampai ditutup.",
      "Peta sebaran bersifat skematik: posisi lingkaran adalah titik perkiraan pusat kabupaten/kota, bukan batas wilayah. Pengaduan lama tanpa data wilayah tidak tampil di peta.",
      "Tiket ditutup setelah pelapor mengonfirmasi, atau otomatis bila tidak ada respons selama 7 hari kalender sejak status menunggu konfirmasi.",
      "Temuan dan rekomendasi disusun otomatis dari aturan sederhana sebagai bahan diskusi, bukan keputusan.",
      "Pada tahap prototype, pengujian memakai data fiktif; laporan baru bermakna operasional setelah gate privasi dan keamanan disetujui.",
    ];
    box(s, 58, 140, 1164, 490, C.white, C.line);
    T(s, notes.map((t) => ({ text: t, options: { bullet: { indent: 16 }, breakLine: true } })), { x: X(84), y: X(164), w: X(1112), h: X(444), fontSize: 14, paraSpaceAfter: 10 });
  }

  // ===== 13. Penutup =====
  {
    const s = p.addSlide();
    s.background = { color: C.dark };
    s.addImage({ data: LOGO_POLDA, x: X(80), y: X(90), w: X(120 * LOGO_RATIO.polda), h: X(120) });
    s.addImage({ data: LOGO_TIK, x: X(80 + 120 * LOGO_RATIO.polda + 24), y: X(90), w: X(120 * LOGO_RATIO.tik), h: X(120) });
    T(s, "TERIMA KASIH", { x: X(80), y: X(290), w: X(1000), h: X(60), fontSize: 40, bold: true, color: C.white });
    T(s, "Setiap pengaduan adalah masukan untuk layanan Polri yang lebih Presisi.", { x: X(80), y: X(360), w: X(1000), h: X(40), fontSize: 20, color: "D4D4D8" });
    T(s, "Laporan ini dapat diunduh ulang kapan saja dari panel admin untuk angka terbaru.", { x: X(80), y: X(420), w: X(1000), h: X(30), fontSize: 14, color: "A1A1AA" });
    T(s, "Bid TIK Polda Sumatera Utara", { x: X(80), y: X(600), w: X(1000), h: X(30), fontSize: 14, color: "A1A1AA" });
  }

  return Buffer.from((await p.write({ outputType: "nodebuffer" })) as Uint8Array);
}

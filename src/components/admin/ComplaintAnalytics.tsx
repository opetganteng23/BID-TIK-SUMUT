"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet, Presentation } from "lucide-react";
import { ApiClientError, api, downloadFile } from "@/components/api";
import { Button, Card, Notice, SelectInput, Skeleton, TextInput } from "@/components/ui";
import { Card2, ChartTable, Columns, Donut, HBars, Legend, Matrix, TrendChart } from "@/components/admin/charts";
import { REGIONS, STATUS_COLORS, categoryColor } from "@/lib/regions";
import { fmtDuration, fmtNum, type Analytics } from "@/lib/complaint-analytics-core";
import { can, type Role } from "@/lib/rbac";

// Leaflet menyentuh `window`, jadi hanya dimuat di klien.
const ComplaintMap = dynamic(() => import("@/components/admin/ComplaintMap").then((m) => m.ComplaintMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[360px] sm:h-[440px]" />,
});

type Data = Analytics & { truncated: boolean };
type Preset = "7" | "30" | "90" | "365" | "all" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "7", label: "7 hari terakhir" },
  { value: "30", label: "30 hari terakhir" },
  { value: "90", label: "90 hari terakhir" },
  { value: "365", label: "12 bulan terakhir" },
  { value: "all", label: "Semua waktu" },
  { value: "custom", label: "Rentang kustom" },
];

const wibDay = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "warn" }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p>
      {sub != null && <p className={`mt-1 text-xs ${tone === "warn" ? "font-semibold" : "text-muted"}`}>{tone === "warn" ? "Perlu perhatian: " : ""}{sub}</p>}
    </div>
  );
}

export function ComplaintAnalytics({ role }: { role: Role }) {
  const [preset, setPreset] = useState<Preset>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [region, setRegion] = useState("");
  const [status, setStatus] = useState("");
  const [cats, setCats] = useState<{ value: string; label: string }[]>([]);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "xlsx" | "pptx">("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    const now = new Date();
    if (preset === "custom") {
      if (from) p.set("from", new Date(`${from}T00:00:00+07:00`).toISOString());
      if (to) p.set("to", new Date(`${to}T23:59:59+07:00`).toISOString());
    } else if (preset === "all") {
      p.set("from", "2020-01-01T00:00:00.000Z");
    } else {
      p.set("from", new Date(now.getTime() - Number(preset) * 86_400_000).toISOString());
    }
    if (categoryId) p.set("categoryId", categoryId);
    if (region) p.set("region", region);
    if (status) p.set("status", status);
    return p.toString();
  }, [preset, from, to, categoryId, region, status]);

  const load = useCallback(async () => {
    try {
      setError("");
      setData(await api<Data>(`/api/admin/complaints/analytics?${query}`));
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat analitik.");
    }
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api<{ items: { _id: string; name: string }[] }>("/api/admin/complaint-categories?limit=100")
      .then((d) => setCats(d.items.map((c) => ({ value: c._id, label: c.name }))))
      .catch(() => {});
  }, []);

  async function exportFile(kind: "xlsx" | "pptx") {
    setBusy(kind);
    setError("");
    try {
      await downloadFile(`/api/admin/complaints/report/${kind}?${query}`, kind === "xlsx" ? "analitik-pengaduan.xlsx" : "ringkasan-eksekutif-pengaduan.pptx");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unduhan gagal.");
    } finally {
      setBusy("");
    }
  }

  const canExport = can(role, "complaints.export");
  const mapRegions = useMemo(() => data?.byRegion ?? [], [data]);
  const filtered = !!(categoryId || region || status || preset !== "30");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/complaints" className="inline-flex items-center gap-1 text-sm underline underline-offset-4"><ArrowLeft className="size-4" aria-hidden /> Kembali ke daftar pengaduan</Link>
          <h1 className="mt-1 text-3xl">Analitik Pengaduan</h1>
          <p className="text-sm text-muted">Ringkasan agregat tanpa data pribadi pelapor.</p>
        </div>
        {canExport && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => exportFile("xlsx")} loading={busy === "xlsx"}><FileSpreadsheet className="size-4" aria-hidden /> Unduh Excel</Button>
            <Button onClick={() => exportFile("pptx")} loading={busy === "pptx"}><Presentation className="size-4" aria-hidden /> Ringkasan Eksekutif (PPTX)</Button>
          </div>
        )}
      </div>

      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectInput id="an-preset" label="Periode" value={preset} onChange={(e) => setPreset(e.target.value as Preset)} options={PRESETS} />
          {preset === "custom" && (
            <>
              <TextInput id="an-from" label="Dari tanggal" type="date" value={from} max={wibDay(new Date())} onChange={(e) => setFrom(e.target.value)} />
              <TextInput id="an-to" label="Sampai tanggal" type="date" value={to} max={wibDay(new Date())} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
          <SelectInput id="an-cat" label="Kategori" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={[{ value: "", label: "Semua kategori" }, ...cats]} />
          <SelectInput id="an-region" label="Wilayah" value={region} onChange={(e) => setRegion(e.target.value)} options={[{ value: "", label: "Semua wilayah" }, ...REGIONS.map((r) => ({ value: r.slug, label: r.name }))]} />
          <SelectInput id="an-status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "", label: "Semua status" }, ...(data?.byStatus ?? []).map((s) => ({ value: s.key, label: s.label }))]} />
        </div>
        {filtered && <Button variant="secondary" onClick={() => { setPreset("30"); setFrom(""); setTo(""); setCategoryId(""); setRegion(""); setStatus(""); }}>Reset filter</Button>}
      </Card>

      {error && <Notice kind="error">{error}</Notice>}
      {data?.truncated && <Notice kind="info">Data melebihi batas 50.000 baris, sehingga hanya sebagian terbaru yang dihitung. Persempit periode untuk hasil lengkap.</Notice>}

      {!data ? (
        <div aria-busy="true" className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /></div>
      ) : data.kpi.total === 0 ? (
        <Card className="py-10 text-center"><p className="text-lg font-medium">Belum ada pengaduan pada filter ini</p><p className="mt-1 text-sm text-muted">Ubah periode atau filter untuk melihat analitik.</p></Card>
      ) : (
        <>
          <section aria-label="Indikator utama" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Total pengaduan" value={fmtNum(data.kpi.total)} sub={data.kpi.changePct === null ? undefined : `${data.kpi.changePct >= 0 ? "naik" : "turun"} ${fmtNum(Math.abs(data.kpi.changePct), 1)}% vs periode sebelumnya`} />
            <Kpi label="Masih terbuka" value={fmtNum(data.kpi.open)} sub={`${fmtNum(data.kpi.unclaimed)} belum diambil`} tone={data.kpi.unclaimed ? "warn" : undefined} />
            <Kpi label="Sudah ditutup" value={fmtNum(data.kpi.closed)} sub={`${fmtNum(data.kpi.closedPct, 1)}% dari total`} />
            <Kpi label="Respons pertama" value={fmtDuration(data.kpi.avgFirstResponseHrs)} sub={`median ${fmtDuration(data.kpi.medianFirstResponseHrs)}`} />
            <Kpi label="Waktu penyelesaian" value={fmtDuration(data.kpi.avgResolutionHrs)} sub={`median ${fmtDuration(data.kpi.medianResolutionHrs)}`} />
            <Kpi label="Dikonfirmasi pelapor" value={`${fmtNum(data.kpi.reporterConfirmedPct, 1)}%`} sub="dari tiket yang ditutup" />
            <Kpi label="Ditutup otomatis" value={`${fmtNum(data.kpi.autoClosedPct, 1)}%`} sub="tanpa respons pelapor 7 hari" />
            <Kpi label="Lewat tenggat konfirmasi" value={fmtNum(data.kpi.overdueConfirmation)} sub="menunggu penutupan otomatis" tone={data.kpi.overdueConfirmation ? "warn" : undefined} />
          </section>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <Card2 title="Temuan utama" subtitle="Disusun otomatis dari data pada filter ini.">
              <ul className="list-disc space-y-2 pl-5 text-sm">{data.insights.map((t) => <li key={t}>{t}</li>)}</ul>
            </Card2>
            <Card2 title="Rekomendasi tindak lanjut" subtitle="Saran berbasis aturan sederhana; tetap perlu pertimbangan pimpinan.">
              {data.recommendations.length ? <ul className="list-disc space-y-2 pl-5 text-sm">{data.recommendations.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="text-sm text-muted">Tidak ada rekomendasi khusus.</p>}
            </Card2>
          </div>

          <Card2 title="Tren pengaduan" subtitle={`Pengaduan masuk dan ditutup per ${data.period.granularity === "day" ? "hari" : "pekan"} (WIB).`}>
            <TrendChart points={data.trend} unit={data.period.granularity} />
          </Card2>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card2 title="Status penanganan">
              <Donut centerLabel="pengaduan" parts={data.byStatus.map((s) => ({ label: s.label, value: s.count, color: STATUS_COLORS[s.key] }))} />
              <ChartTable caption="Status penanganan" head={["Status", "Jumlah"]} rows={data.byStatus.map((s) => [s.label, s.count])} />
            </Card2>
            <Card2 title="Pengaduan per kategori">
              <HBars rows={data.byCategory.map((c) => ({ label: c.name, value: c.count, color: categoryColor(c.color), sub: `${fmtNum(c.pct, 1)}%` }))} />
              <ChartTable caption="Pengaduan per kategori" head={["Kategori", "Jumlah", "Terbuka", "Rata-rata penyelesaian"]} rows={data.byCategory.map((c) => [c.name, c.count, c.open, fmtDuration(c.avgResolutionHrs)])} />
            </Card2>
          </div>

          <Card2 title="Peta sebaran wilayah" subtitle="Lingkaran per kabupaten/kota; warna menunjukkan kategori terbanyak.">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <ComplaintMap regions={mapRegions} categories={data.matrix.categories} />
              <div>
                <h3 className="mb-2 text-base">Wilayah teratas</h3>
                <HBars rows={data.byRegion.slice(0, 10).map((r) => ({ label: r.name, value: r.count, color: categoryColor(r.topCategoryColor), sub: `${fmtNum(r.pct, 1)}%` }))} emptyText="Belum ada pengaduan dengan data wilayah." />
                {data.unknownRegion > 0 && <p className="mt-3 text-xs text-muted">{fmtNum(data.unknownRegion)} pengaduan tanpa data wilayah tidak tampil di peta.</p>}
                <Legend items={data.matrix.categories.map((c) => ({ label: c.name, color: categoryColor(c.color) }))} />
              </div>
            </div>
            <ChartTable caption="Pengaduan per wilayah" head={["Wilayah", "Jumlah", "Terbuka", "Kategori terbanyak"]} rows={data.byRegion.map((r) => [r.name, r.count, r.open, r.topCategoryName])} />
          </Card2>

          <Card2 title="Wilayah dan kategori" subtitle="Delapan wilayah teratas. Intensitas warna sel mengikuti jumlah.">
            <Matrix categories={data.matrix.categories} rows={data.matrix.rows} />
          </Card2>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card2 title="Pola hari" subtitle="Hari masuknya pengaduan."><Columns label="Pengaduan per hari dalam pekan" items={data.weekday.map((d) => ({ label: d.name.slice(0, 3), value: d.count }))} /></Card2>
            <Card2 title="Pola jam" subtitle="Jam masuknya pengaduan (WIB)."><Columns label="Pengaduan per jam" items={data.hour.map((h) => ({ label: String(h.hour).padStart(2, "0"), value: h.count }))} /></Card2>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card2 title="Umur tiket yang masih terbuka" subtitle="Dihitung sejak tiket masuk.">
              <HBars rows={data.aging.map((a, i) => ({ label: a.label, value: a.count, color: ["#009E73", "#E69F00", "#D55E00", "#B2182B"][i] }))} />
            </Card2>
            <Card2 title="Beban dan kinerja petugas">
              {data.byOfficer.length === 0 ? <p className="py-6 text-center text-sm text-muted">Belum ada tiket yang diklaim.</p> : (
                <div className="overflow-x-auto rounded-xl border border-border" tabIndex={0} role="region" aria-label="Tabel kinerja petugas">
                  <table className="w-full min-w-[28rem] text-left text-sm">
                    <caption className="sr-only">Kinerja petugas</caption>
                    <thead className="bg-surface-2"><tr>{["Petugas", "Ditangani", "Selesai", "Terbuka", "Respons", "Penyelesaian"].map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                    <tbody>
                      {data.byOfficer.map((o) => (
                        <tr key={o.id} className="border-t border-border">
                          <th scope="row" className="px-3 py-1.5 font-normal">{o.name}</th>
                          <td className="px-3 py-1.5 tabular-nums">{fmtNum(o.handled)}</td>
                          <td className="px-3 py-1.5 tabular-nums">{fmtNum(o.closed)}</td>
                          <td className="px-3 py-1.5 tabular-nums">{fmtNum(o.open)}</td>
                          <td className="px-3 py-1.5">{fmtDuration(o.avgFirstResponseHrs)}</td>
                          <td className="px-3 py-1.5">{fmtDuration(o.avgResolutionHrs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card2>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted"><Download className="size-3.5" aria-hidden /> Unduhan Excel dan PPTX memakai filter yang sedang aktif dan dicatat di audit log.</p>
        </>
      )}
    </div>
  );
}

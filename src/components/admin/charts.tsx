import type { ReactNode } from "react";
import { categoryColor } from "@/lib/regions";
import { fmtNum } from "@/lib/complaint-analytics-core";

// Grafik SVG ringan: responsif lewat viewBox, aksesibel lewat role="img" + aria-label + <title>, dan
// setiap grafik dipasangkan dengan <ChartTable> sebagai padanan teks. Teks memakai currentColor agar ikut tema.

const AXIS = "currentColor";

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export function Card2({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-card border border-border bg-surface p-5 shadow-[var(--shadow)] ${className}`}>
      <h2 className="text-lg">{title}</h2>
      {subtitle && <p className="mb-3 text-sm text-muted">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

/** Padanan tabel untuk pembaca layar dan pengguna yang lebih suka angka. */
export function ChartTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center underline underline-offset-4">Lihat sebagai tabel</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-border" tabIndex={0} role="region" aria-label={`Tabel: ${caption}`}>
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-surface-2">
            <tr>{head.map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {r.map((c, j) => (j === 0 ? <th key={j} scope="row" className="px-3 py-1.5 font-normal">{c}</th> : <td key={j} className="px-3 py-1.5 tabular-nums">{typeof c === "number" ? fmtNum(c) : c}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legenda">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-5" style={{ background: i.dashed ? "transparent" : i.color, borderTop: i.dashed ? `2px dashed ${i.color}` : undefined, height: i.dashed ? 0 : 10, borderRadius: 2 }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Tren: pengaduan masuk (garis penuh + area) dan ditutup (garis putus-putus). */
export function TrendChart({ points, unit }: { points: { date: string; created: number; closed: number }[]; unit: "day" | "week" }) {
  const W = 640, H = 240, P = { l: 40, r: 14, t: 14, b: 32 };
  const max = niceMax(Math.max(1, ...points.flatMap((p) => [p.created, p.closed])));
  const x = (i: number) => P.l + (points.length <= 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (points.length - 1));
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const line = (k: "created" | "closed") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  const area = points.length ? `${line("created")} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : "";
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const step = Math.max(1, Math.ceil(points.length / 6));
  const lab = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
  const total = points.reduce((n, p) => n + p.created, 0);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Grafik tren pengaduan per ${unit === "day" ? "hari" : "pekan"}: total ${total} pengaduan masuk`} className="h-auto w-full text-muted">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke={AXIS} strokeOpacity={0.15} />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={AXIS}>{fmtNum(Math.round(t))}</text>
          </g>
        ))}
        <path d={area} fill="#0072B2" fillOpacity={0.12} />
        <path d={line("created")} fill="none" stroke="#0072B2" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={line("closed")} fill="none" stroke="#009E73" strokeWidth="2.5" strokeDasharray="6 4" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.date}>
            <circle cx={x(i)} cy={y(p.created)} r={points.length > 40 ? 0 : 3.5} fill="#0072B2" />
            <circle cx={x(i)} cy={y(p.created)} r={10} fill="transparent"><title>{`${lab(p.date)}: ${p.created} masuk, ${p.closed} ditutup`}</title></circle>
            {i % step === 0 && <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10.5" fill={AXIS}>{lab(p.date)}</text>}
          </g>
        ))}
      </svg>
      <Legend items={[{ label: "Masuk", color: "#0072B2" }, { label: "Ditutup", color: "#009E73", dashed: true }]} />
      <ChartTable caption="Tren pengaduan" head={[unit === "day" ? "Tanggal" : "Awal pekan", "Masuk", "Ditutup"]} rows={points.map((p) => [lab(p.date), p.created, p.closed])} />
    </>
  );
}

/** Batang horizontal berlabel dengan warna per baris. */
export function HBars({ rows, unit = "", emptyText = "Belum ada data." }: { rows: { label: string; value: number; color: string; sub?: string }[]; unit?: string; emptyText?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">{emptyText}</p>;
  return (
    <>
      <ul className="flex flex-col gap-3" aria-label="Batang perbandingan">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{r.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">{fmtNum(r.value)}{unit}{r.sub ? <span className="ml-1 font-normal text-muted">{r.sub}</span> : null}</span>
            </div>
            <div className="h-3 rounded-full bg-surface-2" role="presentation">
              <div className="h-3 rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: r.color }} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Donat proporsi. Tengah menampilkan total; legenda memuat angka dan persen. */
export function Donut({ parts, centerLabel }: { parts: { label: string; value: number; color: string }[]; centerLabel: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  const visible = parts.filter((p) => p.value > 0);
  const offsets = visible.map((_, i) => visible.slice(0, i).reduce((n, q) => n + (q.value / total) * C, 0));
  if (!total) return <p className="py-6 text-center text-sm text-muted">Belum ada data.</p>;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 140 140" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")} className="h-40 w-40 shrink-0 text-muted">
        <g transform="rotate(-90 70 70)">
          <circle cx="70" cy="70" r={R} fill="none" stroke={AXIS} strokeOpacity={0.1} strokeWidth="18" />
          {visible.map((p, i) => {
            const len = (p.value / total) * C;
            return <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offsets[i]}><title>{`${p.label}: ${p.value}`}</title></circle>;
          })}
        </g>
        <text x="70" y="70" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--text)">{fmtNum(total)}</text>
        <text x="70" y="88" textAnchor="middle" fontSize="10" fill={AXIS}>{centerLabel}</text>
      </svg>
      <ul className="min-w-0 flex-[1_1_12rem] space-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-2"><span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ background: p.color }} /><span className="truncate">{p.label}</span></span>
            <span className="shrink-0 tabular-nums">{fmtNum(p.value)} <span className="text-muted">({fmtNum(total ? (p.value / total) * 100 : 0, 1)}%)</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kolom vertikal sederhana (hari dalam pekan, jam dalam sehari). */
export function Columns({ items, label, highlight }: { items: { label: string; value: number }[]; label: string; highlight?: number }) {
  const W = 640, H = 170, P = { l: 8, r: 8, t: 14, b: 26 };
  const max = Math.max(1, ...items.map((i) => i.value));
  const bw = (W - P.l - P.r) / items.length;
  const top = items.reduce((b, i, idx) => (i.value > items[b].value ? idx : b), 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: puncak ${items[top]?.label ?? "-"} (${items[top]?.value ?? 0})`} className="h-auto w-full text-muted">
      <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} stroke={AXIS} strokeOpacity={0.3} />
      {items.map((it, i) => {
        const h = (it.value / max) * (H - P.t - P.b);
        const isTop = it.value > 0 && i === (highlight ?? top);
        return (
          <g key={it.label}>
            <rect x={P.l + i * bw + bw * 0.15} y={H - P.b - h} width={bw * 0.7} height={Math.max(h, it.value ? 2 : 0)} rx="3" fill={isTop ? "#D55E00" : "#0072B2"} fillOpacity={isTop ? 1 : 0.75}>
              <title>{`${it.label}: ${it.value}`}</title>
            </rect>
            {it.value > 0 && bw > 24 && <text x={P.l + i * bw + bw / 2} y={H - P.b - h - 4} textAnchor="middle" fontSize="10.5" fill="var(--text)">{it.value}</text>}
            <text x={P.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize={items.length > 12 ? 9 : 11} fill={AXIS}>{items.length > 12 ? (i % 3 === 0 ? it.label : "") : it.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Matriks wilayah x kategori dengan intensitas warna sel (angka selalu tertulis, jadi tidak bergantung warna). */
export function Matrix({ categories, rows }: { categories: { id: string; name: string; color: number }[]; rows: { slug: string; name: string; counts: number[] }[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => r.counts));
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">Belum ada data wilayah.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border" tabIndex={0} role="region" aria-label="Tabel wilayah dan kategori">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <caption className="sr-only">Jumlah pengaduan per wilayah dan kategori</caption>
        <thead className="bg-surface-2">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Wilayah</th>
            {categories.map((c) => (
              <th key={c.id} scope="col" className="px-3 py-2 text-right font-medium">
                <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm" style={{ background: categoryColor(c.color) }} />{c.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slug} className="border-t border-border">
              <th scope="row" className="px-3 py-1.5 font-normal">{r.name}</th>
              {r.counts.map((n, i) => (
                <td key={i} className="px-3 py-1.5 text-right tabular-nums" style={{ background: n ? `color-mix(in srgb, ${categoryColor(categories[i].color)} ${Math.round(12 + (n / max) * 38)}%, transparent)` : undefined }}>{fmtNum(n)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

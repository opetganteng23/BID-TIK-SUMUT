"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { categoryColor } from "@/lib/regions";

export type MapRegion = { slug: string; name: string; lat: number; lng: number; count: number; open: number; topCategoryName: string; topCategoryColor: number };

/**
 * Peta sebaran pengaduan. Lingkaran sebesar jumlah pengaduan di tiap kabupaten/kota, berwarna menurut
 * kategori dominan. Posisi adalah titik perkiraan pusat wilayah, bukan batas administratif.
 */
export function ComplaintMap({ regions, categories, onPick }: { regions: MapRegion[]; categories: { id: string; name: string; color: number }[]; onPick?: (slug: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let alive = true;
    void import("leaflet").then((L) => {
      if (!alive || !el.current) return;
      if (!map.current) {
        map.current = L.map(el.current, { scrollWheelZoom: false, attributionControl: true, minZoom: 6, maxZoom: 11 }).setView([2.2, 98.9], 7);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 11, attribution: "&copy; OpenStreetMap" }).addTo(map.current);
      }
      layer.current?.remove();
      const g = L.layerGroup().addTo(map.current);
      const max = Math.max(1, ...regions.map((r) => r.count));
      for (const r of regions) {
        const c = L.circleMarker([r.lat, r.lng], {
          radius: 7 + 24 * Math.sqrt(r.count / max),
          color: "#ffffff",
          weight: 2,
          fillColor: categoryColor(r.topCategoryColor),
          fillOpacity: 0.85,
        }).addTo(g);
        c.bindTooltip(`<b>${r.name}</b><br>${r.count} pengaduan (${r.open} terbuka)<br>Terbanyak: ${r.topCategoryName}`);
        if (onPick) c.on("click", () => onPick(r.slug));
      }
      layer.current = g;
    });
    return () => {
      alive = false;
    };
  }, [regions, onPick]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return (
    <div>
      <div
        ref={el}
        className="relative isolate z-0 h-[360px] w-full overflow-hidden rounded-xl border border-border sm:h-[440px]"
        role="img"
        aria-label={`Peta sebaran pengaduan di Sumatera Utara. ${regions.length} wilayah memiliki pengaduan; terbanyak ${regions[0]?.name ?? "-"}.`}
      />
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legenda warna kategori">
        {categories.map((c) => (
          <li key={c.id} className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block size-3 rounded-full" style={{ background: categoryColor(c.color) }} />{c.name}</li>
        ))}
        <li className="text-muted">Ukuran lingkaran = jumlah pengaduan. Warna = kategori terbanyak di wilayah itu. Posisi perkiraan.</li>
      </ul>
    </div>
  );
}

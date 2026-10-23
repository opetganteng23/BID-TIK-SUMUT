/**
 * Kabupaten/kota di Sumatera Utara (33 wilayah). Koordinat adalah titik PERKIRAAN pusat wilayah
 * (dibulatkan 2 desimal) dan hanya dipakai untuk menempatkan lingkaran pada peta sebaran, bukan batas wilayah.
 */
export type Region = { slug: string; name: string; kind: "Kota" | "Kabupaten"; lat: number; lng: number };

const r = (slug: string, name: string, kind: Region["kind"], lat: number, lng: number): Region => ({ slug, name, kind, lat, lng });

export const REGIONS: readonly Region[] = [
  r("medan", "Kota Medan", "Kota", 3.59, 98.67),
  r("binjai", "Kota Binjai", "Kota", 3.6, 98.49),
  r("tebing-tinggi", "Kota Tebing Tinggi", "Kota", 3.33, 99.16),
  r("pematangsiantar", "Kota Pematangsiantar", "Kota", 2.96, 99.06),
  r("tanjungbalai", "Kota Tanjungbalai", "Kota", 2.97, 99.8),
  r("sibolga", "Kota Sibolga", "Kota", 1.74, 98.78),
  r("padangsidimpuan", "Kota Padangsidimpuan", "Kota", 1.37, 99.27),
  r("gunungsitoli", "Kota Gunungsitoli", "Kota", 1.29, 97.61),
  r("deli-serdang", "Kabupaten Deli Serdang", "Kabupaten", 3.55, 98.87),
  r("langkat", "Kabupaten Langkat", "Kabupaten", 3.76, 98.45),
  r("karo", "Kabupaten Karo", "Kabupaten", 3.1, 98.49),
  r("simalungun", "Kabupaten Simalungun", "Kabupaten", 2.95, 99.0),
  r("asahan", "Kabupaten Asahan", "Kabupaten", 2.98, 99.62),
  r("labuhanbatu", "Kabupaten Labuhanbatu", "Kabupaten", 2.1, 99.83),
  r("labuhanbatu-utara", "Kabupaten Labuhanbatu Utara", "Kabupaten", 2.35, 99.7),
  r("labuhanbatu-selatan", "Kabupaten Labuhanbatu Selatan", "Kabupaten", 1.75, 100.1),
  r("batu-bara", "Kabupaten Batu Bara", "Kabupaten", 3.17, 99.52),
  r("serdang-bedagai", "Kabupaten Serdang Bedagai", "Kabupaten", 3.37, 99.0),
  r("dairi", "Kabupaten Dairi", "Kabupaten", 2.75, 98.31),
  r("pakpak-bharat", "Kabupaten Pakpak Bharat", "Kabupaten", 2.62, 98.28),
  r("humbang-hasundutan", "Kabupaten Humbang Hasundutan", "Kabupaten", 2.26, 98.76),
  r("samosir", "Kabupaten Samosir", "Kabupaten", 2.61, 98.69),
  r("toba", "Kabupaten Toba", "Kabupaten", 2.33, 99.07),
  r("tapanuli-utara", "Kabupaten Tapanuli Utara", "Kabupaten", 2.02, 98.96),
  r("tapanuli-tengah", "Kabupaten Tapanuli Tengah", "Kabupaten", 1.72, 98.8),
  r("tapanuli-selatan", "Kabupaten Tapanuli Selatan", "Kabupaten", 1.5, 99.2),
  r("mandailing-natal", "Kabupaten Mandailing Natal", "Kabupaten", 0.78, 99.5),
  r("padang-lawas", "Kabupaten Padang Lawas", "Kabupaten", 1.4, 99.8),
  r("padang-lawas-utara", "Kabupaten Padang Lawas Utara", "Kabupaten", 1.55, 99.95),
  r("nias", "Kabupaten Nias", "Kabupaten", 1.1, 97.7),
  r("nias-selatan", "Kabupaten Nias Selatan", "Kabupaten", 0.57, 97.8),
  r("nias-utara", "Kabupaten Nias Utara", "Kabupaten", 1.4, 97.6),
  r("nias-barat", "Kabupaten Nias Barat", "Kabupaten", 1.15, 97.45),
];

export const REGION_SLUGS = REGIONS.map((x) => x.slug) as [string, ...string[]];
export const REGION_BY_SLUG: Record<string, Region> = Object.fromEntries(REGIONS.map((x) => [x.slug, x]));
export const regionName = (slug?: string | null) => (slug && REGION_BY_SLUG[slug]?.name) || "Tidak diketahui";

/** Palet kategorik yang dapat dibedakan penderita buta warna (Okabe-Ito). Warna selalu disertai label teks. */
export const CATEGORY_COLORS = ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#D55E00", "#56B4E9", "#8C6BB1", "#7F7F7F"] as const;
export const categoryColor = (i: number) => CATEGORY_COLORS[i % CATEGORY_COLORS.length];

export const STATUS_COLORS: Record<string, string> = {
  submitted: "#7F7F7F",
  in_progress: "#0072B2",
  waiting_reporter: "#E69F00",
  awaiting_reporter_confirmation: "#8C6BB1",
  closed: "#009E73",
};

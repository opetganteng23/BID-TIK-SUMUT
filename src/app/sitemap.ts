import type { MetadataRoute } from "next";
import { getPublicSettings } from "@/lib/settings";
import { listFeatureSlugs, listNewsSlugs, listPageSlugs } from "@/lib/public-data";

export const dynamic = "force-dynamic";

// Hanya konten publik yang tampil. Draft, arsip, dan berita terjadwal yang belum tayang tidak masuk.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const settings = await getPublicSettings();
  if (!settings.seo.robotsIndex) return [];
  const [news, features, pages] = await Promise.all([listNewsSlugs(), listFeatureSlugs(), listPageSlugs()]);
  return [
    ...["", "/berita", "/fitur", "/kontak", "/pengaduan"].map((p) => ({ url: `${base}${p}` })),
    ...news.map((n) => ({ url: `${base}/berita/${n.slug}`, lastModified: n.updatedAt })),
    ...features.map((f) => ({ url: `${base}/fitur/${f.slug}`, lastModified: f.updatedAt })),
    ...pages.map((p) => ({ url: `${base}/${p.slug}`, lastModified: p.updatedAt })),
  ];
}

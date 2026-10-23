export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "berita",
  "fitur",
  "kontak",
  "pengaduan",
  "lacak-pengaduan",
  "login",
  "sitemap.xml",
  "robots.txt",
  "_next",
  "favicon.ico",
]);

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

import type { MetadataRoute } from "next";
import { getPublicSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  let index = false;
  try {
    index = (await getPublicSettings()).seo.robotsIndex;
  } catch {
    /* database belum siap: jangan diindeks */
  }
  if (!index) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/pengaduan/lacak"] },
    sitemap: `${base}/sitemap.xml`,
  };
}

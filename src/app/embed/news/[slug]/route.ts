import { connectDb } from "@/lib/db";
import { News } from "@/lib/models";
import { publicNewsFilter } from "@/lib/news-state";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";

// Halaman HTML mentah (html_raw) dilayani dari dokumen terpisah dengan CSP "sandbox" tanpa
// allow-same-origin, sehingga skripnya berjalan di origin buram dan tidak dapat menyentuh cookie
// atau API situs. Bingkai induk juga memakai atribut sandbox yang sama.
const RAW_CSP =
  "sandbox allow-scripts allow-popups; default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; " +
  "img-src https: data:; media-src https:; font-src https: data:; connect-src 'none'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com";

const HEIGHT_SCRIPT = `<script>(function(){function s(){parent.postMessage({type:"bid-embed-height",height:document.documentElement.scrollHeight},"*")}addEventListener("load",s);new ResizeObserver(s).observe(document.documentElement)})();</script>`;

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]{1,96}$/.test(slug)) return new Response("Not found", { status: 404 });
  await connectDb();
  const preview = new URL(req.url).searchParams.get("preview") === "1";
  let filter: Record<string, unknown> = { slug, ...publicNewsFilter() };
  if (preview) {
    // Pratinjau hanya untuk Super Admin (satu-satunya peran yang boleh html_raw).
    const user = await getSessionUser();
    if (!user || !can(user.role, "news.raw")) return new Response("Not found", { status: 404 });
    filter = { slug };
  }
  const doc = await News.findOne({ ...filter, contentMode: "html_raw" }, "rawHtml").lean();
  if (!doc?.rawHtml) return new Response("Not found", { status: 404 });
  return new Response(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${doc.rawHtml}${HEIGHT_SCRIPT}</body></html>`, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": RAW_CSP,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "cache-control": preview ? "private, no-store" : "public, max-age=60",
    },
  });
}

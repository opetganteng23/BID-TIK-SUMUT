import type { Metadata } from "next";
import Link from "next/link";
import { Container, EmptyState, LinkButton, cx } from "@/components/ui";
import { NewsCardView } from "@/components/site/Cards";
import { getNewsCategories, listNews } from "@/lib/public-data";

export const metadata: Metadata = { title: "Berita", alternates: { canonical: "/berita" } };

const PAGE_SIZE = 9;

export default async function NewsIndex(props: PageProps<"/berita">) {
  const sp = await props.searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(str(sp.page), 10) || 1));
  const category = str(sp.kategori).slice(0, 100);
  const q = str(sp.q).slice(0, 100);

  const [{ items, total }, categories] = await Promise.all([listNews({ limit: PAGE_SIZE, page, category: category || undefined, q: q || undefined }), getNewsCategories()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number, c = category) => {
    const u = new URLSearchParams();
    if (c) u.set("kategori", c);
    if (q) u.set("q", q);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `/berita${s ? `?${s}` : ""}`;
  };
  const chip = (on: boolean) => cx("inline-flex min-h-11 items-center rounded-full border-2 px-5 text-sm font-medium", on ? "border-fg bg-primary text-primary-fg" : "border-border hover:bg-surface-2");

  return (
    <Container className="pb-8 pt-28">
      <h1 className="text-4xl md:text-5xl">Berita</h1>

      <form action="/berita" method="get" role="search" className="mt-8 flex flex-wrap gap-3">
        <label htmlFor="q" className="sr-only">Cari judul berita</label>
        <input id="q" name="q" defaultValue={q} placeholder="Cari judul berita" maxLength={100} className="min-h-11 min-w-0 flex-1 rounded-full border-2 border-border bg-surface px-5" />
        {category && <input type="hidden" name="kategori" value={category} />}
        <button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-fg">Cari</button>
      </form>

      <nav aria-label="Filter kategori berita" className="mt-4 flex flex-wrap gap-2">
        <Link href={href(1, "")} className={chip(!category)} aria-current={!category ? "page" : undefined}>Semua</Link>
        {categories.map((c) => (
          <Link key={c._id} href={href(1, c.slug)} className={chip(category === c.slug)} aria-current={category === c.slug ? "page" : undefined}>{c.name}</Link>
        ))}
      </nav>

      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyState title="Belum ada berita">Tidak ada berita yang cocok. Coba ubah kata kunci atau kategori.</EmptyState>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((n) => (
              <li key={n._id} className="relative"><NewsCardView n={n} /></li>
            ))}
          </ul>
        )}
      </div>

      {pages > 1 && (
        <nav aria-label="Paginasi" className="mt-10 flex items-center justify-between">
          {page > 1 ? <LinkButton href={href(page - 1)} variant="secondary">Sebelumnya</LinkButton> : <span />}
          <span className="text-sm text-muted">Halaman {page} dari {pages}</span>
          {page < pages ? <LinkButton href={href(page + 1)} variant="secondary">Berikutnya</LinkButton> : <span />}
        </nav>
      )}
    </Container>
  );
}

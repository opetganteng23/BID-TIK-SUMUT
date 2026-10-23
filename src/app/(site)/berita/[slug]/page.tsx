/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { NewsCardView, SectionHeading } from "@/components/site/Cards";
import { ListenButton, RawHtmlFrame, ShareButtons } from "@/components/site/ArticleTools";
import { getNewsBySlug, getRelatedNews } from "@/lib/public-data";
import { getPublicSettings } from "@/lib/settings";
import { formatDate } from "@/components/api";

type Props = PageProps<"/berita/[slug]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const n = await getNewsBySlug(slug);
  if (!n) return { title: "Berita tidak ditemukan" };
  const title = n.seo?.title || n.title;
  const description = n.seo?.description || n.excerpt;
  const image = n.seo?.ogImage || n.coverImage;
  return {
    title,
    description,
    alternates: { canonical: `/berita/${n.slug}` },
    openGraph: { type: "article", title, description, publishedTime: n.publishedAt, images: image ? [image] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function NewsDetailPage(props: Props) {
  const { slug } = await props.params;
  const n = await getNewsBySlug(slug);
  if (!n) notFound();
  const [related, settings] = await Promise.all([getRelatedNews(n._id, n.category?._id), getPublicSettings()]);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        headline: n.title,
        datePublished: n.publishedAt,
        author: { "@type": "Person", name: n.authorNameSnapshot || settings.orgName || settings.siteName },
        publisher: { "@type": "Organization", name: settings.orgName || settings.siteName },
        image: n.coverImage ? [n.coverImage] : undefined,
        mainEntityOfPage: `${base}/berita/${n.slug}`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Beranda", item: `${base}/` },
          { "@type": "ListItem", position: 2, name: "Berita", item: `${base}/berita` },
          { "@type": "ListItem", position: 3, name: n.title },
        ],
      },
    ],
  };

  return (
    <Container className="pb-8 pt-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article>
        <header className="max-w-3xl">
          <p className="mb-3 text-sm text-muted">
            {n.category && <span className="mr-3 rounded-full border border-border px-2.5 py-0.5 font-medium">{n.category.name}</span>}
            <time dateTime={n.publishedAt}>{formatDate(n.publishedAt, true)}</time>
            {n.authorNameSnapshot && <span> &middot; {n.authorNameSnapshot}</span>}
          </p>
          <h1 className="text-4xl md:text-5xl">{n.title}</h1>
          <div className="mt-6 flex flex-wrap items-center gap-3" data-tts-skip>
            <ListenButton targetId="isi-berita" />
            <ShareButtons title={n.title} />
          </div>
        </header>

        {n.coverImage && (
          <figure className="mt-8">
            <img src={n.coverImage} alt={n.coverAlt ?? ""} className="w-full max-w-4xl rounded-[20px] object-cover" />
          </figure>
        )}

        <div id="isi-berita" className="mt-8">
          {n.contentMode === "html_raw" ? (
            <RawHtmlFrame src={`/embed/news/${n.slug}`} title={`Isi berita: ${n.title}`} />
          ) : (
            <div className="prose-article" dangerouslySetInnerHTML={{ __html: n.contentHtml ?? "" }} />
          )}
        </div>

        {n.media && n.media.length > 0 && (
          <section className="mt-10" aria-label="Galeri media">
            <ul className="grid gap-4 sm:grid-cols-2">
              {n.media.map((m, i) => (
                <li key={i}>
                  <figure>
                    {m.type === "image" && <img src={m.url} alt={m.alt ?? ""} loading="lazy" className="w-full rounded-card object-cover" />}
                    {m.type === "video" && <video src={m.url} controls preload="metadata" className="w-full rounded-card" />}
                    {m.type === "embed" && <iframe src={m.url} title={m.alt || "Video"} loading="lazy" allowFullScreen className="aspect-video w-full rounded-card border-0" />}
                    {m.caption && <figcaption className="mt-2 text-sm text-muted">{m.caption}</figcaption>}
                  </figure>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      {related.length > 0 && (
        <section className="mt-20" aria-labelledby="terkait">
          <h2 id="terkait" className="sr-only">Berita terkait</h2>
          <SectionHeading title="Berita terkait" />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r._id} className="relative"><NewsCardView n={r} /></li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}

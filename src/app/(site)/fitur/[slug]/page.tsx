/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { Container, LinkButton } from "@/components/ui";
import { FeatureCardView, FeatureIcon, SectionHeading } from "@/components/site/Cards";
import { getFeatureBySlug } from "@/lib/public-data";

type Props = PageProps<"/fitur/[slug]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const f = await getFeatureBySlug(slug);
  if (!f) return { title: "Fitur tidak ditemukan" };
  return {
    title: f.seo?.title || f.title,
    description: f.seo?.description || f.summary,
    alternates: { canonical: `/fitur/${f.slug}` },
    openGraph: { images: f.seo?.ogImage || f.heroImage ? [f.seo?.ogImage || f.heroImage] : undefined },
  };
}

export default async function FeatureDetail(props: Props) {
  const { slug } = await props.params;
  const f = await getFeatureBySlug(slug);
  if (!f) notFound();
  return (
    <Container className="pb-8 pt-28">
      <article>
        <header className="max-w-3xl">
          <span className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-surface-2">
            <FeatureIcon name={f.icon} className="size-7" />
          </span>
          {f.category && <p className="text-sm text-muted">{f.category.name}</p>}
          <h1 className="text-4xl md:text-5xl">{f.title}</h1>
          {f.summary && <p className="mt-4 text-lg text-muted">{f.summary}</p>}
        </header>

        {f.heroImage && <img src={f.heroImage} alt={f.heroAlt ?? ""} className="mt-8 w-full max-w-4xl rounded-[20px] object-cover" />}

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
          <div className="prose-article" dangerouslySetInnerHTML={{ __html: f.contentHtml ?? "" }} />
          {f.highlights?.length > 0 && (
            <aside aria-label="Poin utama" className="h-fit rounded-card border border-border bg-surface p-5">
              <h2 className="mb-3 text-lg">Poin utama</h2>
              <ul className="space-y-2 text-sm">
                {f.highlights.map((h: string) => (
                  <li key={h} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />{h}</li>
                ))}
              </ul>
            </aside>
          )}
        </div>

        {f.gallery?.length > 0 && (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Galeri">
            {f.gallery.map((g: { url: string; alt: string }) => (
              <li key={g.url}><img src={g.url} alt={g.alt} loading="lazy" className="w-full rounded-card object-cover" /></li>
            ))}
          </ul>
        )}

        {f.cta?.label && f.cta.href && <div className="mt-10"><LinkButton href={f.cta.href}>{f.cta.label}</LinkButton></div>}
      </article>

      {f.related?.length > 0 && (
        <section className="mt-20" aria-labelledby="fitur-terkait">
          <h2 id="fitur-terkait" className="sr-only">Fitur terkait</h2>
          <SectionHeading title="Fitur terkait" />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {f.related.map((r: { _id: string; slug: string; title: string; summary?: string; icon?: string }) => (
              <li key={r._id}><FeatureCardView f={r} /></li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}

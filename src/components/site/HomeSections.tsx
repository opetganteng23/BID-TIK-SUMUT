/* eslint-disable @next/next/no-img-element */
import { Container, EmptyState } from "@/components/ui";
import { NewsCardView, SectionHeading } from "@/components/site/Cards";
import { FeaturesBrowser } from "@/components/site/FeaturesBrowser";
import { HeroCarousel } from "@/components/site/HeroCarousel";
import { getAbout, getFeatureCategories, getHeroSlides, listFeatures, listNews } from "@/lib/public-data";
import type { PublicSettings } from "@/lib/settings";

type Section = PublicSettings["sections"][number];

export async function HeroSection() {
  const slides = await getHeroSlides();
  if (slides.length === 0) {
    return (
      <section className="bg-cloud pt-36 pb-16">
        <Container>
          <h1 className="text-4xl md:text-6xl">Selamat datang</h1>
          <p className="mt-4 max-w-2xl text-muted">Slide hero belum diatur. Admin dapat menambahkannya dari panel admin.</p>
        </Container>
      </section>
    );
  }
  return <HeroCarousel slides={slides} />;
}

export async function AboutSection({ section }: { section: Section }) {
  const about = await getAbout();
  if (!about || (!about.body && !about.image)) return null;
  return (
    <section id="tentang" className="py-20" aria-labelledby="about-title">
      <Container className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <h2 id="about-title" className="text-3xl md:text-4xl">{about.title || section.title}</h2>
          {section.subtitle && <p className="mt-2 text-muted">{section.subtitle}</p>}
          <div className="prose-article mt-6" dangerouslySetInnerHTML={{ __html: about.body }} />
          {about.stats?.length > 0 && (
            <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {about.stats.map((s: { value: string; label: string }) => (
                <div key={s.label} className="rounded-card border border-border bg-surface p-4">
                  <dt className="text-sm text-muted">{s.label}</dt>
                  <dd className="text-3xl font-semibold">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {about.image && <img src={about.image} alt={about.imageAlt ?? ""} loading="lazy" className="w-full rounded-[20px] object-cover shadow-[var(--shadow)]" />}
      </Container>
    </section>
  );
}

export async function NewsSection({ section, count, category }: { section: Section; count: number; category?: string }) {
  const { items } = await listNews({ limit: count, category });
  return (
    <section id="berita" className="bg-cloud py-20" aria-labelledby="news-title">
      <Container>
        <div id="news-title" className="sr-only">{section.title}</div>
        <SectionHeading title={section.title || "Berita Terbaru"} subtitle={section.subtitle} href="/berita" />
        {items.length === 0 ? (
          <EmptyState title="Belum ada berita">Berita yang diterbitkan akan tampil di sini.</EmptyState>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((n) => (
              <li key={n._id} className="relative">
                <NewsCardView n={n} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}

export async function FeaturesSection({ section }: { section: Section }) {
  const [features, categories] = await Promise.all([listFeatures(), getFeatureCategories()]);
  return (
    <section id="fitur" className="py-20" aria-labelledby="features-title">
      <Container>
        <div id="features-title" className="sr-only">{section.title}</div>
        <SectionHeading title={section.title || "Fitur"} subtitle={section.subtitle} href="/fitur" />
        <FeaturesBrowser features={features} categories={categories} />
      </Container>
    </section>
  );
}

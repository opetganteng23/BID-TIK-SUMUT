/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import * as Lucide from "lucide-react";
import { PlayCircle, Newspaper } from "lucide-react";
import type { NewsCard } from "@/lib/public-data";
import { formatDate } from "@/components/api";

export function NewsCardView({ n }: { n: NewsCard }) {
  const hasVideo = n.media?.some((m) => m.type !== "image");
  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-[var(--shadow)]">
      <Link href={`/berita/${n.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-surface-2" tabIndex={-1} aria-hidden>
        {n.coverImage ? (
          <img src={n.coverImage} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <span className="flex size-full items-center justify-center text-muted">
            <Newspaper className="size-10" aria-hidden />
          </span>
        )}
        {hasVideo && <PlayCircle className="absolute bottom-3 right-3 size-8 text-white drop-shadow" aria-hidden />}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {n.category && <span className="rounded-full border border-border px-2.5 py-0.5 font-medium">{n.category.name}</span>}
          <time dateTime={n.publishedAt}>{formatDate(n.publishedAt)}</time>
        </div>
        <h3 className="text-xl leading-snug">
          <Link href={`/berita/${n.slug}`} className="after:absolute after:inset-0 hover:underline">
            {n.title}
          </Link>
        </h3>
        {n.excerpt && <p className="line-clamp-3 text-sm text-muted">{n.excerpt}</p>}
      </div>
    </article>
  );
}

type Icons = Record<string, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>>;

export function FeatureIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (Lucide as unknown as Icons)[name ?? ""] ?? Lucide.Sparkles;
  return <Icon className={className} aria-hidden />;
}

export function FeatureCardView({ f }: { f: { slug: string; title: string; summary?: string; icon?: string } }) {
  return (
    <article className="relative flex flex-col gap-3 rounded-card border border-border bg-surface p-6 shadow-[var(--shadow)]">
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-surface-2">
        <FeatureIcon name={f.icon} className="size-6" />
      </span>
      <h3 className="text-xl">{f.title}</h3>
      {f.summary && <p className="text-sm text-muted">{f.summary}</p>}
      <Link href={`/fitur/${f.slug}`} className="mt-auto inline-flex min-h-11 items-center gap-1 text-sm font-medium underline underline-offset-4 after:absolute after:inset-0" aria-label={`More Detail: ${f.title}`}>
        More Detail <Lucide.ArrowRight className="size-4" aria-hidden />
      </Link>
    </article>
  );
}

export function SectionHeading({ title, subtitle, href, hrefLabel }: { title: string; subtitle?: string; href?: string; hrefLabel?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-3xl md:text-4xl">{title}</h2>
        {subtitle && <p className="mt-2 max-w-2xl text-muted">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline underline-offset-4">
          {hrefLabel ?? "Lihat semua"} <Lucide.ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NewsCardView } from "@/components/site/Cards";
import type { NewsCard } from "@/lib/public-data";

/**
 * Slider berita yang dapat digeser ke samping (drag/swipe, tombol, dan panah keyboard).
 * 1 kartu per layar di ponsel, 2 di tablet, 3 di desktop. Tanpa putar otomatis, jadi aman untuk "kurangi animasi".
 */
export function NewsCarousel({ items }: { items: NewsCard[] }) {
  const [ref, embla] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps", slidesToScroll: 1 });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [index, setIndex] = useState(0);

  const sync = useCallback(() => {
    if (!embla) return;
    setCanPrev(embla.canScrollPrev());
    setCanNext(embla.canScrollNext());
    setIndex(embla.selectedScrollSnap());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    const t = setTimeout(sync, 0);
    embla.on("select", sync).on("reInit", sync);
    return () => {
      clearTimeout(t);
      embla.off("select", sync).off("reInit", sync);
    };
  }, [embla, sync]);

  const btn = "inline-flex size-11 items-center justify-center rounded-full border-2 border-border bg-surface hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40";
  const snaps = embla?.scrollSnapList().length ?? items.length;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Slider berita"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") embla?.scrollPrev();
        if (e.key === "ArrowRight") embla?.scrollNext();
      }}
    >
      <div className="overflow-hidden" ref={ref}>
        <div className="-ml-6 flex touch-pan-y">
          {items.map((n, i) => (
            <div
              key={n._id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} dari ${items.length}`}
              className="relative flex min-w-0 flex-[0_0_100%] pl-6 sm:flex-[0_0_50%] lg:flex-[0_0_33.3333%]"
            >
              <NewsCardView n={n} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2" role="group" aria-label="Kontrol slider berita">
          <button type="button" className={btn} onClick={() => embla?.scrollPrev()} disabled={!canPrev} aria-label="Berita sebelumnya">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button type="button" className={btn} onClick={() => embla?.scrollNext()} disabled={!canNext} aria-label="Berita berikutnya">
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
        <p className="text-sm text-muted" aria-live="polite">
          {Math.min(index + 1, snaps)} / {snaps}
        </p>
      </div>
    </div>
  );
}

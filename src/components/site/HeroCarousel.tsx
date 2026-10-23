"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cx } from "@/components/ui";

type Slide = {
  _id: string;
  mediaType: "image" | "video" | "embed";
  image?: string;
  videoUrl?: string;
  embedUrl?: string;
  poster?: string;
  title: string;
  description?: string;
  alt?: string;
  ctas?: { label: string; href: string; style: "primary" | "secondary" }[];
};

export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [reduced, setReduced] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [index, setIndex] = useState(0);
  const [emblaRef, embla] = useEmblaCarousel({ loop: slides.length > 1 }, [Autoplay({ delay: 6000, stopOnMouseEnter: true, stopOnFocusIn: true, stopOnInteraction: false, playOnInit: false })]);

  useEffect(() => {
    const read = () => setReduced(document.documentElement.dataset.motion === "reduce");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  // Autoplay mati total bila "kurangi animasi" aktif.
  useEffect(() => {
    const ap = embla?.plugins().autoplay;
    if (!ap) return;
    if (playing && !reduced && slides.length > 1) ap.play();
    else ap.stop();
  }, [embla, playing, reduced, slides.length]);

  const prev = useCallback(() => embla?.scrollPrev(), [embla]);
  const next = useCallback(() => embla?.scrollNext(), [embla]);

  return (
    <section aria-roledescription="carousel" aria-label="Sorotan utama" className="relative min-h-[560px] bg-cloud" style={{ height: "min(100svh, 820px)" }}>
      <div className="h-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {slides.map((s, i) => (
            <div key={s._id} className="relative h-full min-w-0 flex-[0_0_100%]" role="group" aria-roledescription="slide" aria-label={`${i + 1} dari ${slides.length}`} aria-hidden={i !== index}>
              {s.mediaType === "image" && s.image && <img src={s.image} alt={s.alt ?? ""} className="absolute inset-0 size-full object-cover" loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"} />}
              {s.mediaType === "video" && s.videoUrl && (
                <video className="absolute inset-0 size-full object-cover" src={s.videoUrl} poster={s.poster} preload="metadata" muted playsInline loop autoPlay={!reduced && i === index} aria-hidden />
              )}
              {s.mediaType === "embed" && s.embedUrl && (
                <iframe className="absolute inset-0 size-full" src={s.embedUrl} title={s.alt || s.title} loading="lazy" allowFullScreen />
              )}
              {/* Scrim gradien monokrom agar kontras teks terjaga */}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
              <div className="relative mx-auto flex h-full max-w-[1200px] flex-col justify-end px-4 pb-24 pt-32 text-white md:px-6">
                <h2 className="max-w-3xl text-4xl md:text-6xl">{s.title}</h2>
                {s.description && <p className="mt-4 max-w-2xl text-lg text-white/90">{s.description}</p>}
                {s.ctas && s.ctas.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {s.ctas.map((c) => (
                      <Link
                        key={c.label}
                        href={c.href}
                        tabIndex={i === index ? 0 : -1}
                        className={cx(
                          "inline-flex min-h-11 items-center rounded-full px-6 text-sm font-medium",
                          c.style === "primary" ? "bg-white text-black hover:bg-white/90" : "border-2 border-white text-white hover:bg-white/15",
                        )}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-6 z-10 mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 text-white md:px-6">
          <div className="flex items-center gap-2" role="group" aria-label="Kontrol carousel">
            <button type="button" onClick={prev} className="inline-flex size-11 items-center justify-center rounded-full border-2 border-white bg-black/30 hover:bg-black/50" aria-label="Slide sebelumnya">
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button type="button" onClick={next} className="inline-flex size-11 items-center justify-center rounded-full border-2 border-white bg-black/30 hover:bg-black/50" aria-label="Slide berikutnya">
              <ChevronRight className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex size-11 items-center justify-center rounded-full border-2 border-white bg-black/30 hover:bg-black/50"
              aria-label={playing && !reduced ? "Jeda putar otomatis" : "Putar otomatis"}
              disabled={reduced}
            >
              {playing && !reduced ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
            </button>
          </div>
          <div className="flex flex-wrap items-center" role="group" aria-label="Pilih slide">
            {slides.map((s, i) => (
              <button key={s._id} type="button" onClick={() => embla?.scrollTo(i)} aria-label={`Ke slide ${i + 1}`} aria-current={i === index} className="inline-flex size-11 items-center justify-center">
                <span className={cx("block h-2.5 rounded-full border border-white transition-all", i === index ? "w-8 bg-white" : "w-2.5 bg-transparent")} />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

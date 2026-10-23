/* eslint-disable @next/next/no-img-element */
import type { PublicSettings } from "@/lib/settings";

type M = PublicSettings["marquees"][number];

function Item({ item }: { item: M["items"][number] }) {
  const inner =
    item.type === "logo" && item.logo ? (
      <img src={item.logo} alt={item.alt ?? ""} className="h-8 w-auto grayscale" loading="lazy" />
    ) : (
      <span className="whitespace-nowrap text-sm font-medium uppercase tracking-wide">{item.text}</span>
    );
  return (
    <li className="flex shrink-0 items-center px-8">
      {item.href ? (
        <a href={item.href} className="inline-flex min-h-11 items-center">
          {inner}
        </a>
      ) : (
        inner
      )}
    </li>
  );
}

/**
 * Pita berjalan tanpa putus: daftar digandakan. Salinan visual aria-hidden, daftar asli tetap
 * terbaca pembaca layar. Berhenti saat hover/fokus. Dengan "kurangi animasi" menjadi baris statis.
 */
export function Marquee({ marquee }: { marquee: M }) {
  if (!marquee.enabled || marquee.items.length === 0) return null;
  const dur = Math.max(10, (marquee.items.length * 220) / marquee.speed);
  const animation = marquee.direction === "right" ? "marquee-right" : "marquee-left";
  return (
    <section aria-label="Informasi berjalan" className="group/mq border-y border-border bg-cloud" style={{ height: marquee.height }}>
      <div className="relative flex h-full items-center overflow-hidden [[data-motion=reduce]_&]:overflow-x-auto">
        <div
          className="flex w-max items-center group-hover/mq:[animation-play-state:paused] group-focus-within/mq:[animation-play-state:paused] [[data-motion=reduce]_&]:!animate-none"
          style={{ animation: `${animation} ${dur}s linear infinite` }}
        >
          <ul className="flex items-center">
            {marquee.items.map((it, i) => (
              <Item key={i} item={it} />
            ))}
          </ul>
          <ul className="flex items-center [[data-motion=reduce]_&]:hidden" aria-hidden="true">
            {marquee.items.map((it, i) => (
              <Item key={i} item={{ ...it, href: undefined }} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

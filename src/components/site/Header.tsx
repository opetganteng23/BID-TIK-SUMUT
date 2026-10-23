"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { A11yWidget } from "@/components/site/A11yWidget";
import { Brand } from "@/components/site/Brand";
import type { PublicSettings } from "@/lib/settings";
import { cx } from "@/components/ui";

type Item = PublicSettings["menu"][number];

function NavLink({ item, className }: { item: Item["children"][number]; className?: string }) {
  return (
    <Link href={item.href} className={className} {...(item.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {item.label}
    </Link>
  );
}

export function Header({ settings }: { settings: PublicSettings }) {
  const [scrolled, setScrolled] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const items = settings.menu.filter((m) => m.enabled);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  const link = "inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium hover:bg-surface-2";

  return (
    <header
      className={cx(
        "glass fixed inset-x-0 top-0 z-50 border-b transition-[height,box-shadow] duration-300",
        scrolled ? "h-14 shadow-[var(--shadow)]" : "h-[72px]",
      )}
    >
      <div className="mx-auto flex h-full w-full max-w-[1200px] items-center justify-between gap-2 px-4 md:px-6">
        <Brand name={settings.siteName} logoLight={settings.logoLight} logoDark={settings.logoDark} />

        <nav aria-label="Menu utama" className="hidden items-center gap-1 lg:flex">
          {items.map((item) => {
            const kids = item.children.filter((c) => c.enabled);
            if (!kids.length) return <NavLink key={item.label} item={item} className={link} />;
            return (
              <div key={item.label} className="relative">
                <button
                  type="button"
                  className={cx(link, "gap-1")}
                  aria-expanded={open === item.label}
                  aria-haspopup="true"
                  onClick={() => setOpen(open === item.label ? null : item.label)}
                >
                  {item.label}
                  <ChevronDown className="size-4" aria-hidden />
                </button>
                {open === item.label && (
                  <ul className="absolute left-0 top-full mt-2 min-w-48 rounded-card border border-border bg-surface p-2 shadow-[var(--shadow)]">
                    {kids.map((c) => (
                      <li key={c.label}>
                        <NavLink item={c} className="flex min-h-11 items-center rounded-xl px-3 text-sm hover:bg-surface-2" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <A11yWidget
            defaultTheme={settings.accessibility.defaultTheme}
            defaultFontScale={settings.accessibility.defaultFontScale}
            ttsEnabled={settings.accessibility.ttsEnabled}
            ttsLang={settings.accessibility.ttsDefaultLang}
          />
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full border-2 border-border hover:bg-surface-2 lg:hidden"
            onClick={() => drawer.current?.showModal()}
            aria-label="Buka menu"
            aria-haspopup="dialog"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Drawer mobile: <dialog> modal memberi perangkap fokus dan Esc secara native. */}
      <dialog ref={drawer} aria-label="Menu navigasi" className="m-0 ml-auto h-svh w-[min(88vw,22rem)] max-h-none border-l border-border bg-surface p-0 text-fg backdrop:bg-black/40">
        <div className="flex items-center justify-between border-b border-border p-4">
          <span className="font-semibold">Menu</span>
          <button type="button" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2" onClick={() => drawer.current?.close()} aria-label="Tutup menu">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <nav aria-label="Menu mobile" className="p-3">
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.label}>
                <NavLink item={item} className="flex min-h-11 items-center rounded-xl px-3 font-medium hover:bg-surface-2" />
                {item.children.filter((c) => c.enabled).length > 0 && (
                  <ul className="ml-4 border-l border-border pl-2">
                    {item.children.filter((c) => c.enabled).map((c) => (
                      <li key={c.label}>
                        <NavLink item={c} className="flex min-h-11 items-center rounded-xl px-3 text-sm hover:bg-surface-2" />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </header>
  );
}

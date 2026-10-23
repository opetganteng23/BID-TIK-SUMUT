"use client";

import { useState } from "react";
import { FeatureCardView } from "@/components/site/Cards";
import { EmptyState, cx } from "@/components/ui";

type F = { _id: string; slug: string; title: string; summary?: string; icon?: string; category?: { _id: string; name: string } | null };

/** Chip filter ("Semua" + kategori) dengan kartu fitur. */
export function FeaturesBrowser({ features, categories }: { features: F[]; categories: { _id: string; name: string }[] }) {
  const [cat, setCat] = useState("");
  const shown = cat ? features.filter((f) => f.category?._id === cat) : features;
  const chip = (on: boolean) => cx("inline-flex min-h-11 items-center rounded-full border-2 px-5 text-sm font-medium", on ? "border-fg bg-primary text-primary-fg" : "border-border hover:bg-surface-2");
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter kategori layanan">
        <button type="button" className={chip(cat === "")} aria-pressed={cat === ""} onClick={() => setCat("")}>
          Semua
        </button>
        {categories.map((c) => (
          <button key={c._id} type="button" className={chip(cat === c._id)} aria-pressed={cat === c._id} onClick={() => setCat(c._id)}>
            {c.name}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {shown.length === 0 ? (
          <EmptyState title="Belum ada layanan">Layanan pada kategori ini akan tampil di sini.</EmptyState>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((f) => (
              <li key={f._id}>
                <FeatureCardView f={f} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

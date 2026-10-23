"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui";

export type Dir = "asc" | "desc";
export type SortState = { sort: string; dir: Dir };

/** Status urutan tabel. Mengklik kolom yang sama membalik arah; kolom baru mulai dari menaik. */
export function useSort(initial: SortState | null = null) {
  const [state, setState] = useState<SortState | null>(initial);
  const toggle = (field: string) => setState((s) => (s?.sort === field ? { sort: field, dir: s.dir === "asc" ? "desc" : "asc" } : { sort: field, dir: "asc" }));
  const query = state ? `&sort=${encodeURIComponent(state.sort)}&dir=${state.dir}` : "";
  return { state, toggle, query, reset: () => setState(initial) };
}

/** Header kolom yang dapat diurutkan, dengan aria-sort dan tombol yang dapat dijangkau keyboard. */
export function SortTh({ label, field, state, onSort }: { label: string; field?: string; state: SortState | null; onSort: (f: string) => void }) {
  if (!field) return <th scope="col" className="px-4 py-3 font-medium">{label}</th>;
  const active = state?.sort === field;
  const Icon = !active ? ArrowUpDown : state!.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" className="px-4 py-3 font-medium" aria-sort={active ? (state!.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(field)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg font-medium hover:underline">
        {label}
        <Icon className={`size-3.5 ${active ? "" : "opacity-50"}`} aria-hidden />
        <span className="sr-only">{active ? (state!.dir === "asc" ? ", urut menaik" : ", urut menurun") : ", klik untuk mengurutkan"}</span>
      </button>
    </th>
  );
}

export function Pager({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return <p className="text-sm text-muted">{total} data</p>;
  return (
    <nav aria-label="Paginasi" className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Sebelumnya</Button>
      <span className="text-sm text-muted">Halaman {page} dari {pages} ({total} data)</span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Berikutnya</Button>
    </nav>
  );
}

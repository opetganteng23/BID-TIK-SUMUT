"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { ApiClientError, api } from "@/components/api";
import { Button, Card, Notice, TextInput } from "@/components/ui";
import { FieldInput } from "@/components/admin/ResourceManager";
import { ImageField } from "@/components/admin/MediaPicker";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

export function AboutForm({ initial }: { initial: Record<string, any> }) {
  const [v, setV] = useState({
    title: initial.title ?? "",
    body: initial.body ?? "",
    bodyJson: initial.bodyJson ?? null,
    image: initial.image ?? "",
    imageAlt: initial.imageAlt ?? "",
    stats: (initial.stats ?? []) as { value: string; label: string }[],
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const set = (p: Partial<typeof v>) => {
    setV((x) => ({ ...x, ...p }));
    setDirty(true);
    setOk("");
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/admin/about", { method: "PUT", body: { title: v.title, body: v.body, bodyJson: v.bodyJson ?? undefined, image: v.image, imageAlt: v.imageAlt, stats: v.stats } });
      setDirty(false);
      setOk("Konten About disimpan.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">About</h1>
      <Card>
        <form onSubmit={save} className="space-y-5" noValidate>
          {ok && <Notice kind="success">{ok}</Notice>}
          {error && <Notice kind="error">{error}</Notice>}
          <TextInput id="about-title" label="Judul" value={v.title} onChange={(e) => set({ title: e.target.value })} required maxLength={160} />
          <RichTextEditor id="about-body" label="Teks" html={v.body} json={v.bodyJson} onChange={(html, json) => set({ body: html, bodyJson: json })} />
          <ImageField id="about-image" label="Gambar" value={v.image} onChange={(x) => set({ image: x })} />
          <TextInput id="about-alt" label="Alt text gambar" value={v.imageAlt} onChange={(e) => set({ imageAlt: e.target.value })} maxLength={200} />
          <FieldInput
            f={{ type: "repeater", name: "stats", label: "Statistik (opsional)", max: 8, addLabel: "Tambah statistik", fields: [{ type: "text", name: "value", label: "Angka", required: true }, { type: "text", name: "label", label: "Label", required: true }] }}
            v={v}
            errors={{}}
            path="a-"
            options={{}}
            set={(p) => set(p as Partial<typeof v>)}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving}>Simpan</Button>
            <a href="/#tentang" target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">Pratinjau</a>
            {dirty && <span className="rounded-full border-2 border-dashed border-fg px-3 py-1 text-xs font-medium" role="status">Perubahan belum disimpan</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}

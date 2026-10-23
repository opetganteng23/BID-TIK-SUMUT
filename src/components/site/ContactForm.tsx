"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { ApiClientError, api } from "@/components/api";
import { Button, Notice, TextArea, TextInput } from "@/components/ui";

type State = { kind: "idle" } | { kind: "ok"; notified: boolean } | { kind: "error"; message: string; fields?: Record<string, string> };

export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setState({ kind: "idle" });
    try {
      const res = await api<{ received: boolean; notified?: boolean }>("/api/public/contact", {
        body: {
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone") || undefined,
          subject: fd.get("subject"),
          message: fd.get("message"),
          website: fd.get("website") || undefined,
        },
      });
      form.reset();
      setState({ kind: "ok", notified: res.notified !== false });
    } catch (err) {
      const e2 = err instanceof ApiClientError ? err : null;
      setState({ kind: "error", message: e2?.message ?? "Pesan gagal dikirim.", fields: e2?.fields });
      // Pindahkan fokus ke ringkasan error.
      requestAnimationFrame(() => document.getElementById("form-error")?.focus());
    } finally {
      setBusy(false);
    }
  }

  const f = state.kind === "error" ? state.fields ?? {} : {};
  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-describedby={state.kind === "error" ? "form-error" : undefined}>
      {state.kind === "error" && (
        <div id="form-error" tabIndex={-1} className="outline-none">
          <Notice kind="error">
            {state.message}
            {Object.keys(f).length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {Object.entries(f).map(([k, v]) => <li key={k}>{v}</li>)}
              </ul>
            )}
          </Notice>
        </div>
      )}
      {state.kind === "ok" && (
        <Notice kind="success">
          Pesan Anda telah kami terima. {state.notified ? "Petugas akan menindaklanjuti." : "Pesan tersimpan, namun notifikasi ke petugas tertunda."}
        </Notice>
      )}
      <TextInput id="name" label="Nama" required maxLength={100} autoComplete="name" error={f.name} />
      <TextInput id="email" label="Email" type="email" required maxLength={200} autoComplete="email" error={f.email} />
      <TextInput id="phone" label="Nomor telepon (opsional)" type="tel" maxLength={30} autoComplete="tel" error={f.phone} />
      <TextInput id="subject" label="Subjek" required maxLength={150} error={f.subject} />
      <TextArea id="message" label="Pesan" required rows={6} maxLength={3000} error={f.message} />
      {/* Honeypot: disembunyikan dari pengguna dan pembaca layar. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Jangan diisi</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <Button type="submit" loading={busy}>
        <Send className="size-4" aria-hidden /> Kirim pesan
      </Button>
    </form>
  );
}

import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Card, Container } from "@/components/ui";
import { ContactForm } from "@/components/site/ContactForm";
import { getPublicSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Kontak", alternates: { canonical: "/kontak" } };

export default async function ContactPage() {
  const { footer: f } = await getPublicSettings();
  return (
    <Container className="pb-8 pt-28">
      <h1 className="text-4xl md:text-5xl">Kontak</h1>
      <p className="mt-3 max-w-2xl text-muted">Kirim pesan kepada kami. Untuk pengaduan layanan gunakan menu Pengaduan.</p>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <Card><ContactForm /></Card>
        <aside aria-label="Informasi kontak">
          <Card>
            <ul className="space-y-4 text-sm">
              {f.address && <li className="flex gap-3"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />{f.address}</li>}
              {f.phones.map((p) => <li key={p} className="flex gap-3"><Phone className="mt-0.5 size-4 shrink-0" aria-hidden /><a className="underline underline-offset-4" href={`tel:${p.replace(/\s/g, "")}`}>{p}</a></li>)}
              {f.emails.map((e) => <li key={e} className="flex gap-3"><Mail className="mt-0.5 size-4 shrink-0" aria-hidden /><a className="underline underline-offset-4" href={`mailto:${e}`}>{e}</a></li>)}
              {f.hours && <li className="flex gap-3"><Clock className="mt-0.5 size-4 shrink-0" aria-hidden />{f.hours}</li>}
              {!f.address && f.phones.length === 0 && f.emails.length === 0 && !f.hours && <li className="text-muted">Informasi kontak belum diisi oleh admin.</li>}
            </ul>
          </Card>
        </aside>
      </div>
    </Container>
  );
}

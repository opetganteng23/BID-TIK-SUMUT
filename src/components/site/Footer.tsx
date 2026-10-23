import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { PublicSettings } from "@/lib/settings";
import { Brand } from "@/components/site/Brand";

export function Footer({ settings }: { settings: PublicSettings }) {
  const f = settings.footer;
  // Tautan cepat: dari pengaturan, atau menu utama bila belum diisi.
  const quick = f.quickLinks.length ? f.quickLinks : settings.menu.filter((m) => m.enabled).map((m) => ({ label: m.label, href: m.href }));
  const hasContact = !!(f.address || f.phones.length || f.emails.length || f.hours);
  const cols = 1 + (hasContact ? 1 : 0) + (quick.length ? 1 : 0);

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-border bg-cloud">
      {/* Lapisan awan: blur panel footer baru terlihat bila ada sesuatu di belakangnya. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="cloud left-[-5%] top-4 h-48 w-96" />
        <span className="cloud right-[5%] top-12 h-56 w-[28rem]" style={{ animationDelay: "-12s" }} />
        <span className="cloud bottom-0 left-[35%] h-44 w-[26rem]" style={{ animationDelay: "-24s" }} />
      </div>

      {/* Panel kaca selebar layar penuh dari tepi kiri sampai kanan dan menempel ke bawah halaman. */}
      <div className="glass relative w-full" style={{ backdropFilter: "blur(20px) saturate(140%)" }}>
        <div className="mx-auto w-full max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
          <div className={`grid gap-10 ${cols === 3 ? "md:grid-cols-2 lg:grid-cols-3" : cols === 2 ? "md:grid-cols-2" : ""}`}>
            <div className="min-w-0 space-y-4">
              <Brand name={settings.siteName} logoLight={settings.logoLight} logoDark={settings.logoDark} />
              {f.about && <p className="max-w-prose text-sm text-muted">{f.about}</p>}
              {f.socials.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Media sosial">
                  {f.socials.map((s) => (
                    <li key={s.label}>
                      <a href={s.href} className="inline-flex min-h-11 items-center rounded-full border-2 border-border px-4 text-sm hover:bg-surface-2" target="_blank" rel="noopener noreferrer">
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {hasContact && (
              <div className="min-w-0">
                <h2 className="mb-3 text-base">Kontak</h2>
                <ul className="space-y-3 text-sm">
                  {f.address && (
                    <li className="flex gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span className="min-w-0 break-words">{f.address}</span>
                    </li>
                  )}
                  {f.phones.map((p) => (
                    <li key={p} className="flex gap-2">
                      <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <a href={`tel:${p.replace(/\s/g, "")}`} className="underline underline-offset-4">{p}</a>
                    </li>
                  ))}
                  {f.emails.map((e) => (
                    <li key={e} className="flex gap-2">
                      <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <a href={`mailto:${e}`} className="min-w-0 break-all underline underline-offset-4">{e}</a>
                    </li>
                  ))}
                  {f.hours && (
                    <li className="flex gap-2">
                      <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span className="min-w-0 break-words">{f.hours}</span>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {quick.length > 0 && (
              <div className="min-w-0">
                <h2 className="mb-3 text-base">Tautan cepat</h2>
                <ul className="space-y-1 text-sm">
                  {quick.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {f.mapEmbedUrl && (
            <div className="mt-8 overflow-hidden rounded-card border border-border">
              <iframe src={f.mapEmbedUrl} title="Peta lokasi" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-56 w-full border-0 grayscale md:h-72" />
            </div>
          )}

          <p className="mt-8 border-t border-border pt-6 text-sm text-muted">{f.copyright ? `${f.copyright} · ` : ""}{"© 2026 OPETHANDAUGER"}</p>
        </div>
      </div>
    </footer>
  );
}

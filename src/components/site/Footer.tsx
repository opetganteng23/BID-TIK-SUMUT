import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { PublicSettings } from "@/lib/settings";
import { Brand } from "@/components/site/Brand";

export function Footer({ settings }: { settings: PublicSettings }) {
  const f = settings.footer;
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-24 overflow-hidden bg-cloud">
      {/* Lapisan awan: blur panel footer baru terlihat bila ada sesuatu di belakangnya. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="cloud left-[-5%] top-4 h-48 w-96" />
        <span className="cloud right-[5%] top-12 h-56 w-[28rem]" style={{ animationDelay: "-12s" }} />
        <span className="cloud bottom-0 left-[35%] h-44 w-[26rem]" style={{ animationDelay: "-24s" }} />
      </div>

      <div className="relative mx-auto max-w-[1200px] px-4 py-10 md:px-6">
        <div className="glass rounded-[20px] border p-6 md:p-10" style={{ backdropFilter: "blur(20px) saturate(140%)" }}>
          <div className="grid gap-10 md:grid-cols-3">
            <div className="space-y-4">
              <Brand name={settings.siteName} logoLight={settings.logoLight} logoDark={settings.logoDark} />
              {f.about && <p className="text-sm text-muted">{f.about}</p>}
              {settings.footer.socials.length > 0 && (
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

            <div>
              <h2 className="mb-3 text-base">Kontak</h2>
              <ul className="space-y-3 text-sm">
                {f.address && (
                  <li className="flex gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>{f.address}</span>
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
                    <a href={`mailto:${e}`} className="underline underline-offset-4">{e}</a>
                  </li>
                ))}
                {f.hours && (
                  <li className="flex gap-2">
                    <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>{f.hours}</span>
                  </li>
                )}
              </ul>
            </div>

            <div>
              <h2 className="mb-3 text-base">Tautan cepat</h2>
              <ul className="space-y-1 text-sm">
                {f.quickLinks.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {f.mapEmbedUrl && (
            <div className="mt-8 overflow-hidden rounded-card border border-border">
              <iframe src={f.mapEmbedUrl} title="Peta lokasi" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-64 w-full border-0 grayscale" />
            </div>
          )}

          <div className="mt-8 space-y-1 border-t border-border pt-6 text-sm text-muted">
            <p>{f.copyright || `© ${year} ${settings.orgName || settings.siteName}`}</p>
            <p>© 2026 OPETHANDAUGER</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

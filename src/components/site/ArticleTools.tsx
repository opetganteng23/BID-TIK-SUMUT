"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Link2, Share2, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useTts } from "@/components/site/tts";

export function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(
    () => () => {},
    () => !!navigator.share,
    () => false,
  );
  const url = () => window.location.href;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Bagikan berita">
      {canShare && (
        <Button type="button" variant="secondary" onClick={() => navigator.share({ title, url: url() }).catch(() => {})}>
          <Share2 className="size-4" aria-hidden /> Bagikan
        </Button>
      )}
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard tidak tersedia */
          }
        }}
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        {copied ? "Tautan disalin" : "Salin tautan"}
      </Button>
      <span className="sr-only" role="status">{copied ? "Tautan disalin" : ""}</span>
    </div>
  );
}

/** Tombol Dengarkan: membacakan isi artikel dengan Web Speech API. Disembunyikan bila tidak didukung. */
export function ListenButton({ targetId }: { targetId: string }) {
  const tts = useTts("id-ID");
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!mounted) return null;
  if (!tts.supported) return <p className="text-sm text-muted">Fitur dengarkan tidak didukung oleh peramban ini.</p>;
  return tts.state === "idle" ? (
    <Button type="button" variant="secondary" onClick={() => tts.readElement(document.getElementById(targetId))}>
      <Volume2 className="size-4" aria-hidden /> Dengarkan
    </Button>
  ) : (
    <Button type="button" variant="secondary" onClick={tts.stop}>
      <Square className="size-4" aria-hidden /> Berhenti
    </Button>
  );
}

/**
 * HTML mentah (Super Admin) dirender di iframe sandbox TANPA allow-same-origin.
 * Tinggi diperbarui lewat postMessage yang hanya diterima dari iframe ini sendiri.
 */
export function RawHtmlFrame({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(480);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const d = e.data as { type?: unknown; height?: unknown } | null;
      if (!d || d.type !== "bid-embed-height" || typeof d.height !== "number" || !Number.isFinite(d.height)) return;
      setHeight(Math.min(Math.max(Math.round(d.height), 120), 20000));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return <iframe ref={ref} src={src} title={title} sandbox="allow-scripts allow-popups" referrerPolicy="no-referrer" loading="lazy" style={{ width: "100%", height, border: 0 }} />;
}

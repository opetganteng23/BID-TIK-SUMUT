"use client";

import { useEffect, useRef, useState } from "react";
import { Accessibility, Pause, Play, RotateCcw, Square, Volume2, X } from "lucide-react";
import { Button, Checkbox, SelectInput, cx } from "@/components/ui";
import { useTts } from "@/components/site/tts";

type Prefs = { theme?: "light" | "dark" | "system"; fontLevel?: number; contrast?: boolean; reduceMotion?: boolean; dyslexia?: boolean; spacing?: "normal" | "loose" };

const LEVELS = [0.875, 1, 1.125, 1.25, 1.5];
const LEVEL_LABEL = ["87,5%", "100%", "112,5%", "125%", "150%"];
const KEY = "a11y";

function read(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Prefs;
  } catch {
    return {};
  }
}

function apply(p: Prefs, defaults: { theme: string; fontScale: number }) {
  const d = document.documentElement;
  let theme = p.theme ?? defaults.theme;
  if (theme === "system") theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  d.dataset.theme = theme;
  if (p.contrast) d.dataset.contrast = "high";
  else delete d.dataset.contrast;
  if (p.reduceMotion || matchMedia("(prefers-reduced-motion: reduce)").matches) d.dataset.motion = "reduce";
  else delete d.dataset.motion;
  if (p.dyslexia) d.dataset.font = "dyslexia";
  else delete d.dataset.font;
  if (p.spacing === "loose") d.dataset.spacing = "loose";
  else delete d.dataset.spacing;
  const scale = p.fontLevel !== undefined ? LEVELS[p.fontLevel] : defaults.fontScale;
  d.style.setProperty("--font-scale", String(scale));
}

export function A11yWidget({ defaultTheme, defaultFontScale, ttsEnabled, ttsLang }: { defaultTheme: string; defaultFontScale: number; ttsEnabled: boolean; ttsLang: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [prefs, setPrefs] = useState<Prefs>({});
  const tts = useTts(ttsLang);
  const defaults = { theme: defaultTheme, fontScale: defaultFontScale };

  useEffect(() => {
    const t = setTimeout(() => {
      const p = read();
      setPrefs(p);
      apply(p, defaults);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Prefs) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...next, fontScale: next.fontLevel !== undefined ? LEVELS[next.fontLevel] : undefined }));
    } catch {
      /* penyimpanan tidak tersedia */
    }
    apply(next, defaults);
  };

  const reset = () => {
    setPrefs({});
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* abaikan */
    }
    apply({}, defaults);
  };

  const close = () => {
    ref.current?.close();
    opener.current?.focus();
  };

  const level = prefs.fontLevel ?? Math.max(0, LEVELS.findIndex((l) => l === defaultFontScale));
  const voiceOptions = [{ value: "", label: "Otomatis (id-ID)" }, ...tts.voices.filter((v) => v.lang.toLowerCase().startsWith("id") || v.default).map((v) => ({ value: v.voiceURI, label: `${v.name} (${v.lang})` }))];

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => ref.current?.showModal()}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border-2 border-border px-3 text-sm font-medium hover:bg-surface-2"
        aria-haspopup="dialog"
      >
        <Accessibility className="size-5" aria-hidden />
        <span className="hidden sm:inline">Aksesibilitas</span>
        <span className="sr-only sm:hidden">Buka pengaturan aksesibilitas</span>
      </button>

      {/* <dialog> modal: fokus terperangkap dan Esc menutup secara native. */}
      <dialog
        ref={ref}
        aria-labelledby="a11y-title"
        className="m-auto w-[min(92vw,26rem)] rounded-[20px] border border-border bg-surface p-0 text-fg shadow-[var(--shadow)] backdrop:bg-black/40"
        onClose={() => opener.current?.focus()}
      >
        <div className="flex max-h-[85svh] flex-col">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 id="a11y-title" className="text-lg">
              Pengaturan aksesibilitas
            </h2>
            <button type="button" onClick={close} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Tutup">
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div className="space-y-5 overflow-y-auto p-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Ukuran font: {LEVEL_LABEL[level]}</legend>
              <div className="flex items-center gap-2">
                <Button variant="secondary" type="button" onClick={() => update({ fontLevel: Math.max(0, level - 1) })} disabled={level === 0} aria-label="Perkecil font">
                  A-
                </Button>
                <input
                  type="range"
                  min={0}
                  max={4}
                  step={1}
                  value={level}
                  onChange={(e) => update({ fontLevel: Number(e.target.value) })}
                  className="h-11 flex-1 accent-[var(--primary)]"
                  aria-label="Tingkat ukuran font"
                  aria-valuetext={LEVEL_LABEL[level]}
                />
                <Button variant="secondary" type="button" onClick={() => update({ fontLevel: Math.min(4, level + 1) })} disabled={level === 4} aria-label="Perbesar font">
                  A+
                </Button>
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Tema</legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema">
                {(["light", "dark", "system"] as const).map((t) => {
                  const on = (prefs.theme ?? defaultTheme) === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => update({ theme: t })}
                      className={cx("min-h-11 rounded-full border-2 px-2 text-sm", on ? "border-fg bg-primary text-primary-fg" : "border-border hover:bg-surface-2")}
                    >
                      {t === "light" ? "Terang" : t === "dark" ? "Gelap" : "Sistem"}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-1">
              <Checkbox id="a11y-contrast" label="Kontras tinggi" checked={!!prefs.contrast} onChange={(e) => update({ contrast: e.target.checked })} />
              <Checkbox id="a11y-motion" label="Kurangi animasi" checked={!!prefs.reduceMotion} onChange={(e) => update({ reduceMotion: e.target.checked })} />
              <Checkbox id="a11y-dys" label="Font ramah disleksia" checked={!!prefs.dyslexia} onChange={(e) => update({ dyslexia: e.target.checked })} />
              <Checkbox id="a11y-space" label="Jarak baris dan huruf lega" checked={prefs.spacing === "loose"} onChange={(e) => update({ spacing: e.target.checked ? "loose" : "normal" })} />
            </div>

            {ttsEnabled && (
              <fieldset className="space-y-3 rounded-card border border-border p-3">
                <legend className="px-1 text-sm font-medium">Bacakan (TTS)</legend>
                {!tts.supported ? (
                  <p className="text-sm text-muted">Peramban ini tidak mendukung fitur bacakan. Tombol dinonaktifkan.</p>
                ) : (
                  <>
                    {!tts.hasIndonesianVoice && tts.voices.length > 0 && (
                      <p className="text-sm text-muted">Perangkat Anda tidak memiliki suara bahasa Indonesia. Kualitas suara bergantung pada perangkat.</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={() => { close(); tts.readElement(document.getElementById("konten")); }}>
                        <Volume2 className="size-4" aria-hidden /> Bacakan halaman
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => { close(); tts.readSelection(); }}>
                        Teks terpilih
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Kontrol pemutaran">
                      {tts.state === "paused" ? (
                        <Button type="button" variant="secondary" onClick={tts.resume}><Play className="size-4" aria-hidden /> Lanjut</Button>
                      ) : (
                        <Button type="button" variant="secondary" onClick={tts.pause} disabled={tts.state !== "playing"}><Pause className="size-4" aria-hidden /> Jeda</Button>
                      )}
                      <Button type="button" variant="secondary" onClick={tts.stop} disabled={tts.state === "idle"}><Square className="size-4" aria-hidden /> Berhenti</Button>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="tts-rate" className="block text-sm font-medium">Kecepatan: {tts.rate.toFixed(2)}x</label>
                      <input id="tts-rate" type="range" min={0.75} max={1.5} step={0.25} value={tts.rate} onChange={(e) => tts.changeRate(Number(e.target.value))} className="h-11 w-full accent-[var(--primary)]" />
                    </div>
                    <SelectInput id="tts-voice" label="Suara" value={tts.voiceURI} onChange={(e) => tts.changeVoice(e.target.value)} options={voiceOptions} />
                  </>
                )}
              </fieldset>
            )}
          </div>

          <div className="border-t border-border p-4">
            <Button type="button" variant="secondary" onClick={reset} className="w-full">
              <RotateCcw className="size-4" aria-hidden /> Kembalikan ke bawaan
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

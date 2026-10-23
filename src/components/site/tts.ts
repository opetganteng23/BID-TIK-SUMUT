"use client";

import { useEffect, useRef, useState } from "react";

const MAX_CHUNK = 220;
const BLOCKS = "h1, h2, h3, h4, p, li, blockquote, figcaption, td, th";

function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const out: string[] = [];
  let buf = "";
  for (const p of parts) {
    if ((buf + p).length > MAX_CHUNK && buf) {
      out.push(buf.trim());
      buf = "";
    }
    buf += p;
    while (buf.length > MAX_CHUNK) {
      const cut = buf.lastIndexOf(" ", MAX_CHUNK);
      const at = cut > 40 ? cut : MAX_CHUNK;
      out.push(buf.slice(0, at).trim());
      buf = buf.slice(at);
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

type Chunk = { text: string; el: Element | null };

function chunksFrom(root: Element): Chunk[] {
  const chunks: Chunk[] = [];
  root.querySelectorAll(BLOCKS).forEach((el) => {
    if (el.closest("[aria-hidden='true'], [data-tts-skip]")) return;
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.length < 2) return;
    for (const piece of splitSentences(text)) chunks.push({ text: piece, el });
  });
  return chunks;
}

export function useTts(lang = "id-ID") {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");
  const queue = useRef<Chunk[]>([]);
  const index = useRef(0);
  const active = useRef<Element | null>(null);
  const token = useRef(0);
  const rateRef = useRef(1);
  const voiceRef = useRef("");

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const hasIndonesianVoice = voices.some((v) => v.lang.toLowerCase().startsWith("id"));

  const highlight = (el: Element | null) => {
    active.current?.classList.remove("tts-active");
    active.current = el;
    el?.classList.add("tts-active");
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  function speakNext(myToken: number) {
      if (myToken !== token.current) return;
      const chunk = queue.current[index.current];
      if (!chunk) {
        highlight(null);
        setState("idle");
        return;
      }
      const u = new SpeechSynthesisUtterance(chunk.text);
      u.lang = lang;
      u.rate = rateRef.current;
      const v = window.speechSynthesis.getVoices().find((x) => x.voiceURI === voiceRef.current) ?? window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
      if (v) u.voice = v;
      u.onstart = () => highlight(chunk.el);
      u.onend = () => {
        index.current += 1;
        speakNext(myToken);
      };
      u.onerror = (e) => {
        if (e.error === "canceled" || e.error === "interrupted") return;
        index.current += 1;
        speakNext(myToken);
      };
      window.speechSynthesis.speak(u);
  }

  function start(chunks: Chunk[]) {
      if (!supported || chunks.length === 0) return;
      window.speechSynthesis.cancel();
      token.current += 1;
      queue.current = chunks;
      index.current = 0;
      setState("playing");
      speakNext(token.current);
  }

  const readElement = (root: Element | null) => root && start(chunksFrom(root));

  const readSelection = () => {
    const text = window.getSelection()?.toString().replace(/\s+/g, " ").trim();
    if (text) start(splitSentences(text).map((t) => ({ text: t, el: null })));
  };

  const pause = () => {
    window.speechSynthesis.pause();
    setState("paused");
  };
  const resume = () => {
    window.speechSynthesis.resume();
    setState("playing");
  };
  const stop = () => {
    token.current += 1;
    window.speechSynthesis.cancel();
    highlight(null);
    setState("idle");
  };

  const changeRate = (r: number) => {
    rateRef.current = r;
    setRate(r);
  };
  const changeVoice = (uri: string) => {
    voiceRef.current = uri;
    setVoiceURI(uri);
  };

  return { supported, state, rate, voices, voiceURI, hasIndonesianVoice, readElement, readSelection, pause, resume, stop, changeRate, changeVoice };
}

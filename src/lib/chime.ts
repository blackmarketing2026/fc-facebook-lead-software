"use client";

/**
 * Hinweiston für Benachrichtigungen über Web Audio (keine Audiodatei nötig). Browser spielen Töne erst nach einer
 * Interaktion mit der Seite ab – deshalb wird der Ton beim ersten Klick/Tastendruck freigeschaltet.
 */
let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume().then(notify);
  } catch {
    // ohne Web Audio eben ohne Ton
  }
}

export function audioReady(): boolean {
  return ctx?.state === "running";
}

/** Meldet, wenn sich audioReady() ändert (für den Hinweis "Ton einschalten"). */
export function onAudioChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlockAudio);
  window.addEventListener("keydown", unlockAudio);
}

const TONES = {
  lead: [880, 1320],
  reminder: [660, 880, 1100],
} as const;

export function playChime(kind: keyof typeof TONES = "lead") {
  if (!ctx) unlockAudio();
  if (!ctx || ctx.state !== "running") return;
  const start = ctx.currentTime;
  TONES[kind].forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = start + i * 0.18;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  });
}

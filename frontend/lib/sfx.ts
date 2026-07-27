// Tiny synthesized sound-effect engine built on the WebAudio API.
// Generates short tones/noise bursts at runtime, so no audio asset
// files are required. Exposes one play function per game event plus
// a global mute toggle, all safe to call before user interaction.
"use client";

let ctx: AudioContext | null = null;
let muted = false;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function setSfxMuted(value: boolean) {
  muted = value;
}

export function isSfxMuted(): boolean {
  return muted;
}

function tone(freq: number, durationMs: number, type: OscillatorType, gainPeak: number, delayMs = 0) {
  if (muted) return;
  const audio = getContext();
  if (!audio) return;

  const startAt = audio.currentTime + delayMs / 1000;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + durationMs / 1000);

  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(startAt);
  osc.stop(startAt + durationMs / 1000 + 0.02);
}

function sweep(freqFrom: number, freqTo: number, durationMs: number, type: OscillatorType, gainPeak: number) {
  if (muted) return;
  const audio = getContext();
  if (!audio) return;

  const startAt = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, startAt);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 1), startAt + durationMs / 1000);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + durationMs / 1000);

  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(startAt);
  osc.stop(startAt + durationMs / 1000 + 0.02);
}

export function playEat() {
  tone(660, 90, "sine", 0.12);
  tone(880, 90, "sine", 0.08, 40);
}

export function playHit() {
  tone(150, 120, "sawtooth", 0.15);
}

export function playKill() {
  sweep(220, 60, 350, "square", 0.18);
}

export function playDeath() {
  sweep(400, 40, 600, "sawtooth", 0.2);
}

export function playRespawn() {
  sweep(200, 700, 250, "sine", 0.15);
}

export function playLevelUp() {
  tone(523, 100, "triangle", 0.15);
  tone(659, 100, "triangle", 0.15, 90);
  tone(784, 160, "triangle", 0.15, 180);
}

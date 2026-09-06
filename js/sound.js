// Synthesised sound. No audio files: everything is built from oscillators and
// filtered noise, so the game stays a few kilobytes and works offline.
//
// Design note: the first version sat at 1.7-5 kHz and read as squeaky beeping.
// Real card and chip sounds live an octave and a half lower - a card is a short
// band of noise around 1 kHz plus a soft thump of the felt, a clay chip is a
// short inharmonic ring around 500-1200 Hz. Frequencies here are chosen to sit
// in that range; the check that keeps them there is in test/sound.spectrum.mjs.
let ctx = null, master = null, comp = null;
let enabled = true;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();      // keeps overlapping chips from clipping
    comp.threshold.value = -18; comp.ratio.value = 4; comp.release.value = 0.15;
    master = ctx.createGain();
    master.gain.value = 0.55;
    comp.connect(master); master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') { try { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  return ctx;
}
export function unlock() { if (enabled) ac(); }
export function setEnabled(v) { enabled = v; if (v) ac(); }
export function isEnabled() { return enabled; }

const rnd = (a, b) => a + Math.random() * (b - a);

// short burst of noise through a band-pass: the body of every card and chip sound
function noiseBurst(t0, dur, freq, q, peak, type = 'bandpass') {
  const c = ac(); if (!c) return;
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.6);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(comp);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

// a struck body: one decaying partial. Clay chips ring inharmonically, so the
// partials below are not multiples of each other
function partial(t0, freq, dur, peak, type = 'sine') {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(comp);
  o.start(t0); o.stop(t0 + dur + 0.03);
}

function oneChip(t0) {
  const k = rnd(0.94, 1.07);                    // no two chips sound identical
  noiseBurst(t0, 0.012, 1700 * k, 2.6, 0.7);   // the initial tick
  partial(t0, 520 * k, 0.10, 0.10);             // clay body
  partial(t0 + 0.002, 790 * k, 0.075, 0.055);
  partial(t0 + 0.004, 1180 * k, 0.05, 0.03);
}

export const sound = {
  // card sliding out of the shoe and landing: a band of noise plus the felt
  deal() {
    if (!enabled || !ac()) return; const t = ctx.currentTime;
    noiseBurst(t, 0.075, rnd(820, 1050), 2.2, 1.7);
    noiseBurst(t + 0.03, 0.06, 190, 0.7, 0.55, 'lowpass');
  },
  // turning a card over: shorter and brighter than the slide, no body
  flip() {
    if (!enabled || !ac()) return; const t = ctx.currentTime;
    noiseBurst(t, 0.045, rnd(900, 1150), 3.4, 1.4);
    partial(t, 320, 0.05, 0.05, 'triangle');
  },
  chip() { if (!enabled || !ac()) return; oneChip(ctx.currentTime); },
  // a small handful landing on the felt, never metronomic
  chips(n = 3) {
    if (!enabled || !ac()) return; const t = ctx.currentTime;
    let at = 0;
    for (let i = 0; i < n; i++) { oneChip(t + at); at += rnd(0.018, 0.045); }
  },
  // riffle: a run of paper bursts, then the pack squared up
  shuffle() {
    if (!enabled || !ac()) return; const t = ctx.currentTime;
    for (let i = 0; i < 14; i++) noiseBurst(t + i * 0.032 + rnd(0, .006), 0.04, rnd(650, 1000), 3.2, 0.55);
    noiseBurst(t + 0.5, 0.09, 560, 2.4, 0.75);
    noiseBurst(t + 0.52, 0.07, 170, 0.7, 0.4, 'lowpass');
  },
  win() {
    if (!enabled || !ac()) return; const t = ctx.currentTime;
    partial(t, 392, 0.20, 0.10, 'triangle');
    partial(t + 0.085, 587.33, 0.30, 0.09, 'triangle');
    this.chips(2);
  },
  blackjack() {
    if (!enabled || !ac()) return; const t = ctx.currentTime;
    [392, 523.25, 659.25, 783.99].forEach((f, i) => partial(t + i * 0.07, f, 0.34, 0.085, 'triangle'));
    setTimeout(() => this.chips(4), 120);
  },
  lose() {
    if (!enabled || !ac()) return; const t = ctx.currentTime;
    partial(t, 174.61, 0.22, 0.10); partial(t + 0.07, 130.81, 0.34, 0.085);
  },
  // busting is the player's own doing: a flat thump, not a buzzer
  bust() {
    if (!enabled || !ac()) return; const t = ctx.currentTime;
    noiseBurst(t, 0.14, 220, 0.6, 0.11, 'lowpass');
    partial(t, 146.83, 0.30, 0.09); partial(t + 0.06, 110, 0.34, 0.07);
  },
  push() { if (!enabled || !ac()) return; partial(ctx.currentTime, 329.63, 0.22, 0.075, 'triangle'); },
  click() { if (!enabled || !ac()) return; noiseBurst(ctx.currentTime, 0.014, 900, 3.0, 0.5); }
};

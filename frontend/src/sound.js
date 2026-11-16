// Small sounds made in the browser (no audio files needed). Browsers may block sound until the first click,
// so every call is wrapped and silently does nothing if audio is not allowed.
let audio = null;

function ctx() {
  try {
    if (!audio) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      audio = new C();
    }
    if (audio.state === "suspended") audio.resume();
    return audio;
  } catch {
    return null;
  }
}

function tone(c, freq, start, dur, vol, type = "sine", endFreq = 0) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

// A short mechanical "clack" (a falling square wave).
function clack(c, t, vol = 0.2) {
  tone(c, 1400, t, 0.035, vol, "square", 300);
}

export function playUnlock() {
  try {
    const c = ctx();
    if (!c) return;
    const t = c.currentTime + 0.02;
    clack(c, t);
    tone(c, 523, t + 0.45, 0.14, 0.1);
    tone(c, 784, t + 0.58, 0.28, 0.1);
  } catch { /* no sound is fine */ }
}

export function playLock() {
  try {
    const c = ctx();
    if (!c) return;
    const t = c.currentTime + 0.02;
    tone(c, 170, t, 0.25, 0.25, "sine", 60);
    clack(c, t + 0.28, 0.25);
  } catch { /* no sound is fine */ }
}

export function playClick() {
  try {
    const c = ctx();
    if (c) clack(c, c.currentTime + 0.01, 0.12);
  } catch { /* no sound is fine */ }
}

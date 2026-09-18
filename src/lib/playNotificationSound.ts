// A short two-tone chime, synthesized with the Web Audio API rather
// than a bundled audio file — no asset to host or ship, works
// identically everywhere. Browsers block audio before any user
// interaction on the page at all; a blocked attempt is silently
// swallowed rather than surfaced as an error, since there's nothing
// useful to do about it and it resolves itself the moment the user
// clicks anything on the page.
export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });

    setTimeout(() => ctx.close(), 800);
  } catch {
    // Web Audio unavailable or blocked — not worth surfacing.
  }
}

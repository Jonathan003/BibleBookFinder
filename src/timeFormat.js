// Format a duration in milliseconds to a human-readable string.
// Used in the share message, Settings → Data, and the Stats-so-far screen.
//
// Format choice: universal Engels-stijl (h/m/d) for both NL and EN messages,
// chosen for international readability when sharing on social media. Locale
// strings ("uur", "minuten") would otherwise leak into screenshots and feel
// out of place when the message is forwarded.
//
// Tiers:
//   < 1 min      → "<1m"           (rare; only if user opens & closes quickly)
//   < 1 hour     → "{m}m"          (e.g. "23m")
//   < 24 hours   → "{h}h {m}m"     (e.g. "8h 32m"; minutes omitted if 0)
//   ≥ 24 hours   → "{d}d {h}h"     (e.g. "1d 12h"; hours omitted if 0)
export function formatDuration(ms) {
  if (!ms || ms < 0) return '<1m';
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1)  return '<1m';
  if (totalMin < 60) return `${totalMin}m`;

  const totalHours = Math.floor(totalMin / 60);
  if (totalHours < 24) {
    const m = totalMin % 60;
    return m === 0 ? `${totalHours}h` : `${totalHours}h ${m}m`;
  }

  const days = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  return h === 0 ? `${days}d` : `${days}d ${h}h`;
}

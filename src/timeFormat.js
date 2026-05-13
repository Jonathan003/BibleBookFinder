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

// v6 commit 23: relative-time formatter for "X hours ago" / "X uur geleden"
// style strings. Used by the Resume CTA on the home screen so a user who
// returns days after pausing knows whether their snapshot is from this
// morning or from last week.
//
// Leans on Intl.RelativeTimeFormat (built-in since 2018) for locale-aware
// output — "3 hours ago" / "3 uur geleden" / "yesterday" / "gisteren" etc.
// — without us shipping translation strings for each tier.
//
// Returns null on bad input so the caller can fall back to a static
// description; never throws.
export function formatTimeAgo(timestampMs, lang) {
  if (typeof timestampMs !== 'number' || !isFinite(timestampMs)) return null;
  const diffMs = Date.now() - timestampMs;
  if (diffMs < 0) return null; // future timestamp; defensive guard

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  try {
    const rtf = new Intl.RelativeTimeFormat(lang || 'en', { numeric: 'auto' });
    if (minutes < 1) {
      // Special-case sub-minute to avoid Intl's "binnen een minuut"
      // / "in less than a minute" outputs, which read awkwardly when
      // combined with a "Paused …" / "Onderbroken …" prefix.
      return lang === 'nl' ? 'zojuist' : 'just now';
    }
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    if (hours < 24) return rtf.format(-hours, 'hour');
    if (days < 30) return rtf.format(-days, 'day');
    if (days < 365) return rtf.format(-Math.floor(days / 30), 'month');
    return rtf.format(-Math.floor(days / 365), 'year');
  } catch {
    // Fallback if Intl.RelativeTimeFormat unsupported (very old browsers)
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  }
}

import { isDueNow } from './fsrs';

// Review forecast helpers — derive "what's coming" information directly
// from the FSRS card data without persisting any new state. All
// calculations are pure functions of fsrsCards + allBooks + the current
// time, so they're cheap to recompute on each render and can't drift
// out of sync with the actual schedule.

// Compute count of books due each of the next `days` days.
//
// Day 0 means "today + already-overdue" (the same definition used by
// the menu's "Ready to practice" stat). Day 1 onward are calendar days
// in local time, ending at midnight.
//
// Unseen books (no FSRS card yet) only count on day 0 — they're due now
// by definition. Putting them on later days would be misleading: the
// system would happily quiz them today if asked.
//
// Returns an array of { date: Date, count: number } in chronological order.
export function computeForecast(fsrsCards, allBooks, days = 7) {
  const result = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < days; i++) {
    const dayStart = new Date(today.getTime() + i * dayMs);
    const dayEnd   = new Date(today.getTime() + (i + 1) * dayMs);
    let count = 0;

    allBooks.forEach(book => {
      const card = fsrsCards[book.id];
      if (!card) {
        if (i === 0) count++; // unseen books are due today
        return;
      }
      const due = new Date(card.due);
      if (i === 0) {
        // Day 0: anything due before end-of-today (incl. overdue)
        if (due < dayEnd) count++;
      } else {
        // Future days: due strictly within this calendar day
        if (due >= dayStart && due < dayEnd) count++;
      }
    });

    result.push({ date: dayStart, count });
  }
  return result;
}

// Find the next future due time across all books, or null if nothing
// is scheduled in the future (everything is already due now or there
// are no cards yet). Used to render "Volgende boek: morgen 09:14".
//
// Cards already considered "due now" by the Learn-Ahead-Limit (Learning
// or Relearning state, due within the next 15 minutes) are excluded
// from the search — the menu treats them as currently due, so they must
// not also be the answer to "when is the *next* book?" or the celebration
// card shows a contradiction (dueNow=0 + nextBookDue=in 5 minutes).
export function getNextDueTime(fsrsCards, allBooks) {
  const now = new Date();
  let earliest = null;

  allBooks.forEach(book => {
    const card = fsrsCards[book.id];
    if (!card) return; // unseen books are not "future" — they're due now
    if (isDueNow(card, now)) return; // already counted as currently due
    const due = new Date(card.due);
    if (due > now) {
      if (!earliest || due < earliest) earliest = due;
    }
  });

  return earliest;
}

// Format a future Date as a human-friendly relative string.
//   - <1h:    "nu" / "now"
//   - <24h:   "over 4u" / "in 4h"        (wall-clock today)
//   - tomorrow: "morgen 09:14" / "tomorrow 09:14"
//   - later:  "vr 09:14" / "Fri 09:14"   (weekday + time)
//   - >7d:    "12 mei" / "May 12"        (date only)
export function formatNextDue(date, lang = 'nl', now = new Date()) {
  if (!date) return '';
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 60 * 60 * 1000) {
    return lang === 'nl' ? 'binnen een uur' : 'within an hour';
  }

  const today    = new Date(now.getFullYear(),  now.getMonth(),  now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
  const weekOut  = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const time = date.toLocaleTimeString(lang === 'nl' ? 'nl-BE' : 'en-US',
    { hour: '2-digit', minute: '2-digit', hour12: false });

  if (date < tomorrow) {
    // Same calendar day, >1h away
    if (lang === 'nl') return `vandaag om ${time}`;
    return `today at ${time}`;
  }
  if (date < dayAfter) {
    if (lang === 'nl') return `morgen om ${time}`;
    return `tomorrow at ${time}`;
  }
  if (date < weekOut) {
    const weekday = date.toLocaleDateString(lang === 'nl' ? 'nl-BE' : 'en-US', { weekday: 'short' });
    return `${weekday} ${time}`;
  }
  // More than a week out — date only, time becomes meaningless at that range
  return date.toLocaleDateString(lang === 'nl' ? 'nl-BE' : 'en-US', { day: 'numeric', month: 'short' });
}

// Determine which "rest level" the user is in when dueNow=0. The original
// design showed "Done for today" regardless of how far away the next book
// was, which is misleading when the next book comes due in 5 minutes.
// Three honest levels instead:
//
//   'session-end' — next book is due within 1 hour. The user just
//     finished a session; they're not "done for today", they're between
//     bursts. Soft celebration, short message.
//   'today'       — next book is due later today (1h to end-of-day).
//     Real rest, but more is coming. Standard celebration.
//   'multi-day'   — next book is due tomorrow or later. The user has
//     genuinely finished for the day. Strongest celebration.
//
// When `nextDue` is null (no future due — everything is overdue or there
// are no cards yet), there's no rest to celebrate; caller should not
// invoke this. The `level` is only meaningful when stats.dueNow === 0.
export function getCelebrationLevel(nextDue, now = new Date()) {
  if (!nextDue) return 'session-end';
  const diffMs = nextDue.getTime() - now.getTime();
  const oneHour = 60 * 60 * 1000;
  if (diffMs <= oneHour) return 'session-end';

  // End of today (local midnight). If the next due is before midnight,
  // it's still "today". Otherwise it's tomorrow or later.
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (nextDue < endOfToday) return 'today';

  return 'multi-day';
}

// Short label for a forecast bar segment ("Vandaag", "Ma", "Di", ...).
// Day 0 is always shown as "Vandaag" / "Today" regardless of weekday;
// day 1 onward use 2-letter weekday abbreviations.
export function forecastDayLabel(date, dayIndex, lang = 'nl') {
  if (dayIndex === 0) return lang === 'nl' ? 'Vandaag' : 'Today';
  if (dayIndex === 1) return lang === 'nl' ? 'Morgen'  : 'Tom.';
  // 2-letter weekday — short enough to fit a 7-segment forecast bar on
  // narrow phone screens. Locale handles capitalization rules.
  const weekday = date.toLocaleDateString(lang === 'nl' ? 'nl-BE' : 'en-US', { weekday: 'short' });
  // Trim to first 2-3 chars; locale 'short' weekday is already abbreviated
  // but Dutch returns "ma." with the period — strip that for cleaner look.
  return weekday.replace(/\.$/, '');
}

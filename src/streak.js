// Streak helpers — derive today's training stats from the existing
// quizHistory array without persisting any new state. Each quizHistory
// entry already has a `date` timestamp (millis since epoch), so we
// group those by local calendar day.
//
// v6 commit 28: computeStreakInfo() (the per-day streak with "yesterday
// grace" rule) was removed. That function was never wired to the UI —
// BBF deliberately has no day-streak (see commit 22 FAQ rewrite, README
// "no daily-streak pressure" rationale, and the deliberate decision in
// streak-design research from commit 28's parent discussion). Keeping
// it as dead code suggested a phantom feature; removing it makes the
// file's intent (today's stats only) match its actual surface.

// Convert a timestamp to a "YYYY-MM-DD" string in local time. Local time
// is correct here: the user thinks of "yesterday" as the day they went
// to bed in their own timezone, not UTC midnight.
function localDayKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Aggregate stats for *today* — used by the session-complete screen's
// "Vandaag: N boeken in M sessies, T minuten getraind" line.
//
//   - books:      unique book IDs that appeared in any session today.
//                 We use seenBookIds when present (sessions saved on a
//                 build with the new field), and fall back to `total`
//                 (sum of question counts) for legacy entries that
//                 don't carry seenBookIds. Legacy entries can therefore
//                 over-count — a session with 10 questions covering 6
//                 unique books contributes 10, not 6 — but that's only
//                 relevant for sessions saved before this change rolled
//                 out, and the over-count gets diluted as new sessions
//                 (with seenBookIds) accumulate.
//   - sessions:   number of quizHistory entries dated today.
//   - durationMs: sum of session durations today. Uses durationMs when
//                 present (new field) and falls back to total*avgTime
//                 for legacy entries.
//
// `now` is injected for tests; in production it defaults to the wall clock.
export function computeTodayStats(quizHistory, now = new Date()) {
  if (!quizHistory || quizHistory.length === 0) {
    return { books: 0, sessions: 0, durationMs: 0 };
  }
  const todayKey = localDayKey(now.getTime());

  let sessions = 0;
  let durationMs = 0;
  const uniqueBooks = new Set();
  let legacyBookTotal = 0;
  let sawAnyModern = false;

  quizHistory.forEach(entry => {
    if (!entry || typeof entry.date !== 'number') return;
    if (localDayKey(entry.date) !== todayKey) return;
    sessions++;

    if (Array.isArray(entry.seenBookIds)) {
      sawAnyModern = true;
      entry.seenBookIds.forEach(id => uniqueBooks.add(id));
    } else {
      legacyBookTotal += entry.total || 0;
    }

    if (typeof entry.durationMs === 'number' && Number.isFinite(entry.durationMs)) {
      durationMs += entry.durationMs;
    } else {
      // Legacy fallback: avgTime × total approximates session duration
      // for entries saved before durationMs existed.
      const avg = entry.avgTime || 0;
      const total = entry.total || 0;
      durationMs += avg * total;
    }
  });

  // If we have any modern entries, use the unique-book count plus the
  // legacy approximation for any old entries from today. The mix is
  // imperfect but better than picking only one signal.
  const books = sawAnyModern ? uniqueBooks.size + legacyBookTotal : legacyBookTotal;

  return { books, sessions, durationMs };
}

// Streak helpers — derive consecutive-active-days information from the
// existing quizHistory array without persisting any new state. Each
// quizHistory entry already has a `date` timestamp (millis since epoch),
// so we group those by local calendar day and count consecutive days
// ending today (or yesterday — see "grace" below).
//
// Why no separate streak counter? Three reasons:
//   1. It's purely a function of existing data, so storing it duplicates
//      truth and risks drift on backup/restore or cross-device sync.
//   2. quizHistory survives reset-progress correctly (cleared along with
//      everything else), so the streak follows it for free.
//   3. No race conditions on multi-tab use — every tab computes the same
//      value from the same source.

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

// Returns { current, longest, todayActive } where:
//   - current: number of consecutive days ending today (or yesterday) with
//              at least one quizHistory entry. Zero if last activity was
//              two or more days ago.
//   - longest: the longest such run ever recorded in quizHistory.
//   - todayActive: true if there's at least one entry from today.
//
// "Grace" rule: if you didn't open the app today but did yesterday, the
// streak is still considered active (current > 0) — you have until the
// end of today to extend it. Only when "today" passes without activity
// does the streak break. This matches Duolingo's behavior and feels
// fair (the alternative — breaking the streak at midnight even if the
// user is about to open the app — punishes night owls).
export function computeStreakInfo(quizHistory, now = new Date()) {
  if (!quizHistory || quizHistory.length === 0) {
    return { current: 0, longest: 0, todayActive: false };
  }

  // Build a Set of unique local-day keys for which there's any session.
  const activeDays = new Set();
  quizHistory.forEach(entry => {
    if (entry && typeof entry.date === 'number') {
      activeDays.add(localDayKey(entry.date));
    }
  });
  if (activeDays.size === 0) {
    return { current: 0, longest: 0, todayActive: false };
  }

  const todayKey = localDayKey(now.getTime());
  const yesterdayKey = localDayKey(now.getTime() - 24 * 60 * 60 * 1000);
  const todayActive = activeDays.has(todayKey);

  // Current streak: walk backwards from today (with grace for yesterday)
  let current = 0;
  let cursor = todayActive ? new Date(now) : (activeDays.has(yesterdayKey)
    ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
    : null);
  while (cursor && activeDays.has(localDayKey(cursor.getTime()))) {
    current++;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  // Longest streak: scan all active days sorted, find longest consecutive
  // run. Sorting strings lexicographically works because YYYY-MM-DD is
  // also chronological.
  const sortedDays = [...activeDays].sort();
  let longest = 0;
  let runLength = 0;
  let prev = null;
  for (const dayKey of sortedDays) {
    if (prev) {
      // Check if dayKey is exactly one day after prev
      const prevDate = new Date(prev + 'T00:00:00');
      const expected = localDayKey(prevDate.getTime() + 24 * 60 * 60 * 1000);
      if (dayKey === expected) {
        runLength++;
      } else {
        if (runLength > longest) longest = runLength;
        runLength = 1;
      }
    } else {
      runLength = 1;
    }
    prev = dayKey;
  }
  if (runLength > longest) longest = runLength;

  // The current streak might be the longest one we've ever had.
  if (current > longest) longest = current;

  return { current, longest, todayActive };
}

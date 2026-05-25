// ADR 0010: recent-answer tracking for the "Books that need attention"
// scope in Box Mode. Pure functions; the caller threads the user's
// recentAnswers field through and persists the result.
//
// Data shape:
//   recentAnswers: { '<bookId>': [{ ms, correct, ts }, ... up to 5] }
//
// Window size is 5: small enough to react quickly to improvement,
// large enough to filter out one-off noise. Sized to fill within
// 1–2 Quiz Mode races for any given book.
//
// ─── Type contract for Set-returning helpers ──────────────────────────
// IMPORTANT: getSlowBookIds and getRecentlyMissedBookIds both return a
// Set of NUMBERS — matching the numeric `book.id` in bibleBooks
// (data.js: `{ id: 1, ... }`). This is non-obvious because their input
// is iterated via Object.entries(), which always returns keys as
// STRINGS, even when the source object was indexed with numeric values
// (`recentAnswers[1] = ...` is stored as the key `"1"` — all JS object
// keys are strings under the hood).
//
// Forgetting to coerce here is a silent, hard-to-spot bug: Set.has()
// uses SameValueZero equality (no type coercion), so Set(["1"]).has(1)
// returns false even though the values "look" the same. The downstream
// consumer (getAttentionBooks in fsrs.js) calls slowIds.has(book.id)
// with a NUMBER — so the Set MUST contain numbers, not strings, or
// every lookup will silently return false and the entire "books that
// need attention" scope will appear empty after a race even when slow
// and missed books are clearly present in the data.
//
// Object property access elsewhere in the codebase
// (`recentAnswers[bid]`, `fsrsCards[book.id]`, `bestTimes[book.id]`, …)
// is safe because JS auto-coerces object keys to string. Only Set and
// Map operations break, because they don't coerce on .has() / .get().
// Those are the only spots where the explicit Number() coercion below
// is required.
//
// Diagnosed live: a fully-trained user with 8 slow + 3 missed books
// (union = 11) saw "No clearly weak books — you're in good shape!"
// because slowIds.has(11) returned false against a Set that contained
// "11" (string).

export const ANSWER_WINDOW_SIZE = 5;

// Minimum number of CORRECT answers in a book's window for its
// median to count toward criterion 2 (personally slow). Below this,
// the median is too noisy to be statistically meaningful.
export const MIN_CORRECT_FOR_MEDIAN = 3;

/**
 * Append an answer event to a book's rolling window.
 * Returns the updated recentAnswers object (does not mutate input).
 *
 * @param {Object} recentAnswers - current per-user recentAnswers map
 * @param {string} bookId
 * @param {Object} event - { ms, correct, ts? }
 *   ms: response time in milliseconds. Set to 0 when correct=false
 *       (wrong-tap or time-up — the timing is not a valid measurement
 *       of finding the target book).
 *   correct: boolean — did the user identify the target book on this
 *       attempt? (false for both wrong-tap and time-up.)
 *   ts: optional timestamp (defaults to Date.now()).
 */
export function recordAnswer(recentAnswers, bookId, event) {
  const ts = event.ts ?? Date.now();
  const entry = { ms: event.ms || 0, correct: !!event.correct, ts };
  const existing = (recentAnswers && recentAnswers[bookId]) || [];
  const updated = [...existing, entry].slice(-ANSWER_WINDOW_SIZE);
  return { ...(recentAnswers || {}), [bookId]: updated };
}

/**
 * Compute the median of an array of numbers. Returns null for
 * empty input. Uses the standard "average of middle two for even
 * length" definition.
 */
function median(numbers) {
  if (!numbers || numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * For each book that has ≥ MIN_CORRECT_FOR_MEDIAN correct entries
 * in its window, compute the median of its correct response times.
 * Returns a map { bookId: medianMs }. Books without enough data are
 * omitted.
 *
 * Note: the returned object has STRING keys (a JS-engine artefact of
 * object property keys always being coerced to strings). Its only
 * consumer is getSlowBookIds below, which iterates via Object.entries
 * and then coerces back to Number when populating its Set output.
 */
export function computeBookMedians(recentAnswers) {
  const result = {};
  if (!recentAnswers) return result;
  for (const [bookId, entries] of Object.entries(recentAnswers)) {
    const correctTimes = entries
      .filter(e => e.correct && e.ms > 0)
      .map(e => e.ms);
    if (correctTimes.length >= MIN_CORRECT_FOR_MEDIAN) {
      const m = median(correctTimes);
      if (m != null) result[bookId] = m;
    }
  }
  return result;
}

/**
 * From the per-book median map, identify books whose median exceeds
 * (mean of all medians + 1 stddev). Returns a Set of bookIds AS NUMBERS
 * (see the "Type contract" note at the top of this file).
 * Returns an empty Set if fewer than 2 books have medians (need at
 * least 2 for a meaningful standard deviation).
 *
 * This is criterion 2 ("personally slow") from ADR 0010.
 */
export function getSlowBookIds(bookMedians) {
  const ids = Object.keys(bookMedians);
  if (ids.length < 2) return new Set();
  const values = Object.values(bookMedians);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  // If everyone is uniformly fast (stddev=0), no book is "slow relative
  // to others" — return empty. This is the perfect-run case ADR 0010
  // explicitly preserves.
  if (stddev === 0) return new Set();
  const threshold = mean + stddev;
  const slow = new Set();
  for (const [bookId, m] of Object.entries(bookMedians)) {
    // Number() coercion required — see "Type contract" note at top of
    // file. bookId comes out of Object.entries() as a string; the
    // consumer (getAttentionBooks) looks up by numeric book.id, and
    // Set.has() does not type-coerce.
    if (m > threshold) slow.add(Number(bookId));
  }
  return slow;
}

/**
 * Identify books with at least one miss in their recent window.
 * Returns a Set of bookIds AS NUMBERS (see the "Type contract" note at
 * the top of this file).
 *
 * This is criterion 3 ("recent miss") from ADR 0010. A miss is any
 * entry with correct=false (covers both wrong-tap and time-up).
 */
export function getRecentlyMissedBookIds(recentAnswers) {
  const missed = new Set();
  if (!recentAnswers) return missed;
  for (const [bookId, entries] of Object.entries(recentAnswers)) {
    // Number() coercion required — see "Type contract" note at top of
    // file. Same reason as in getSlowBookIds.
    if (entries.some(e => !e.correct)) missed.add(Number(bookId));
  }
  return missed;
}

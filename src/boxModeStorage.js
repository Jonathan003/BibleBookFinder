// Box Mode personal-best tracking.
//
// Storage shape (per user, in their `boxModeBests` field):
//   {
//     "all":              { fastestMs, fewestMistakes, longestStreak, completions, lastClearAt },
//     "group:law":        { ... },
//     "group:gospels":    { ... },
//     ...
//   }
//
// Each scope is tracked independently — clearing all 66 vs clearing
// Pentateuch are different distances and shouldn't compete. New bests are
// only valid against the same scope.
//
// All values are session-local achievements with no schedule impact.
// Lives on the user record so backups carry it cleanly.

import { getUser, updateUser } from './users';

/**
 * Read all Box Mode bests for a user. Returns the bests object (may be
 * empty {}). Never throws — missing user returns {}.
 */
export function getBoxModeBests(userId) {
  if (!userId) return {};
  const user = getUser(userId);
  if (!user) return {};
  return user.boxModeBests || {};
}

/**
 * Read the best record for one specific scope. Returns null if no
 * completion has ever been recorded for that scope.
 */
export function getBoxModeBestForScope(userId, scope) {
  const all = getBoxModeBests(userId);
  return all[scope] || null;
}

/**
 * Record a completed Box Mode session. Returns an object describing
 * which (if any) personal bests were beaten — used by the end-screen to
 * show "Nieuw record!" badges next to specific stats.
 *
 * @param {string} userId
 * @param {string} scope          'all' | `group:${groupId}`
 * @param {Object} sessionData
 * @param {number} sessionData.elapsedMs
 * @param {number} sessionData.mistakes
 * @param {number} sessionData.longestStreak
 * @returns {{ fastestNew: boolean, fewestMistakesNew: boolean, longestStreakNew: boolean, isFirstCompletion: boolean }}
 */
export function recordCompletion(userId, scope, sessionData) {
  const result = {
    fastestNew: false,
    fewestMistakesNew: false,
    longestStreakNew: false,
    isFirstCompletion: false,
  };
  if (!userId) return result;

  const user = getUser(userId);
  if (!user) return result;

  const allBests = user.boxModeBests || {};
  const prev = allBests[scope] || null;
  const { elapsedMs, mistakes, longestStreak } = sessionData;

  let next;
  if (!prev) {
    // First clear of this scope: every stat is a "new best" by definition,
    // but we flag this as `isFirstCompletion` so the UI can show a more
    // meaningful "first time!" message instead of three "new record"
    // badges that would feel disproportionate on the inaugural clear.
    result.isFirstCompletion = true;
    next = {
      fastestMs: elapsedMs,
      fewestMistakes: mistakes,
      longestStreak: longestStreak,
      completions: 1,
      lastClearAt: Date.now(),
    };
  } else {
    // Compare each stat against the prior record. Strict-better only —
    // ties don't trigger "new best" notifications (spammy and slightly
    // misleading).
    const fastestNew         = elapsedMs      < prev.fastestMs;
    const fewestMistakesNew  = mistakes       < prev.fewestMistakes;
    const longestStreakNew   = longestStreak  > prev.longestStreak;
    result.fastestNew = fastestNew;
    result.fewestMistakesNew = fewestMistakesNew;
    result.longestStreakNew = longestStreakNew;
    next = {
      fastestMs:      fastestNew        ? elapsedMs       : prev.fastestMs,
      fewestMistakes: fewestMistakesNew ? mistakes        : prev.fewestMistakes,
      longestStreak:  longestStreakNew  ? longestStreak   : prev.longestStreak,
      completions:    prev.completions + 1,
      lastClearAt:    Date.now(),
    };
  }

  updateUser(userId, { boxModeBests: { ...allBests, [scope]: next } });
  return result;
}

/**
 * Wipe all Box Mode bests for a user. Called from Settings → Reset
 * Progress (alongside FSRS reset). Caller is expected to confirm with
 * the user before invoking.
 */
export function clearBoxModeBests(userId) {
  if (!userId) return;
  updateUser(userId, { boxModeBests: {} });
}

// Box Mode — single-session Leitner-style training.
//
// Mental model:
//   • All selected books start in Box 1.
//   • A correct answer advances the book one box (1→2→3→4→5).
//   • A wrong answer demotes the book by one (soft) or back to box 1 (strict).
//   • Book 5 is the "rooted" tier — books here are never re-asked.
//   • Session ends when EVERY selected book reaches Box 5.
//
// This is intentionally a CRAM mode: it never touches FSRS, never updates
// the long-term schedule, never affects streaks/tiers. The only data
// produced is a per-scope personal best (see boxModeStorage.js).
//
// Picking algorithm: weighted-random across non-empty lower boxes.
//   Box 1 = 5×, Box 2 = 3×, Box 3 = 2×, Box 4 = 1×, Box 5 = 0× (parked).
// This naturally prioritises books the user is struggling with (low boxes
// see more attention) without ignoring the higher boxes — matching
// Quizlet Learn's "show the term you're closest to forgetting" principle
// without needing ML or per-book ratings.
//
// Anti-repeat rule: never ask the same book twice in a row, regardless of
// its weight. Prevents the "5 wrong answers on Genesis in a row" rage
// pattern that strict weighting alone can produce.
//
// Recovery rule: after 3 consecutive wrong answers, the next 2 turns
// disable demotion (book stays put on a wrong answer instead of
// dropping). Mirrors Obsidian Chess Studio's adaptive failure recovery.
// No on-screen announcement — the difficulty just eases. Once any
// correct answer breaks the streak, normal demotion resumes.

export const BOX_COUNT = 5;
export const TOP_BOX = 5;
export const BOTTOM_BOX = 1;

// Weights for picking. Index 0 is unused (boxes are 1-indexed).
// Box 5 has weight 0 → never picked (rooted).
const PICK_WEIGHTS = [0, 5, 3, 2, 1, 0];

// Recovery rule constants
const RECOVERY_TRIGGER_WRONGS = 3;   // wrong-streak length that triggers easing
const RECOVERY_GRACE_TURNS    = 2;   // turns after the trigger that suppress demotion

/**
 * Create the initial Box Mode state for a fresh session.
 *
 * @param {Object}   params
 * @param {Object[]} params.books       Full bibleBooks list (id, group, etc.)
 * @param {string}   params.scope       'all' | `group:${groupId}` — what subset to drill
 * @param {string}   [params.failMode='soft']  'soft' (drop one box) or 'strict' (back to 1)
 * @param {number}   [params.now=Date.now()]   For testability
 */
export function createInitialState({ books, scope, failMode = 'soft', now = Date.now() }) {
  const selectedBooks = filterBooksByScope(books, scope);
  const bookBoxes = {};
  for (const b of selectedBooks) bookBoxes[b.id] = BOTTOM_BOX;

  return {
    scope,
    failMode,
    selectedBookIds: selectedBooks.map(b => b.id),
    bookBoxes,
    // Currently asked book — null until first pick
    currentBookId: null,
    lastAskedBookId: null,
    // Per-answer history. Trimmed to last 10 entries on read for the
    // recent-answers strip; full history isn't useful and would bloat
    // memory if a user does a long strict-mode session.
    askHistory: [],
    // Streak / mistake tracking (in-session only)
    consecutiveWrong: 0,
    recoveryTurnsRemaining: 0,
    longestStreak: 0,
    currentStreak: 0,
    mistakes: 0,
    // Hint flag: cleared on each new pick. If true when answer commits,
    // the book's box is NOT advanced (hint = no progress on this turn).
    hintUsedOnCurrent: false,
    // Slow flag: set when the soft timer expires before the user
    // answers. Like hintUsedOnCurrent, blocks advancement on a correct
    // answer but doesn't trigger demotion. Cleared on each new pick.
    // Hard-timer mode never sets this — it triggers an auto-wrong
    // answer instead, which is handled at the UI layer.
    slowOnCurrent: false,
    // Timing
    startedAt: now,
    endedAt: null,
  };
}

/**
 * Filter bibleBooks down to the books matching the chosen scope.
 *   'all'              → all 66
 *   'group:law'        → just Pentateuch
 *   'group:gospels'    → just Gospels
 *   …                   → etc.
 */
export function filterBooksByScope(books, scope) {
  if (scope === 'all') return books.slice();
  if (scope.startsWith('group:')) {
    const groupId = scope.slice('group:'.length);
    return books.filter(b => b.group === groupId);
  }
  // v5: multi-scope. Format: 'multi:groupId1+groupId2+...' (group IDs
  // sorted alphabetically by the caller — see computeScopeKey in
  // BoxMode.jsx — so the same combination always maps to the same key
  // for personal-best comparison).
  if (scope.startsWith('multi:')) {
    const groupIds = scope.slice('multi:'.length).split('+');
    const set = new Set(groupIds);
    return books.filter(b => set.has(b.group));
  }
  // Unknown scope: empty selection rather than crash
  return [];
}

/**
 * Pick the next book to ask using weighted-random across non-empty lower
 * boxes, with the anti-repeat rule applied. Returns the book ID, or null
 * if no eligible book exists (i.e. session should be considered done).
 *
 * The algorithm:
 *   1. Build a pool: every selected book in box 1-4, weighted by PICK_WEIGHTS.
 *   2. Filter out the most recently asked book (anti-repeat).
 *   3. If the filter would make the pool empty (e.g. only one book left
 *      that isn't in box 5), bypass the anti-repeat rule rather than fail.
 *   4. Weighted-random pick from the remaining pool.
 */
export function pickNextBookId(state, randomFn = Math.random) {
  // Build initial pool: each (id, weight) where weight > 0
  const fullPool = [];
  for (const id of state.selectedBookIds) {
    const box = state.bookBoxes[id];
    const weight = PICK_WEIGHTS[box] || 0;
    if (weight > 0) fullPool.push({ id, weight });
  }
  if (fullPool.length === 0) return null;  // all in box 5 — session complete

  // Anti-repeat filter
  let pool = fullPool.filter(p => p.id !== state.lastAskedBookId);
  if (pool.length === 0) pool = fullPool;  // single-book situation, bypass

  // Weighted random pick
  const totalWeight = pool.reduce((s, p) => s + p.weight, 0);
  let r = randomFn() * totalWeight;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p.id;
  }
  // Float arithmetic safety net
  return pool[pool.length - 1].id;
}

/**
 * Advance the state to the next turn after the user answers `bookId`.
 *
 * @param {Object}  state
 * @param {Object}  params
 * @param {number}  params.bookId    The book answered (= state.currentBookId in normal flow)
 * @param {boolean} params.correct   Did they get it right
 * @param {number}  [params.now]     Timestamp for askHistory entry
 * @returns {Object} New state (immutable update)
 */
export function applyAnswer(state, { bookId, correct, now = Date.now() }) {
  const currentBox = state.bookBoxes[bookId] ?? BOTTOM_BOX;
  let nextBox = currentBox;

  if (correct) {
    // Hint OR slow-answer flag blocks advancement. Box stays where it is.
    if (!state.hintUsedOnCurrent && !state.slowOnCurrent) {
      nextBox = Math.min(TOP_BOX, currentBox + 1);
    }
  } else {
    // Recovery rule: when grace turns are active, suppress demotion.
    // Otherwise apply soft/strict failure.
    if (state.recoveryTurnsRemaining > 0) {
      // Box stays put — recovery in progress
    } else if (state.failMode === 'strict') {
      nextBox = BOTTOM_BOX;
    } else {
      // soft (default)
      nextBox = Math.max(BOTTOM_BOX, currentBox - 1);
    }
  }

  // Update consecutive-wrong counter and recovery state
  let consecutiveWrong = correct ? 0 : state.consecutiveWrong + 1;
  let recoveryTurnsRemaining = Math.max(0, state.recoveryTurnsRemaining - 1);
  if (!correct && consecutiveWrong === RECOVERY_TRIGGER_WRONGS) {
    // Just hit the threshold — start grace window
    recoveryTurnsRemaining = RECOVERY_GRACE_TURNS;
  }
  if (correct) {
    // A single correct answer ends recovery early — normal play resumes
    recoveryTurnsRemaining = 0;
  }

  // Streak counters
  const currentStreak = correct ? state.currentStreak + 1 : 0;
  const longestStreak = Math.max(state.longestStreak, currentStreak);
  const mistakes = state.mistakes + (correct ? 0 : 1);

  return {
    ...state,
    bookBoxes: { ...state.bookBoxes, [bookId]: nextBox },
    lastAskedBookId: bookId,
    // currentBookId is intentionally NOT cleared here — it must stay set
    // through the entire feedback window (the correct/wrong color flash
    // on the clicked cell). Clearing it caused the BoxMode render guard
    // `if (state.currentBookId == null) return null;` to unmount the
    // whole UI for the ~700ms between answer commit and next pick,
    // which killed the feedback animation. setCurrentBook overwrites
    // currentBookId with the next book ID, so this isn't a leak —
    // it's just keeping the value alive across one render cycle.
    // Re-click protection is handled at the click-handler layer via
    // the `feedback` state guard.
    hintUsedOnCurrent: false,            // reset for next turn
    slowOnCurrent: false,                 // reset for next turn
    consecutiveWrong,
    recoveryTurnsRemaining,
    currentStreak,
    longestStreak,
    mistakes,
    askHistory: [...state.askHistory, { bookId, correct, ts: now }],
  };
}

/**
 * Mark that the hint was used on the current turn. The next applyAnswer
 * with `correct: true` will NOT advance the book's box. Wrong answers are
 * unaffected (they apply normal demotion / recovery).
 */
export function markHintUsed(state) {
  return { ...state, hintUsedOnCurrent: true };
}

/**
 * Mark that the soft timer expired on the current turn. Same effect as
 * markHintUsed for the advancement-suppression rule, but tracked
 * separately so the UI can distinguish "hint" vs "too slow" feedback to
 * the user. Hard-timer mode does NOT call this — it triggers an
 * applyAnswer({ correct: false }) directly to mimic a wrong answer.
 */
export function markSlow(state) {
  return { ...state, slowOnCurrent: true };
}

/**
 * Set the next book to ask. Called after pickNextBookId returns a value.
 */
export function setCurrentBook(state, bookId) {
  return { ...state, currentBookId: bookId, hintUsedOnCurrent: false, slowOnCurrent: false };
}

/**
 * Has every selected book reached the top box?
 */
export function isComplete(state) {
  for (const id of state.selectedBookIds) {
    if ((state.bookBoxes[id] ?? BOTTOM_BOX) < TOP_BOX) return false;
  }
  return true;
}

/**
 * Mark session as ended (sets endedAt). Called when isComplete first becomes
 * true, or when the user manually finishes early.
 */
export function endSession(state, now = Date.now()) {
  return { ...state, endedAt: now };
}

/**
 * How many books are currently in each box. Used by the boxes UI.
 * Returns array of length 5: [box1Count, box2Count, ..., box5Count].
 */
export function getBoxCounts(state) {
  const counts = [0, 0, 0, 0, 0];
  for (const id of state.selectedBookIds) {
    const box = state.bookBoxes[id] ?? BOTTOM_BOX;
    counts[box - 1]++;
  }
  return counts;
}

/**
 * The N most recent answers, oldest-first. Used to render the dot strip.
 * Returns array of { bookId, correct, ts }.
 */
export function getRecentAnswers(state, n = 10) {
  return state.askHistory.slice(-n);
}

/**
 * Total elapsed time in this session, in milliseconds. If endedAt isn't
 * set, uses a provided "now" — useful for live-updating end-screen
 * timestamps if we ever want to display them. In practice we call this
 * after endSession() so endedAt is set.
 */
export function getElapsedMs(state, now = Date.now()) {
  const end = state.endedAt ?? now;
  return Math.max(0, end - state.startedAt);
}

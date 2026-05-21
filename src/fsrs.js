import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs';

// Pace presets map to FSRS desired retention (request_retention).
// Lower retention → longer intervals → lighter daily review pressure,
// at the cost of more occasional forgetting. The "right" value depends
// on the user's life: 0.95 is for diligent daily learners who want
// minimal forgetting; 0.80 is for users with irregular practice time
// who'd rather have fewer reviews than feel guilty about missing days.
//
// 0.80 ('flexible') was added based on FSRS workload research: dropping
// from 0.90 to 0.80 roughly doubles intervals, halving daily review
// count, with all 66 books still reaching Permanent over months — just
// on a gentler curve. The mainstream Anki community recommends 0.85-0.95
// for serious users; for irregular-time learners 0.80 sits exactly in
// the "workload-minimizing" zone that Anki users typically discover
// only after hand-tuning. We surface it as a first-class preset.
const PACE_CONFIG = {
  flexible:  { request_retention: 0.80 },
  relaxed:   { request_retention: 0.85 },
  balanced:  { request_retention: 0.90 },
  intensive: { request_retention: 0.95 },
};

export function createScheduler(pace = 'balanced') {
  return fsrs({
    ...(PACE_CONFIG[pace] || PACE_CONFIG.balanced),
    maximum_interval: 365,
    enable_fuzz: true,
    enable_short_term: true,
  });
}

export function createBookCard() {
  return createEmptyCard(new Date());
}

// Convert response speed to FSRS rating (only for correct answers).
// Correct-but-very-slow still gets Hard (not Again) — the user DID find
// the right cell, just slowly, and we want that reflected in scheduling.
export function ratingFromSpeed(timeTaken, masteryMs) {
  if (timeTaken <= masteryMs * 0.4) return Rating.Easy;  // very fast
  if (timeTaken <= masteryMs)       return Rating.Good;  // within time
  return Rating.Hard;                                    // slow (or very slow) but correct
}

// Review a book and get updated card
export function reviewBook(scheduler, card, rating) {
  const result = scheduler.next(card, new Date(), rating);
  return result;
}

// ─── Learn Ahead Limit ────────────────────────────────────────────────
// Cards in Learning or Relearning state typically have very short
// intervals (minutes, not days). Without this limit, a card scheduled
// 90 seconds in the future shows the menu as "DUE = 0", but the moment
// the user closes the screen and reopens it, the same card snaps to
// "DUE = 1" — confusing and slightly demoralizing.
//
// Pattern from RemNote / Anki: count short-interval cards as currently
// due if they're within ~15 minutes of being due. The user is in a
// session anyway; pulling the next short-interval review forward by a
// few minutes has negligible effect on FSRS calibration (early reviews
// give smaller stability gains automatically) and removes the UX
// flicker entirely.
//
// The limit applies to Learning and Relearning only — Review-state
// cards have intervals measured in days, so a "15 minutes early" pull
// against a multi-day interval would actually distort scheduling.
export const LEARN_AHEAD_MS = 15 * 60 * 1000;

// Single source of truth for "is this card due right now?". Used by
// getDueBooks (drives pickNextBook) and getBookStats (drives the menu's
// readyToPractice / dueNow stat). Keeping these aligned matters: if the
// menu says DUE=0 but pickNextBook can still find a Learning card 5
// minutes out, the eliminated-Branch-4 session-complete screen would
// briefly flash before pickNextBook handed back a card.
export function isDueNow(cardData, now = new Date()) {
  if (!cardData) return false; // unseen handled separately by callers
  const due = cardData.due instanceof Date ? cardData.due : new Date(cardData.due);
  if (due <= now) return true;
  const isShortInterval = cardData.state === State.Learning || cardData.state === State.Relearning;
  if (!isShortInterval) return false;
  return due.getTime() - now.getTime() <= LEARN_AHEAD_MS;
}

// Get books that are due for review
export function getDueBooks(fsrsCards, allBooks) {
  const now = new Date();
  const due = [];
  const unseen = [];

  allBooks.forEach(book => {
    const cardData = fsrsCards[book.id];
    if (!cardData) {
      unseen.push(book);
    } else if (isDueNow(cardData, now)) {
      const dueDate = new Date(cardData.due);
      // overdueDays is negative for Learn-Ahead-Limit pulls (card is
      // technically a few minutes in the future). Negative values sort
      // below truly-overdue cards in the descending sort below, which
      // is what we want — pull legitimately-overdue first, then
      // about-to-be-due Learning cards.
      const overdueDays = (now - dueDate) / (1000 * 60 * 60 * 24);
      due.push({ book, overdueDays });
    }
  });

  // Sort by most overdue first
  due.sort((a, b) => b.overdueDays - a.overdueDays);

  return {
    dueBooks: due.map(d => d.book),
    unseenBooks: unseen,
    totalDue: due.length,
    totalUnseen: unseen.length,
  };
}

// Serialize card for localStorage (dates → ISO strings)
export function serializeCard(card) {
  return {
    ...card,
    due: card.due instanceof Date ? card.due.toISOString() : card.due,
    last_review: card.last_review instanceof Date ? card.last_review.toISOString() : card.last_review,
  };
}

// Deserialize card from localStorage (ISO strings → Dates)
export function deserializeCard(cardData) {
  return {
    ...cardData,
    due: new Date(cardData.due),
    last_review: cardData.last_review ? new Date(cardData.last_review) : undefined,
  };
}

// Mastery check: stability alone is not enough — the learner must have
// reviewed the book at least MASTERY_MIN_REPS times.  Without this guard
// a single fast "Easy" answer can push stability above the threshold
// on the very first attempt, giving a false sense of mastery.
export const MASTERY_MIN_REPS = 3;

export function isMastered(cardData) {
  if (!cardData) return false;
  return cardData.state === State.Review
    && cardData.stability > 7
    && (cardData.reps || 0) >= MASTERY_MIN_REPS;
}

// ─── Tier overlay ──────────────────────────────────────────────────────
// Discrete named tiers derived from FSRS card state, inspired by
// WaniKani's Apprentice→Guru→Master→Enlightened→Burned ladder. The
// underlying FSRS scheduler is unchanged — these tiers are a *display*
// layer that gives the learner a tangible "next step" beyond the binary
// rooted/not-rooted split. Six tiers:
//   - 'unseen' covers books with no card yet (fresh user / after reset)
//   - 'learned' is the moment between first answer and Review state
//     (FSRS's Learning/Relearning) — visible feedback that something
//     happened without overpromising stability
//   - 'familiar' = entered Review state but not yet stable (<7d)
//   - 'rooted' = the existing isMastered() condition (renamed in v4 from
//     'mastered' to free the word 'mastered' from collision with the
//     new 'confident' gold-line signal). Same threshold: stability >7d
//     plus reps >= MASTERY_MIN_REPS.
//   - 'anchored' = stability >30d, takes ~1-2 months at default pace
//   - 'permanent' = stability >180d, takes 4-6+ months — the WaniKani
//     'Burned' equivalent and a real long-term goal
//
// Thresholds were chosen to roughly match natural FSRS progression at
// request_retention=0.9 (Balanced pace). With Intensive pace (0.95)
// users move through the tiers slightly slower; with Relaxed (0.85)
// slightly faster.
export const TIERS = ['unseen', 'learned', 'familiar', 'rooted', 'anchored', 'permanent'];

// Numeric ordering, useful for "is X higher than Y" comparisons
export const TIER_ORDER = Object.fromEntries(TIERS.map((t, i) => [t, i]));

export function getTier(cardData) {
  if (!cardData) return 'unseen';
  const stability = cardData.stability || 0;
  const reps = cardData.reps || 0;

  // Defensive: a card with reps=0 shouldn't exist (it would have been
  // returned from createEmptyCard but never reviewed) — treat as unseen.
  if (reps === 0) return 'unseen';

  // Still in Learning or Relearning: the user has seen the book but
  // FSRS hasn't promoted it to Review state yet. Don't claim 'familiar'
  // — that implies stability the system hasn't confirmed.
  if (cardData.state !== State.Review) return 'learned';

  // In Review state — promote based on stability
  if (stability > 180) return 'permanent';
  if (stability > 30)  return 'anchored';
  if (stability > 7 && reps >= MASTERY_MIN_REPS) return 'rooted';
  return 'familiar';
}

// Counts of books in each tier. Always returns all six keys (with zero
// counts for empty tiers) so the UI can render a stable layout without
// null-checks.
export function getTierStats(fsrsCards, allBooks) {
  const counts = { unseen: 0, learned: 0, familiar: 0, rooted: 0, anchored: 0, permanent: 0 };
  allBooks.forEach(book => {
    counts[getTier(fsrsCards[book.id])]++;
  });
  return { ...counts, total: allBooks.length };
}

// ─── Confident: the in-session gold-line signal (v4) ──────────────────
// "Confident" is the new criterion for the gold line under a book cell.
// Unlike the FSRS-based isMastered() (which requires stability >7d,
// taking ~3-4 well-spaced reps over multiple days), confident is
// achievable within a single 30-minute session — making a "race to all
// 66 gold" goal feasible for users who already partly know the answers.
//
// Definition: confident = the last CONFIDENT_BUFFER_SIZE attempts on
// this book were ALL correct AND within masteryMs. A wrong answer or a
// correct-but-slow answer pushes `false` to the buffer, knocking out
// the gold line. Three more correct-and-fast answers re-earn it.
//
// Data shape: per book, a buffer (array of booleans, length up to
// CONFIDENT_BUFFER_SIZE). `true` = correct AND fast on that attempt.
// `false` = wrong, or correct but slow. The buffer is FIFO: the
// newest entry is pushed onto the end, and the oldest falls off the
// front once the buffer reaches size.
//
// FSRS still runs underneath (deciding which book to ask next based on
// stability), but the gold-line signal is decoupled from FSRS's calendar.
export const CONFIDENT_BUFFER_SIZE = 3;

// Returns true if the buffer is full AND every entry is a good hit.
// Anything else (empty buffer, partial buffer, any false entry) → false.
export function isConfident(buffer) {
  if (!Array.isArray(buffer)) return false;
  if (buffer.length < CONFIDENT_BUFFER_SIZE) return false;
  return buffer.every(entry => entry === true);
}

// Push a new attempt onto the buffer. Returns the new buffer (FIFO,
// capped at CONFIDENT_BUFFER_SIZE). `isGoodHit` should be true only if
// the answer was correct AND within masteryMs.
export function recordConfidentAttempt(buffer, isGoodHit) {
  const current = Array.isArray(buffer) ? buffer : [];
  return [...current, !!isGoodHit].slice(-CONFIDENT_BUFFER_SIZE);
}

// How many books in the corpus are currently confident.
export function getConfidentCount(confidentBuffers, allBooks) {
  let count = 0;
  allBooks.forEach(book => {
    if (isConfident(confidentBuffers?.[book.id])) count++;
  });
  return count;
}

// Migration helper (v3 → v4): for each book where the FSRS card meets
// the old isMastered() criterion, pre-fill the confident buffer with
// CONFIDENT_BUFFER_SIZE good-hit entries. Returns a fresh buffers map
// (does NOT mutate the input). Use case: existing users who had gold
// lines under their FSRS-mastered books should keep them visible after
// the upgrade, not watch them all disappear.
export function migrateConfidentBuffers(fsrsCards, allBooks, existingBuffers = {}) {
  const out = { ...existingBuffers };
  allBooks.forEach(book => {
    if (out[book.id]) return; // user already has a buffer for this book
    if (isMastered(fsrsCards[book.id])) {
      out[book.id] = new Array(CONFIDENT_BUFFER_SIZE).fill(true);
    }
  });
  return out;
}

// Books that aren't currently confident, ordered by closeness to gold.
// Used by the home-screen launcher when no FSRS-due books exist (so the
// user can always train toward all-66-gold instead of being told to
// stop), and by pickNextBook as a fallback (same idea, mid-session).
//
// Ordering rationale: a buffer with 2 trues is one good hit away from
// gold — most rewarding. 1 true is two good hits away. Unseen books
// have no buffer yet — same "3 good hits needed" distance as 0 trues,
// but unseen feels like progress (you're seeing it for the first time)
// while 0 trues is regression (you HAD it, you lost it). So unseen is
// ranked above lost-confidence. Within each band, FSRS-stability
// ascending — less stable books benefit more from a rep.
export function getNonConfidentBooks(confidentBuffers, fsrsCards, allBooks) {
  return allBooks
    .filter(b => !isConfident(confidentBuffers?.[b.id]))
    .map(b => {
      const buf = confidentBuffers?.[b.id];
      const trueCount = Array.isArray(buf) ? buf.filter(x => x === true).length : 0;
      const hasSeen = Array.isArray(buf) && buf.length > 0;
      let priority;
      if (trueCount === 2) priority = 3;
      else if (trueCount === 1) priority = 2;
      else if (!hasSeen) priority = 1;
      else priority = 0; // lost confidence
      const stability = fsrsCards?.[b.id]?.stability || 0;
      return { book: b, priority, stability };
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.stability - b.stability;
    })
    .map(x => x.book);
}

// ADR 0009: get books for the "attention" scope in Box Mode. A book belongs
// in the attention set when at least one of:
//   1. Its FSRS difficulty is a statistical outlier (> mean + 1σ) compared
//      to other books with cards — i.e., personally hard for this user.
//   2. It is FSRS-due NOW — i.e., overdue by the schedule.
// Unseen books (no card) are excluded entirely.
//
// Returns { books, eligible, reason } so callers can render the disabled
// state with the right explanation. The function does NOT mutate any FSRS
// data — pure read.
//
// Disabled reasons:
//   'insufficient-data' — fewer than MIN_CARDS_FOR_STATS books have cards
//   'no-outliers'       — no books match either criterion (user is doing fine)
//   'too-few'           — matches exist but < MIN_ATTENTION_BOOKS (not enough
//                         for a useful Box Mode session)
export function getAttentionBooks(fsrsCards, allBooks, now = new Date()) {
  const MIN_CARDS_FOR_STATS = 20;
  const MIN_ATTENTION_BOOKS = 3;

  // Collect books that have FSRS cards (skip Unseen).
  const withCards = allBooks
    .map(b => ({ book: b, card: fsrsCards?.[b.id] }))
    .filter(x => x.card != null);

  if (withCards.length < MIN_CARDS_FOR_STATS) {
    return { books: [], eligible: false, reason: 'insufficient-data' };
  }

  // Compute mean and standard deviation of difficulty across books with cards.
  const difficulties = withCards.map(x => x.card.difficulty || 0);
  const mean = difficulties.reduce((a, b) => a + b, 0) / difficulties.length;
  const variance = difficulties.reduce((sum, d) => sum + (d - mean) ** 2, 0) / difficulties.length;
  const stddev = Math.sqrt(variance);
  const threshold = mean + stddev;

  // Build attention set: union of (difficulty > threshold) and (FSRS-due).
  const attention = withCards.filter(({ card }) => {
    const isHigh = (card.difficulty || 0) > threshold;
    const isDue = isDueNow(card, now);
    return isHigh || isDue;
  }).map(x => x.book);

  if (attention.length === 0) {
    return { books: [], eligible: false, reason: 'no-outliers' };
  }
  if (attention.length < MIN_ATTENTION_BOOKS) {
    return { books: [], eligible: false, reason: 'too-few' };
  }

  return { books: attention, eligible: true, reason: null };
}

// Get stats summary for display
export function getBookStats(fsrsCards, allBooks) {
  let mastered = 0;
  let learning = 0;
  let unseen = 0;
  let dueNow = 0;
  const now = new Date();

  allBooks.forEach(book => {
    const cardData = fsrsCards[book.id];
    if (!cardData) {
      unseen++;
      dueNow++;
      return;
    }
    if (isMastered(cardData)) {
      mastered++;
    } else {
      learning++;
    }
    // Use the same Learn-Ahead-Limit-aware predicate as getDueBooks so
    // the menu's "Klaar om te oefenen" count matches what pickNextBook
    // will actually find. Without this, a Learning card scheduled in
    // 5 minutes shows dueNow=0 on the menu but pickNextBook would still
    // find it — causing the new session-complete screen to flash and
    // immediately disappear.
    if (isDueNow(cardData, now)) {
      dueNow++;
    }
  });

  return { mastered, learning, unseen, dueNow, total: allBooks.length };
}

export { Rating, State };

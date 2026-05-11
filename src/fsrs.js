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

// Books NOT currently due but with a card — i.e. legitimate Train Ahead
// candidates. Returned sorted by `due` ascending (closest-to-due first),
// matching the spec's "FSRS-ordered, NOT random" requirement.
//
// Unseen books are excluded: they're already picked up by Branch 2 of
// pickNextBook before the session-complete screen ever activates.
// Including them as Train Ahead candidates would let the user "train
// ahead" on books FSRS already considers due, which is just confusing.
export function getTrainAheadCandidates(fsrsCards, allBooks, now = new Date()) {
  const candidates = [];
  allBooks.forEach(book => {
    const card = fsrsCards[book.id];
    if (!card) return;
    if (isDueNow(card, now)) return;
    candidates.push({ book, due: new Date(card.due) });
  });
  candidates.sort((a, b) => a.due - b.due);
  return candidates;
}

// Build a Train Ahead queue for a given horizon. Returns an array of
// books in due-ascending order (the order they'll be presented in the
// quiz). Horizons:
//   'count5'    — 5 closest-to-due
//   'count10'   — 10 closest-to-due
//   'week'      — all books due within the next 7 days (calendar)
//   'remaining' — every non-due book with a card
export function buildTrainAheadQueue(fsrsCards, allBooks, horizon, now = new Date()) {
  const candidates = getTrainAheadCandidates(fsrsCards, allBooks, now);
  if (horizon === 'count5')    return candidates.slice(0, 5).map(c => c.book);
  if (horizon === 'count10')   return candidates.slice(0, 10).map(c => c.book);
  if (horizon === 'remaining') return candidates.map(c => c.book);
  if (horizon === 'week') {
    const cutoff = now.getTime() + 7 * 24 * 60 * 60 * 1000;
    return candidates.filter(c => c.due.getTime() <= cutoff).map(c => c.book);
  }
  return [];
}

// Counts per horizon — used to disable submenu options that would
// produce zero books, and to disable the parent Train Ahead button
// itself when no horizon has any candidates.
export function getTrainAheadCounts(fsrsCards, allBooks, now = new Date()) {
  const candidates = getTrainAheadCandidates(fsrsCards, allBooks, now);
  const cutoff = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  return {
    count5: Math.min(5, candidates.length),
    count10: Math.min(10, candidates.length),
    week: candidates.filter(c => c.due.getTime() <= cutoff).length,
    remaining: candidates.length,
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
// mastered/not-mastered split. Six tiers were chosen because:
//   - 'unseen' covers books with no card yet (fresh user / after reset)
//   - 'learned' is the moment between first answer and Review state
//     (FSRS's Learning/Relearning) — visible feedback that something
//     happened without overpromising stability
//   - 'familiar' = entered Review state but not yet stable (<7d)
//   - 'mastered' = the existing isMastered() condition; preserves the
//     gold-line UX and the legacy milestone definitions
//   - 'anchored' = stability >30d, takes ~1-2 months at default pace
//   - 'permanent' = stability >180d, takes 4-6+ months — the WaniKani
//     'Burned' equivalent and a real long-term goal
//
// Thresholds were chosen to roughly match natural FSRS progression at
// request_retention=0.9 (Balanced pace). With Intensive pace (0.95)
// users move through the tiers slightly slower; with Relaxed (0.85)
// slightly faster. That's intentional — the pace setting already
// expresses how much grind the user wants.
export const TIERS = ['unseen', 'learned', 'familiar', 'mastered', 'anchored', 'permanent'];

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
  if (stability > 7 && reps >= MASTERY_MIN_REPS) return 'mastered';
  return 'familiar';
}

// Counts of books in each tier. Always returns all six keys (with zero
// counts for empty tiers) so the UI can render a stable layout without
// null-checks.
export function getTierStats(fsrsCards, allBooks) {
  const counts = { unseen: 0, learned: 0, familiar: 0, mastered: 0, anchored: 0, permanent: 0 };
  allBooks.forEach(book => {
    counts[getTier(fsrsCards[book.id])]++;
  });
  return { ...counts, total: allBooks.length };
}

// Count books that are one rep away from being Mastered: state=Review,
// stability already past the >7d threshold, but reps still below
// MASTERY_MIN_REPS. These books visually live in the Familiar tier on
// the home menu, so without an explicit indicator the user has no
// signal that "1 more correct answer promotes this to Mastered".
// Surfacing this count answers the otherwise-mysterious question
// "I've answered this book correctly twice — why am I still on
// Familiar?" by making the rep-gate transparent.
export function countCloseToMastery(fsrsCards, allBooks) {
  let count = 0;
  allBooks.forEach(book => {
    const card = fsrsCards[book.id];
    if (!card) return;
    if (card.state === State.Review
        && (card.stability || 0) > 7
        && (card.reps || 0) === MASTERY_MIN_REPS - 1) {
      count++;
    }
  });
  return count;
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

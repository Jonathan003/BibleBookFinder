import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs';

const PACE_CONFIG = {
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

// Get books that are due for review
export function getDueBooks(fsrsCards, allBooks) {
  const now = new Date();
  const due = [];
  const unseen = [];

  allBooks.forEach(book => {
    const cardData = fsrsCards[book.id];
    if (!cardData) {
      unseen.push(book);
    } else {
      const dueDate = new Date(cardData.due);
      if (dueDate <= now) {
        const overdueDays = (now - dueDate) / (1000 * 60 * 60 * 24);
        due.push({ book, overdueDays });
      }
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
    if (new Date(cardData.due) <= now) {
      dueNow++;
    }
  });

  return { mastered, learning, unseen, dueNow, total: allBooks.length };
}

export { Rating, State };

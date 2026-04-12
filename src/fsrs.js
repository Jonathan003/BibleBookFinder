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

// Convert response speed to FSRS rating (only for correct answers)
export function ratingFromSpeed(timeTaken, masteryMs) {
  if (timeTaken <= masteryMs * 0.4) return Rating.Easy;     // very fast
  if (timeTaken <= masteryMs)       return Rating.Good;      // within time
  if (timeTaken <= masteryMs * 2)   return Rating.Hard;      // slow but correct
  return Rating.Hard;                                         // very slow but correct
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
    if (cardData.state === State.Review && cardData.stability > 7) {
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

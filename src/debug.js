// Debug logging module — only active when ?debug=true is in the URL.
//
// Activate by visiting the app with ?debug=true (or ?debug=1 etc.). Open
// F12 → Console to see structured per-question logs and end-of-session
// summaries. Useful for answering questions like:
//   - "I have 50 mastered, due=0, but never reach 66 — why?"
//   - "Am I getting closer to mastery on book X?"
//   - "Which branch of pickNextBook served this question?"
//
// All logs are local to the user's browser. Nothing is sent anywhere.
// Other users (without ?debug=true) see no console output and no overhead.

import { isMastered, MASTERY_MIN_REPS } from './fsrs';

const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
const debugFlag = params.get('debug');
export const DEBUG_ENABLED = debugFlag === 'true' || debugFlag === '1' || debugFlag === 'yes';

let questionCounter = 0;
let sessionStats = null;

function formatDays(ms) {
  if (!ms || ms === 0) return '0d';
  const days = ms / (1000 * 60 * 60 * 24);
  if (Math.abs(days) < 1) {
    const hours = days * 24;
    return Math.abs(hours) < 1 ? `${(hours * 60).toFixed(0)}min` : `${hours.toFixed(1)}h`;
  }
  return `${days.toFixed(1)}d`;
}

function formatDueRelative(dueDate, now) {
  if (!dueDate) return 'unseen';
  const due = new Date(dueDate);
  const diffMs = due - now;
  if (diffMs < 0) return `${formatDays(-diffMs)}_overdue`;
  return `in_${formatDays(diffMs)}`;
}

// Log when a session starts. Reset counters and capture initial state.
export function logSessionStart(fsrsCards, allBooks) {
  if (!DEBUG_ENABLED) return;
  questionCounter = 0;
  sessionStats = {
    branchUsage: { 'due-pool': 0, 'unseen-from-due': 0, 'unseen': 0, 'random-from-66': 0 },
    newlyMastered: [],
    masteredServed: 0,
    nonMasteredServed: 0,
    startTime: Date.now(),
  };

  const mastered = allBooks.filter(b => fsrsCards[b.id] && isMastered(fsrsCards[b.id])).length;
  const inProgress = allBooks.filter(b => fsrsCards[b.id] && !isMastered(fsrsCards[b.id])).length;
  const unseen = allBooks.filter(b => !fsrsCards[b.id]).length;

  console.group('%c[BibleBookFinder Debug] Session Start', 'color:#7C3AED;font-weight:bold');
  console.log(`Mastered: ${mastered}/66`);
  console.log(`In progress (seen, not mastered): ${inProgress}`);
  console.log(`Unseen: ${unseen}`);
  console.log(`Mastery rule: state=Review && stability>7d && reps>=${MASTERY_MIN_REPS}`);
  console.groupEnd();
}

// Log a single question pick. Call from pickNextBook AFTER a book is selected
// but BEFORE state is set, so we know which branch was used.
export function logBookPick(book, cardData, branch, dueBooks, unseenBooks, allBooks, fsrsCards) {
  if (!DEBUG_ENABLED) return;
  questionCounter++;
  if (sessionStats) sessionStats.branchUsage[branch] = (sessionStats.branchUsage[branch] || 0) + 1;

  const now = new Date();
  const wasMastered = cardData ? isMastered(cardData) : false;

  if (sessionStats) {
    if (wasMastered) sessionStats.masteredServed++;
    else sessionStats.nonMasteredServed++;
  }

  const masteredCount = allBooks.filter(b => fsrsCards[b.id] && isMastered(fsrsCards[b.id])).length;

  const stateStr = cardData ? `state:${cardData.state}` : 'state:NEW';
  const repStr = cardData ? `rep:${cardData.reps || 0}` : 'rep:0';
  const stabStr = cardData ? `stab:${(cardData.stability || 0).toFixed(1)}d` : 'stab:0';
  const dueStr = cardData ? `due:${formatDueRelative(cardData.due, now)}` : 'unseen';

  const masteryFlag = wasMastered ? ' [MASTERED]' : '';
  const branchColor = branch === 'random-from-66' ? '#F97316' : '#3B82F6';

  console.log(
    `%c[Q${questionCounter}]%c ${book.name.padEnd(15)} | ${stateStr} ${repStr} ${stabStr} ${dueStr} | %cbranch:${branch}%c | pool: due=${dueBooks.length} unseen=${unseenBooks.length} mastered=${masteredCount}/66${masteryFlag}`,
    'color:#7C3AED;font-weight:bold',
    'color:inherit',
    `color:${branchColor};font-weight:bold`,
    'color:inherit'
  );
}

// Log the result of an answer — called after FSRS processes the rating.
export function logAnswerResult(book, prevCardData, newCardData, rating) {
  if (!DEBUG_ENABLED) return;

  const wasMastered = prevCardData ? isMastered(prevCardData) : false;
  const isNowMastered = isMastered(newCardData);
  const justMastered = !wasMastered && isNowMastered;

  if (justMastered && sessionStats) {
    sessionStats.newlyMastered.push(book.name);
  }

  const ratingNames = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
  const ratingName = ratingNames[rating] || `Rating${rating}`;

  const newRep = newCardData.reps || 0;
  const newStab = (newCardData.stability || 0).toFixed(1);
  const newState = newCardData.state;

  let masteryNote = '';
  if (justMastered) {
    masteryNote = '%c ✓ NEWLY MASTERED!';
  } else if (isNowMastered) {
    masteryNote = ' (already mastered, maintenance)';
  } else {
    const stabNeeded = (7 - (newCardData.stability || 0)).toFixed(1);
    const repsNeeded = MASTERY_MIN_REPS - newRep;
    if (repsNeeded > 0) {
      masteryNote = ` (needs ${repsNeeded} more correct rep${repsNeeded > 1 ? 's' : ''})`;
    } else if (stabNeeded > 0) {
      masteryNote = ` (needs +${stabNeeded}d stability)`;
    }
  }

  if (justMastered) {
    console.log(
      `      → ${ratingName} → state:${newState} rep:${newRep} stab:${newStab}d${masteryNote}`,
      'color:#10B981;font-weight:bold'
    );
  } else {
    console.log(`      → ${ratingName} → state:${newState} rep:${newRep} stab:${newStab}d${masteryNote}`);
  }
}

// Log session summary — called when finishSession runs.
export function logSessionEnd(fsrsCards, allBooks) {
  if (!DEBUG_ENABLED || !sessionStats) return;

  const durationSec = ((Date.now() - sessionStats.startTime) / 1000).toFixed(0);
  const durationStr = durationSec >= 60 ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : `${durationSec}s`;

  const nonMastered = allBooks
    .filter(b => fsrsCards[b.id] && !isMastered(fsrsCards[b.id]))
    .map(b => ({
      name: b.name,
      reps: fsrsCards[b.id].reps || 0,
      stability: fsrsCards[b.id].stability || 0,
    }))
    .sort((a, b) => {
      // Sort by closeness to mastery: high reps first, then high stability
      const aScore = Math.min(a.reps, 3) * 10 + Math.min(a.stability, 7);
      const bScore = Math.min(b.reps, 3) * 10 + Math.min(b.stability, 7);
      return bScore - aScore;
    });

  console.group('%c[BibleBookFinder Debug] Session End', 'color:#7C3AED;font-weight:bold');
  console.log(`Duration: ${durationStr}`);
  console.log(`Questions answered: ${questionCounter}`);
  console.log('Branch usage:', sessionStats.branchUsage);
  console.log(`Already-mastered served (maintenance): ${sessionStats.masteredServed}`);
  console.log(`Non-mastered served: ${sessionStats.nonMasteredServed}`);

  if (sessionStats.newlyMastered.length > 0) {
    console.log(`%cNewly mastered this session: ${sessionStats.newlyMastered.join(', ')}`, 'color:#10B981;font-weight:bold');
  } else {
    console.log('%cNewly mastered this session: 0', 'color:#F97316');
  }

  if (nonMastered.length > 0) {
    console.group(`Non-mastered books (${nonMastered.length}, sorted by closeness to mastery):`);
    nonMastered.forEach(b => {
      const repsNeeded = Math.max(0, MASTERY_MIN_REPS - b.reps);
      const stabNeeded = Math.max(0, 7 - b.stability);
      const status = repsNeeded > 0
        ? `needs ${repsNeeded} more rep${repsNeeded > 1 ? 's' : ''}`
        : stabNeeded > 0
          ? `needs +${stabNeeded.toFixed(1)}d stability`
          : 'should be mastered next correct rep';
      console.log(`  ${b.name.padEnd(15)} rep:${b.reps} stab:${b.stability.toFixed(1)}d  (${status})`);
    });
    console.groupEnd();
  }
  console.groupEnd();

  sessionStats = null;
}

// Log when "no books due, falling back to random from all 66" — special
// because this is the scenario where users feel stuck.
export function logBranch4Warning(masteredCount, allCount) {
  if (!DEBUG_ENABLED) return;
  if (masteredCount > allCount * 0.5) {
    console.warn(
      `%c⚠ DUE=0 with ${masteredCount}/${allCount} mastered. ${(masteredCount / allCount * 100).toFixed(0)}% chance the next book is already mastered (no progress). Consider stopping the session.`,
      'color:#F97316;font-weight:bold'
    );
  }
}

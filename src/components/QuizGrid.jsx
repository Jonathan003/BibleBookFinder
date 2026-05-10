import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { bibleBooks, groupColors, groupNames, getBookDisplayName } from '../data';
import { useAppConfig } from '../App';
import { useGridLayout } from '../useGridLayout';
import { useTimeoutManager } from '../useTimeoutManager';
import {
  createScheduler, createBookCard, ratingFromSpeed,
  reviewBook, getDueBooks, serializeCard, deserializeCard,
  Rating, getBookStats, isMastered,
  buildTrainAheadQueue, getTrainAheadCounts,
} from '../fsrs';
import { getNextDueTime, formatNextDue } from '../forecast';
import { computeTodayStats } from '../streak';
import { logSessionStart, logBookPick, logAnswerResult, logSessionEnd } from '../debug';
import { formatDuration } from '../timeFormat';
import './QuizGrid.css';

// Per-question cap for the cumulative training-time counter. If the user
// takes longer than this on a single question (typically because they
// walked away, locked their phone, or got distracted by a notification),
// only this many milliseconds count toward totalQuizMs for that question.
//
// 30s is an absolute "AFK detection" threshold, NOT relative to masteryMs.
// Genuine hard-thinking on a difficult book rarely exceeds this regardless
// of the user's mastery setting; longer is almost always idle time. This
// is the same idea as Anki's "Maximum answer seconds" setting (default
// 60s in Anki) — we use 30s because book identification is simpler than
// recalling a flashcard answer.
//
// The cap protects the share-message claim ("X books mastered in Y time")
// from being inflated by AFK moments. Without it, a single sleeping-with-
// the-app-open incident could add hours of fake training time. The same
// cap is applied per-question to the per-segment `sessionMs` accumulator
// (see resetSegment) so segment durationMs is honest too.
const MAX_ANSWER_MS = 30000;

// How long to pause between a correct answer and picking the next book.
// Scales with the user's masteryMs setting because that's their declared
// expected pace: someone with masteryMs=1000 (1s target) wants a snappy
// flow, someone with masteryMs=10000 (10s target) is more contemplative
// and benefits from a longer pause to register the green feedback.
//
// Formula: 50% of masteryMs, clamped between 250ms and 800ms.
//   - 250ms minimum: below this, the green "correct" feedback is barely
//     perceived (Nielsen Norman Group: ~230ms is human visual perception
//     threshold). Below this users wouldn't see their own success.
//   - 800ms maximum: above this, the pause feels like a delay (Material
//     Design pegs 500ms as the upper bound for "responsive" feedback;
//     800ms is our pre-existing value, kept as ceiling for compatibility).
//
// Examples:
//   masteryMs=10000 → 800ms (capped — same as before)
//   masteryMs=1000  → 500ms (responsive but visible)
//   masteryMs=500   → 250ms (capped — minimum perceptible)
function autoPickDelayMs(masteryMs) {
  return Math.min(800, Math.max(250, Math.round(masteryMs * 0.5)));
}

export default function QuizGrid({
  ownerUserId, fsrsCards, updateFsrsCard, bestTimes, updateBestTime,
  bestStreak, setBestStreak, addQuizSession, addTrainingTime,
  totalQuizMs = 0, quizHistory = [],
  onBack, onPhaseChange,
}) {
  const { config, t, lang } = useAppConfig();
  const [targetBook, setTargetBook] = useState(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [startTime, setStartTime] = useState(null);
  const [responseTime, setResponseTime] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [responseTimes, setResponseTimes] = useState([]);

  const [hintVisible, setHintVisible] = useState(false);
  const [sessionMasteredBooks, setSessionMasteredBooks] = useState(new Set());
  const [sessionHintedBooks, setSessionHintedBooks] = useState(new Set());
  const [sessionWrongBooks, setSessionWrongBooks] = useState(new Set());
  // Every book that appeared in the current segment, regardless of
  // whether it was answered right, wrong, with hint, etc. Used to
  // populate quizHistory.seenBookIds, which the session-complete
  // screen aggregates for "Vandaag: N boeken". Sets are serialized
  // to arrays at save time.
  const [sessionSeenBooks, setSessionSeenBooks] = useState(new Set());
  const [correctBookId, setCorrectBookId] = useState(null);
  const [sessionNewBests, setSessionNewBests] = useState(0);
  // Per-segment accumulator of capped per-question elapsed times. Sums
  // both correct and wrong answers (capped at MAX_ANSWER_MS each) so
  // the saved durationMs reflects engagement-time, not wall-clock time
  // (which would include idle/AFK).
  const [sessionMs, setSessionMs] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [milestone, setMilestone] = useState(null); // message string | null
  const [showNewBest, setShowNewBest] = useState(false);
  // Snapshot of the time that earned the current "new record" badge. Kept
  // separate from `responseTime` because the badge has its own 1.5s
  // visibility timer — `responseTime` may be cleared (by picking the next
  // book) before the badge fades out, which previously caused "nullms" to
  // briefly render. Reading from this snapshot ensures the badge always
  // shows the time that actually earned it.
  const [newBestTime, setNewBestTime] = useState(null);

  // ─── Session-complete + Train Ahead state ─────────────────────────
  // sessionComplete replaces the eliminated Branch 4. When true, the
  // component renders the session-complete screen instead of the book
  // grid. Triggered when (a) initial pick has no due+no unseen books,
  // (b) the last due book is answered, or (c) a Train Ahead queue is
  // exhausted.
  const [sessionComplete, setSessionComplete] = useState(false);
  // Submenu open/closed state for the "Train vooruit ▾" expander.
  const [trainAheadMenuOpen, setTrainAheadMenuOpen] = useState(false);
  // The Train Ahead queue, when an extra-practice run is in progress.
  // null  = no Train Ahead session active (regular due-book flow).
  // []    = transient empty state (immediately transitions to complete).
  // [...] = books to ask in order (FSRS-ordered, closest-to-due first).
  //
  // Stored in BOTH a ref and state. The ref is the synchronous source
  // of truth (read inside callbacks like pickNextBook); the state copy
  // is solely for triggering re-renders. Without the ref, scheduled
  // pickNextBook calls would fire with a stale closure (trainAheadQueue
  // = whatever it was at scheduling time, not what setState just wrote).
  // Both are updated through setTrainAheadQueue below — never separately.
  const trainAheadQueueRef = useRef(null);
  const [trainAheadQueue, _setTrainAheadQueueState] = useState(null);
  const setTrainAheadQueue = useCallback((q) => {
    trainAheadQueueRef.current = q;
    _setTrainAheadQueueState(q);
  }, []);
  // Total length of the Train Ahead queue when it was started — used to
  // render the "X / N" countdown. (queue.length alone gives only the
  // remaining count.)
  const [trainAheadInitialCount, setTrainAheadInitialCount] = useState(0);

  const feedbackRef = useRef(false);
  const scrollRef = useRef(null);
  const fsrsCardsRef = useRef(fsrsCards);
  const promptRowRef = useRef(null);
  const quizTopRef = useRef(null);
  const [overlayTop, setOverlayTop] = useState(null);
  useEffect(() => { fsrsCardsRef.current = fsrsCards; }, [fsrsCards]);

  // Mode of the *current* in-flight segment (the one not yet saved to
  // quizHistory). Stored as a ref because the autosave-on-unmount
  // closure runs on cleanup and would otherwise capture a stale value.
  // Updated synchronously alongside resetSegment().
  const sessionModeRef = useRef('normal');

  // Schedule timeouts that auto-clear on unmount. Without this,
  // tapping Back mid-session triggers a pending pickNextBook() or
  // milestone timeout that fires on an unmounted component.
  const schedule = useTimeoutManager();

  // Autosave on unmount: when the user navigates away (avatar tap,
  // Settings, switching user, closing the quiz without tapping Done)
  // save whatever partial session they have to quizHistory. This keeps
  // the app's save model consistent — every action is persisted, just
  // like FSRS/bestTime/bestStreak already do on each answer. The ref
  // is updated on every render so the unmount cleanup reads current
  // values (effect deps are stable, so the cleanup closure alone
  // would capture stale initial-render values).
  //
  // `ownerUserIdRef` locks the user who started the session at first
  // render. That way if the user taps their avatar and switches to
  // another user mid-session, the session is still saved to the
  // original player — not silently attributed to whoever is active
  // when React finally runs this component's unmount cleanup.
  const sessionDataRef = useRef({ saved: false, snapshot: null });
  const ownerUserIdRef = useRef(ownerUserId);
  sessionDataRef.current.snapshot = {
    correct: score.correct,
    total: score.total,
    responseTimes,
    sessionMs,
    seenIds: sessionSeenBooks,
    masteredIds: sessionMasteredBooks,
    hintedIds: sessionHintedBooks,
    wrongIds: sessionWrongBooks,
    mode: sessionModeRef.current,
  };

  // Build a session entry from the current snapshot. Centralized here
  // so the unmount cleanup, finishSession, and the segment-end save
  // (saveCurrentSegment) all produce the same shape.
  const buildSessionEntry = (snap) => {
    const avgTime = snap.responseTimes.length > 0
      ? Math.round(snap.responseTimes.reduce((a, b) => a + b, 0) / snap.responseTimes.length)
      : 0;
    return {
      correct: snap.correct,
      total: snap.total,
      avgTime,
      durationMs: snap.sessionMs,
      seenBookIds: [...snap.seenIds],
      masteredBookIds: [...snap.masteredIds],
      hintedBookIds: [...snap.hintedIds],
      wrongBookIds: [...snap.wrongIds],
      mode: snap.mode || 'normal',
    };
  };

  useEffect(() => () => {
    const { saved, snapshot } = sessionDataRef.current;
    if (saved || !snapshot || snapshot.total <= 0) return;
    addQuizSession(ownerUserIdRef.current, buildSessionEntry(snapshot));
  }, [addQuizSession]);

  // Report phase upward so App's header knows whether to show focus-mode
  // (quiz actively playing) or full nav (summary/pause/session-complete).
  useEffect(() => {
    if (onPhaseChange) {
      const paused = showSummary || sessionComplete;
      onPhaseChange(paused ? 'paused' : 'playing');
    }
  }, [showSummary, sessionComplete, onPhaseChange]);

  // Measure prompt row height to perfectly position overlay
  useEffect(() => {
    const measure = () => {
      if (!promptRowRef.current || !quizTopRef.current) return;
      const promptBottom = promptRowRef.current.offsetTop + promptRowRef.current.offsetHeight;
      setOverlayTop(promptBottom);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [targetBook]);

  // FSRS scheduler based on learning pace
  const scheduler = useMemo(() => {
    return createScheduler(config.quiz.learningPace || 'balanced');
  }, [config.quiz.learningPace]);

  const { orientation, testamentsLayout, otColumns, ntColumns, displayMode, gridRef } = useGridLayout();

  // Flush the current segment to quizHistory and mark it saved. Used
  // when transitioning between segments (regular → Train Ahead, or
  // Train Ahead → Train Ahead) and when the user taps End session.
  // Idempotent — once `saved` is set, repeat calls are no-ops, so the
  // unmount cleanup won't double-write.
  const saveCurrentSegment = useCallback(() => {
    const { saved, snapshot } = sessionDataRef.current;
    if (saved || !snapshot || snapshot.total <= 0) return;
    addQuizSession(ownerUserIdRef.current, buildSessionEntry(snapshot));
    sessionDataRef.current.saved = true;
  }, [addQuizSession]);

  // Reset all per-segment state for a new segment (typically a Train
  // Ahead run starting after a regular session-complete). Keeps
  // best-streak / bestTimes / fsrsCards / totalQuizMs untouched —
  // those are user-level, not segment-level.
  const resetSegment = useCallback((newMode) => {
    setScore({ correct: 0, total: 0 });
    setStreak(0);
    setResponseTimes([]);
    setSessionMs(0);
    setSessionSeenBooks(new Set());
    setSessionMasteredBooks(new Set());
    setSessionHintedBooks(new Set());
    setSessionWrongBooks(new Set());
    setSessionNewBests(0);
    sessionModeRef.current = newMode || 'normal';
    sessionDataRef.current.saved = false;
  }, []);

  // FSRS-driven book selection.
  //
  // Branch order:
  //   0. Train Ahead queue active → pick next book from queue. When
  //      empty, transition to session-complete.
  //   1. Due books exist → 20% unseen for variety, otherwise random
  //      from top-8 most-overdue. FSRS decides what's due; we just pick.
  //   2. No due, but unseen exist → pick a random unseen book.
  //   3. No due, no unseen → session-complete screen. (The old "random
  //      from all 66" Branch 4 was eliminated — drilling stable cards
  //      adds no new strength and confuses FSRS calibration. The
  //      session-complete screen offers Train Ahead for users who
  //      genuinely want to keep practicing past the schedule.)
  const pickNextBook = useCallback(() => {
    feedbackRef.current = false;
    const cards = fsrsCardsRef.current || {};

    // Branch 0: Train Ahead queue (read from ref so scheduled callbacks
    // see the freshest value, not whatever was captured at scheduling
    // time — see setTrainAheadQueue's comment block above).
    const queue = trainAheadQueueRef.current;
    if (queue !== null) {
      if (queue.length === 0) {
        setTrainAheadQueue(null);
        setSessionComplete(true);
        return;
      }
      const [head, ...rest] = queue;
      setTrainAheadQueue(rest);
      setTargetBook(head);
      setSessionSeenBooks(prev => {
        if (prev.has(head.id)) return prev;
        const next = new Set(prev);
        next.add(head.id);
        return next;
      });
      setStartTime(Date.now());
      setResponseTime(null);
      setFeedback(null);
      setHintVisible(false);
      // Train Ahead respects the same auto-scroll setting as regular play.
      if (config.display.autoScroll !== false && testamentsLayout !== 'sideBySide') {
        schedule(() => {
          const el = scrollRef.current;
          if (!el) return;
          if (head.testament === 'OT') el.scrollTo({ top: 0, behavior: 'smooth' });
          else el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }, 400);
      } else {
        scrollRef.current?.scrollTo(0, 0);
        window.scrollTo(0, 0);
      }
      logBookPick(head, cards[head.id], 'train-ahead', [], [], bibleBooks, cards);
      return;
    }

    // Regular due/unseen flow
    const { dueBooks, unseenBooks } = getDueBooks(cards, bibleBooks);

    let selected;
    let branch;

    if (dueBooks.length > 0) {
      if (unseenBooks.length > 0 && Math.random() < 0.2) {
        selected = unseenBooks[Math.floor(Math.random() * unseenBooks.length)];
        branch = 'unseen-from-due';
      } else {
        const pool = dueBooks.slice(0, Math.min(8, dueBooks.length));
        selected = pool[Math.floor(Math.random() * pool.length)];
        branch = 'due-pool';
      }
    } else if (unseenBooks.length > 0) {
      selected = unseenBooks[Math.floor(Math.random() * unseenBooks.length)];
      branch = 'unseen';
    } else {
      // Branch 4 (random-from-66) eliminated. Show the session-complete
      // screen so the user can either stop or start Train Ahead.
      setSessionComplete(true);
      return;
    }

    logBookPick(selected, cards[selected.id], branch, dueBooks, unseenBooks, bibleBooks, cards);

    setTargetBook(selected);
    setSessionSeenBooks(prev => {
      if (prev.has(selected.id)) return prev;
      const next = new Set(prev);
      next.add(selected.id);
      return next;
    });
    setStartTime(Date.now());
    setResponseTime(null);
    setFeedback(null);
    setHintVisible(false);
    // In sideBySide layout both testaments are visible at once on tablets
    // and desktop landscape, so OT-top / NT-bottom auto-scroll would cause
    // a confusing jump with no benefit. Skip it. (On phones in landscape
    // some rows may need manual scrolling, but auto-scroll-to-top-or-bottom
    // there is still wrong since both halves are partially visible.)
    if (config.display.autoScroll !== false && testamentsLayout !== 'sideBySide') {
      // Scroll after DOM updates and new book name is visible
      // OT book: scroll to top, NT book: scroll to bottom
      schedule(() => {
        const el = scrollRef.current;
        if (!el) return;
        if (selected.testament === 'OT') {
          el.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
      }, 400);
    } else {
      scrollRef.current?.scrollTo(0, 0);
      window.scrollTo(0, 0);
    }
  }, [config.display.autoScroll, testamentsLayout, schedule, setTrainAheadQueue]);

  useEffect(() => {
    logSessionStart(fsrsCardsRef.current || {}, bibleBooks);
    pickNextBook();
    window.scrollTo(0, 0);
    // First pick only — pickNextBook is called manually after each
    // answer, so we don't want a re-run when its identity changes
    // (e.g. when trainAheadQueue updates). Including it would cause
    // a runaway re-pick loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishSession = useCallback(() => {
    logSessionEnd(fsrsCardsRef.current || {}, bibleBooks);
    saveCurrentSegment();
    onBack();
  }, [saveCurrentSegment, onBack]);

  const handleBack = useCallback(() => {
    if (score.total > 0) {
      setShowSummary(true);
    } else {
      onBack();
    }
  }, [score.total, onBack]);

  // Start a Train Ahead segment with the chosen horizon. Saves the
  // current segment first (so a finished regular run is recorded as
  // mode='normal' before the new Train Ahead run begins as
  // mode='trainAhead'). Then resets per-segment state and primes the
  // queue. Picking is invoked synchronously — pickNextBook reads the
  // queue from trainAheadQueueRef which is updated *before* pickNextBook
  // runs (setTrainAheadQueue writes the ref synchronously), so the
  // pick sees the fresh queue regardless of React's batching.
  const handleStartTrainAhead = useCallback((horizon) => {
    const queue = buildTrainAheadQueue(fsrsCardsRef.current || {}, bibleBooks, horizon);
    if (queue.length === 0) return;
    saveCurrentSegment();
    resetSegment('trainAhead');
    setTrainAheadInitialCount(queue.length);
    setTrainAheadQueue(queue);
    setTrainAheadMenuOpen(false);
    setSessionComplete(false);
    pickNextBook();
  }, [saveCurrentSegment, resetSegment, setTrainAheadQueue, pickNextBook]);

  // End-session button on the session-complete screen — saves and
  // returns to menu, same as finishSession.
  const handleEndSession = useCallback(() => {
    finishSession();
  }, [finishSession]);

  const handleBookClick = (book) => {
    if (!targetBook) return;
    // Allow clicking the correct book to dismiss wrong feedback early
    if (feedbackRef.current && book.id === correctBookId) {
      feedbackRef.current = false;
      setFeedback(null);
      setResponseTime(null);
      setCorrectBookId(null);
      pickNextBook();
      return;
    }
    if (feedbackRef.current) return;

    if (book.id === targetBook.id) {
      feedbackRef.current = true;
      setHintVisible(false);
      const timeTaken = Date.now() - startTime;
      const cappedMs = Math.min(timeTaken, MAX_ANSWER_MS);
      setResponseTime(timeTaken);
      setResponseTimes(prev => [...prev, timeTaken]);
      setSessionMs(s => s + cappedMs);

      // Cumulative training time: same cap applied here too.
      if (addTrainingTime) {
        addTrainingTime(cappedMs);
      }

      const isWithinTime = timeTaken <= config.quiz.masteryMs;
      const rating = ratingFromSpeed(timeTaken, config.quiz.masteryMs);
      setFeedback(isWithinTime ? 'correct' : 'slow');

      // Update FSRS card (same logic for normal AND Train Ahead — the
      // spec is explicit that Train Ahead lets FSRS do its thing; early
      // reviews give smaller stability gains automatically).
      const currentCard = fsrsCards[targetBook.id]
        ? deserializeCard(fsrsCards[targetBook.id])
        : createBookCard();
      const result = reviewBook(scheduler, currentCard, rating);
      updateFsrsCard(targetBook.id, serializeCard(result.card));
      logAnswerResult(targetBook, fsrsCards[targetBook.id], serializeCard(result.card), rating);

      // Score only counts if within time limit
      setScore(prev => ({
        correct: isWithinTime ? prev.correct + 1 : prev.correct,
        total: prev.total + 1
      }));

      if (isWithinTime) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak > bestStreak) setBestStreak(newStreak);

        // Personal best check
        const prevBest = bestTimes[targetBook.id];
        if (!prevBest || timeTaken < prevBest) {
          updateBestTime(targetBook.id, timeTaken);
          setSessionNewBests(prev => prev + 1);
          setNewBestTime(timeTaken);
          setShowNewBest(true);
          schedule(() => setShowNewBest(false), 1500);
        }

        // Milestone check — did this book newly cross the mastered threshold?
        const wasAlreadyMastered = isMastered(fsrsCards[targetBook.id]);
        const isNowMastered = isMastered(serializeCard(result.card));
        if (!wasAlreadyMastered && isNowMastered) {
          // Only record as a session-mastered book when it actually crossed
          // the mastery threshold this turn — not on every correct answer.
          // This keeps quizHistory.masteredBookIds honest.
          setSessionMasteredBooks(prev => new Set(prev).add(book.id));
          const newCount = stats.mastered + 1;
          const updatedFsrsCards = { ...fsrsCards, [targetBook.id]: serializeCard(result.card) };
          const otBookIds = bibleBooks.filter(b => b.testament === 'OT').map(b => b.id);
          const ntBookIds = bibleBooks.filter(b => b.testament === 'NT').map(b => b.id);
          const allOTMastered = otBookIds.every(id => isMastered(updatedFsrsCards[id]));
          const allNTMastered = ntBookIds.every(id => isMastered(updatedFsrsCards[id]));
          const all66Mastered = newCount === 66;

          // Priority: 66 > OT/NT scripture milestones > count milestones.
          // OT/NT milestones only trigger when the just-mastered book is of
          // that testament AND was the last one needed — otherwise mastering
          // any OT book after NT was complete would fire the NT milestone
          // again every time (and vice versa).
          let msg = null;
          if (all66Mastered) {
            msg = t.milestone66;
          } else if (targetBook.testament === 'OT' && allOTMastered) {
            msg = t.milestone39;
          } else if (targetBook.testament === 'NT' && allNTMastered) {
            msg = t.milestoneNT;
          } else {
            const countMilestones = { 10: t.milestone10, 20: t.milestone20, 33: t.milestone33, 50: t.milestone50 };
            msg = countMilestones[newCount] || null;
          }

          if (msg) {
            // Show the milestone banner in the existing topbar overlay
            // slot (same area where hints appear). Auto-dismisses after
            // 2.5s — long enough to register emotionally, short enough
            // that it doesn't block the next prompt.
            setMilestone(msg);
            schedule(() => setMilestone(null), 2500);
          }
        }
      } else {
        setStreak(0);
      }

      schedule(() => pickNextBook(), autoPickDelayMs(config.quiz.masteryMs));
      return;
    }

    // Wrong click — rate as Again
    feedbackRef.current = true;
    setFeedback('wrong');
    setCorrectBookId(targetBook.id);

    // Track time spent on this question for the cumulative training
    // counter and the per-segment sessionMs accumulator. Wrong answers
    // get the same per-question cap as correct ones — what matters for
    // "time spent training" is engagement, not outcome.
    const timeTaken = Date.now() - startTime;
    const cappedMs = Math.min(timeTaken, MAX_ANSWER_MS);
    setSessionMs(s => s + cappedMs);
    if (addTrainingTime) {
      addTrainingTime(cappedMs);
    }
    // Scroll to the correct book after React commits the state change.
    // Double rAF: first frame runs after commit, second frame runs after
    // the browser has laid out the new DOM — so the target cell is
    // guaranteed to be present and positioned. Replaces a 50ms timer
    // that was a timing guess in disguise.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.querySelector(`[data-book-id="${targetBook.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    setSessionWrongBooks(prev => new Set(prev).add(targetBook.id));
    setScore(prev => ({ ...prev, total: prev.total + 1 }));
    setStreak(0);

    // Update FSRS card for wrong answer
    const currentCard = fsrsCards[targetBook.id]
      ? deserializeCard(fsrsCards[targetBook.id])
      : createBookCard();
    const result = reviewBook(scheduler, currentCard, Rating.Again);
    updateFsrsCard(targetBook.id, serializeCard(result.card));
    logAnswerResult(targetBook, fsrsCards[targetBook.id], serializeCard(result.card), Rating.Again);

    // Wait for user to click the correct (blue) book to advance
  };

  const handleHint = () => {
    if (!targetBook) return;
    if (!hintVisible) {
      setSessionHintedBooks(prev => new Set(prev).add(targetBook.id));
    }
    setHintVisible(prev => !prev);
  };

  // Format a millisecond duration for inline feedback ("2.7s", "850ms").
  // Defensive null-guard: state can transiently be null between picking the
  // next book and the feedback element unmounting (showNewBest has a 1.5s
  // visibility timer that can outlive responseTime). Returning empty string
  // is preferable to rendering "nullms".
  const formatTime = (ms) => {
    if (ms == null || !Number.isFinite(ms)) return '';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  const otBooks = bibleBooks.filter(b => b.testament === 'OT');
  const ntBooks = bibleBooks.filter(b => b.testament === 'NT');

  // In side-by-side mode we DON'T force rows to share parent height via
  // `repeat(N, 1fr)`. Cells use their natural height (min-height clamp from
  // CSS, ~44-56px), and rows containing wrapping text — like
  // "1 Thessalonicenzen" splitting to "1 / Thessalonicenzen" — grow to fit
  // their content. This matches the JW Library Study Bible look exactly:
  // most cells are at uniform min-height; only the rows that need 2 lines
  // are taller. With the previous `1fr` approach, on tight viewports
  // (e.g., 412px-tall phone landscape) row height shrunk below what
  // 2-line content needed, causing ellipsis truncation. Natural rows fix
  // that. OT typically has 10 rows of content, NT has 9 — OT-grid simply
  // ends one row lower than NT-grid, matching JW Library.
  const hintGroup = groupNames[lang]?.[targetBook?.group] || '';

  // Stats for display
  const stats = useMemo(() => getBookStats(fsrsCards, bibleBooks), [fsrsCards]);

  // The in-quiz "Te doen" stat shows different things based on segment
  // type:
  //   - Normal segment: stats.dueNow (true FSRS due count, Learn-Ahead-
  //     Limit aware).
  //   - Train Ahead segment: queue.length + 1 while a target book is
  //     showing (the +1 accounts for the currently-displayed book; it
  //     was shifted out of the queue at pick-time but is logically
  //     still a "to-do" until answered). After the answer commits and
  //     before the next pick, dueDisplay falls to queue.length —
  //     matching the visual decrement on each correct answer.
  const dueDisplay = trainAheadQueue !== null
    ? trainAheadQueue.length + (targetBook && !feedbackRef.current ? 1 : 0)
    : stats.dueNow;

  const renderBookCell = (book) => {
    const cardData = fsrsCards[book.id];
    const bookIsMastered = isMastered(cardData);
    const isTarget = book.id === targetBook?.id;
    const showCorrect = (feedback === 'correct' || feedback === 'slow') && isTarget;
    const isCorrectReveal = book.id === correctBookId;
    const showWrong = feedback === 'wrong' && !isTarget && !isCorrectReveal;
    const displayName = getBookDisplayName(book, displayMode, lang);

    const colors = groupColors[book.group] || groupColors.law;
    let bgColor = colors.normal;
    if (showCorrect && feedback === 'correct') bgColor = '#3b82f6';
    else if (showCorrect && feedback === 'slow') bgColor = '#f59e0b';
    else if (isCorrectReveal) bgColor = '#3b82f6';
    // Target book on a wrong click: use blue (same as isCorrectReveal) rather
    // than red. Red/orange side-by-side is hard to distinguish for deutan
    // colorblindness; blue is unambiguously the app's 'this is the answer'
    // color in every other context.
    else if (feedback === 'wrong' && isTarget) bgColor = '#3b82f6';
    else if (showWrong) bgColor = '#f97316';

    const showMasteryLine = config.display.highlightFound && bookIsMastered;

    return (
      <button
        key={book.id}
        className={`book-cell ${showMasteryLine ? 'mastered' : ''} ${showCorrect && feedback === 'correct' ? 'correct' : ''} ${showCorrect && feedback === 'slow' ? 'slow' : ''} ${showWrong ? 'wrong' : ''}`}
        style={{ backgroundColor: bgColor }}
        data-book-id={book.id}
        aria-label={lang === 'nl' ? book.nl : book.en}
        onClick={() => handleBookClick(book)}
        disabled={feedbackRef.current && book.id !== correctBookId}
      >
        <span className="book-name">{displayName}</span>
      </button>
    );
  };

  // ─── Session-complete screen ─────────────────────────────────────────
  // Shown when DUE+unseen=0 (normal segment) or when a Train Ahead queue
  // empties. The user gets two explicit choices: end the session, or
  // Train Ahead with a chosen horizon. Daily totals are factual — no
  // judgment, no graduated nudges; the rest message above conveys the
  // learning-science point.
  if (sessionComplete) {
    const counts = getTrainAheadCounts(fsrsCards, bibleBooks);
    const trainAheadAvailable = counts.remaining > 0;
    const nextDue = getNextDueTime(fsrsCards, bibleBooks);
    // Today's totals: combine saved quizHistory (everything before this
    // segment) with the live in-flight snapshot (the segment that just
    // wrapped, not yet saved). The snapshot may be empty (e.g. user
    // tapped Quiz from menu when DUE was already 0) — handle that.
    const today = computeTodayStats(quizHistory);
    const liveBooks = sessionSeenBooks.size;
    const liveSessions = score.total > 0 ? 1 : 0;
    const liveMs = sessionMs;
    const todayBooks = today.books + liveBooks;
    const todaySessions = today.sessions + liveSessions;
    const todayMs = today.durationMs + liveMs;
    const todayMinutes = Math.max(0, Math.round(todayMs / 60000));
    const sessionsLabel = todaySessions === 1 ? t.sessionCompleteSessionSingle : t.sessionCompleteSessions;
    const horizons = [
      { id: 'count5',    label: t.trainAheadHorizonCount5,    count: counts.count5 },
      { id: 'count10',   label: t.trainAheadHorizonCount10,   count: counts.count10 },
      { id: 'week',      label: t.trainAheadHorizonWeek,      count: counts.week },
      { id: 'remaining', label: t.trainAheadHorizonRemaining, count: counts.remaining },
    ];
    return (
      <div className="quiz-grid session-complete-screen">
        <h2 className="session-complete-title">{t.sessionCompleteTitle}</h2>

        <div className="session-complete-next">
          <span className="session-complete-next-label">{t.sessionCompleteNextLabel}:</span>
          <span className="session-complete-next-time">
            {nextDue ? formatNextDue(nextDue, lang) : t.nothingScheduled}
          </span>
        </div>

        <div className="session-complete-rest">
          <p className="session-complete-rest-title">{t.sessionCompleteRestTitle}</p>
          <p className="session-complete-rest-body">{t.sessionCompleteRestBody}</p>
        </div>

        {/* Daily totals — only shown if there's anything to report. A
            line of zeros on a fresh-account first-run would feel like
            scolding. */}
        {(todayBooks > 0 || todaySessions > 0) && (
          <p className="session-complete-today">
            <strong>{t.sessionCompleteTodayLabel}:</strong>{' '}
            {todayBooks} {t.sessionCompleteBooks}
            {' · '}{todaySessions} {sessionsLabel}
            {todayMs > 0 && (<>{' · '}{todayMinutes} {t.sessionCompleteMinutes}</>)}
          </p>
        )}

        <div className="session-complete-buttons">
          <button className="btn session-complete-finish" onClick={handleEndSession}>
            {t.sessionCompleteFinish}
          </button>

          <div className={`session-complete-trainahead ${trainAheadMenuOpen ? 'open' : ''}`}>
            <button
              className="btn session-complete-trainahead-btn"
              onClick={() => setTrainAheadMenuOpen(o => !o)}
              disabled={!trainAheadAvailable}
              aria-expanded={trainAheadMenuOpen}
            >
              <span className="btn-icon">⏩</span>
              <span>{t.sessionCompleteTrainAhead}</span>
              <span className="trainahead-caret" aria-hidden="true">{trainAheadMenuOpen ? '▴' : '▾'}</span>
            </button>
            {trainAheadMenuOpen && trainAheadAvailable && (
              <div className="trainahead-menu" role="menu">
                {horizons.map(h => (
                  <button
                    key={h.id}
                    className="trainahead-option"
                    role="menuitem"
                    disabled={h.count === 0}
                    onClick={() => handleStartTrainAhead(h.id)}
                  >
                    <span className="trainahead-option-label">{h.label}</span>
                    <span className="trainahead-option-count">{h.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!targetBook) return null;

  // Session summary screen
  if (showSummary) {
    // sessionMs is the per-question-capped accumulator; using it here
    // (rather than wall-clock Date.now() - sessionStartTime) means the
    // displayed minutes reflect actual training engagement, not idle
    // tab time. Floors at 1 min so a sub-minute productive session
    // doesn't read as "0 min".
    const durationMin = Math.max(1, Math.round(sessionMs / 60000));
    return (
      <div className="quiz-grid summary-screen">
        <h2 className="summary-title">{t.sessionSummaryTitle}</h2>
        <div className="summary-stats">
          <div className="summary-stat">
            <span className="summary-number">{score.total}</span>
            <span className="summary-label">{t.sessionReviewed}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-number">{durationMin}</span>
            <span className="summary-label">{t.sessionMinutes}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-number">{score.correct}</span>
            <span className="summary-label">{t.sessionCorrect}</span>
          </div>
          {sessionNewBests > 0 && (
            <div className="summary-stat summary-best">
              <span className="summary-number">⚡ {sessionNewBests}×</span>
              <span className="summary-label">{t.sessionNewBests}</span>
            </div>
          )}
          {/* Newly mastered this session — only shown when > 0. A "+0" would
              feel like punishment for a productive review-only session, and
              the existing per-session stats already convey activity. The
              delta (X → Y of 66) gives concrete progress feedback the menu
              screen's static "X/66 mastered" can't match. */}
          {sessionMasteredBooks.size > 0 && (
            <div className="summary-stat summary-newly-mastered">
              <span className="summary-number">+{sessionMasteredBooks.size}</span>
              <span className="summary-label">{t.sessionNewlyMastered}</span>
              <span className="summary-delta">
                {stats.mastered - sessionMasteredBooks.size} → {stats.mastered} {t.of} 66
              </span>
            </div>
          )}
          <div className="summary-stat summary-total-time">
            <span className="summary-number">{formatDuration(totalQuizMs)}</span>
            <span className="summary-label">{t.sessionTotal}</span>
          </div>
        </div>
        <p className="summary-pause-hint">{t.sessionPauseHint}</p>
        <div className="summary-buttons">
          <button className="btn" onClick={() => { setShowSummary(false); setStartTime(Date.now()); }}>
            {t.keepGoing}
          </button>
          <button className="btn quiz-btn" onClick={finishSession}>
            {t.done}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-grid">
      <div className="quiz-top" ref={quizTopRef}>
        <div className="quiz-prompt-row" ref={promptRowRef}>
          <button className="back-btn" onClick={handleBack}>← {t.back}</button>
          <div className={`quiz-prompt ${
            !hintVisible && feedback === 'correct' && !showNewBest ? 'prompt-correct' :
            !hintVisible && showNewBest ? 'prompt-correct' :
            !hintVisible && feedback === 'slow' ? 'prompt-slow' :
            !hintVisible && feedback === 'wrong' ? 'prompt-wrong' : ''
          }`}>
            {!hintVisible && feedback === 'correct' && !showNewBest
              ? <span className="prompt-book">✓ {t.correct} {formatTime(responseTime)}</span>
              : !hintVisible && showNewBest
              ? <span className="prompt-book">⚡ {t.newBest} {formatTime(newBestTime)}</span>
              : !hintVisible && feedback === 'slow'
              ? <span className="prompt-book">⏱ {t.tooSlow} — {formatTime(responseTime)}</span>
              : !hintVisible && feedback === 'wrong'
              ? <span className="prompt-book">✗ {t.wrongShowCorrect || t.wrong}</span>
              : <span className="prompt-book">{lang === 'nl' ? targetBook.nl : targetBook.en}</span>
            }
          </div>
        </div>
        {/* Train Ahead pill: small visual marker so the user knows this
            run is extra-practice, not a regular FSRS-driven session.
            Sits above the stats row in the topbar. Progress = books
            already moved out of the queue (= initialCount - remaining). */}
        {trainAheadQueue !== null && (
          <div className="trainahead-pill" aria-live="polite">
            ⏩ {t.trainAheadInProgress} · {trainAheadInitialCount - trainAheadQueue.length}/{trainAheadInitialCount}
          </div>
        )}
        <div className="quiz-stats">
          <div className="stat">
            <span className="stat-value">{score.correct}/{score.total}</span>
            <span className="stat-label">{t.score}</span>
          </div>
          <div className="stat">
            <span className="stat-value">{streak}</span>
            <span className="stat-label">{t.streak}</span>
          </div>
          <div className="stat">
            <span className="stat-value">{dueDisplay}</span>
            <span className="stat-label">{t.due || 'Due'}</span>
          </div>
          <button className={`hint-btn ${hintVisible ? 'active' : ''}`} onClick={handleHint}>
            💡
          </button>
        </div>

        {/* Hint overlay — starts exactly below prompt row */}
        {overlayTop !== null && hintVisible && (
          <div className="topbar-overlay hint-overlay" style={{ top: overlayTop }} onClick={handleHint}>
            <div className="hint-color-dot" style={{ backgroundColor: groupColors[targetBook.group]?.normal }} />
            <span className="overlay-text">{t.hintReveal} <strong>{hintGroup}</strong></span>
          </div>
        )}

        {/* Milestone overlay — same slot as hint overlay, only visible
            when no hint is showing (hints are user-triggered and take
            precedence; milestones auto-dismiss after 2.5s anyway). */}
        {overlayTop !== null && milestone && !hintVisible && (
          <div className="topbar-overlay milestone-overlay" style={{ top: overlayTop }}>
            <span className="overlay-text">{milestone}</span>
          </div>
        )}
      </div>

      <div className={`quiz-bottom${testamentsLayout === 'sideBySide' ? ' testaments-side-by-side' : ''}`} ref={scrollRef}>
        <div className="section" style={testamentsLayout === 'sideBySide' ? { flex: otColumns } : undefined}>
          <h3 className="section-title">{t.hebrewSection}</h3>
          <div className={`book-grid${displayMode === 'short' ? ' using-abbreviations' : ''}`} ref={gridRef} style={{ gridTemplateColumns: `repeat(${otColumns}, 1fr)` }}>
            {otBooks.map(renderBookCell)}
          </div>
        </div>

        <div className="section" style={testamentsLayout === 'sideBySide' ? { flex: ntColumns } : undefined}>
          <h3 className="section-title">{t.greekSection}</h3>
          <div className={`book-grid${displayMode === 'short' ? ' using-abbreviations' : ''}`} style={{ gridTemplateColumns: `repeat(${ntColumns}, 1fr)` }}>
            {ntBooks.map(renderBookCell)}
          </div>
        </div>
      </div>
    </div>
  );
}

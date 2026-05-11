import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { bibleBooks, groupColors, groupNames, getBookDisplayName } from '../data';
import { useAppConfig } from '../App';
import { useGridLayout } from '../useGridLayout';
import { useTimeoutManager } from '../useTimeoutManager';
import {
  createScheduler, createBookCard, ratingFromSpeed,
  reviewBook, getDueBooks, serializeCard, deserializeCard,
  Rating, getBookStats, isConfident, recordConfidentAttempt, getConfidentCount, getNonConfidentBooks,
} from '../fsrs';
import { computeTodayStats } from '../streak';
import { formatDuration } from '../timeFormat';
import { logSessionStart, logBookPick, logAnswerResult, logSessionEnd } from '../debug';
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
  ownerUserId, fsrsCards, updateFsrsCard,
  confidentBuffers = {}, updateConfidentBuffer,
  bestTimes, updateBestTime,
  bestStreak, setBestStreak, addQuizSession, addTrainingTime,
  totalQuizMs = 0, quizHistory = [],
  onBack, onPhaseChange,
  // v4 pause/resume. When the user taps "← Back" mid-session, we no
  // longer end the session — we snapshot the full session state into
  // `onPause(snapshot)` and call onBack. The snapshot is persisted on
  // the user object (in App.jsx) and surfaces as a "Resume" CTA on the
  // home screen. When the user taps Resume, App.jsx mounts QuizGrid
  // with the snapshot as `initialPausedSession` and we restore every
  // piece of session state from it on first render.
  initialPausedSession = null,
  onPause,
  sessionLimit = null,
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
  // One-shot: id of the book that just transitioned to confident, used
  // to apply the .just-confident class on that cell for the gold-line
  // sweep animation. Cleared after the animation duration so a later
  // re-render doesn't re-play the sweep.
  const [justConfidentBookId, setJustConfidentBookId] = useState(null);
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
  const [milestone, setMilestone] = useState(null); // message string | null
  const [showNewBest, setShowNewBest] = useState(false);
  // Snapshot of the time that earned the current "new record" badge. Kept
  // separate from `responseTime` because the badge has its own 1.5s
  // visibility timer — `responseTime` may be cleared (by picking the next
  // book) before the badge fades out, which previously caused "nullms" to
  // briefly render. Reading from this snapshot ensures the badge always
  // shows the time that actually earned it.
  const [newBestTime, setNewBestTime] = useState(null);

  // ─── Session-complete state ───────────────────────────────────────
  // sessionComplete replaces the eliminated Branch 4. When true, the
  // component renders the session-complete screen instead of the book
  // grid. Triggered when (a) initial pick has no due+no unseen books,
  // or (b) the last due book is answered.
  const [sessionComplete, setSessionComplete] = useState(false);

  // ─── Session-size limit (from home-screen Quick/Standard/Full) ────
  // Holds a snapshot of the sessionLimit prop captured at session start,
  // and a counter that increments each time pickNextBook successfully
  // picks a new book to present. When pickCount >= limit, the next call
  // to pickNextBook short-circuits to session-complete.
  //
  // Refs (not state) because pickNextBook is invoked from scheduled
  // callbacks where a state read would be stale. Same pattern as
  // fsrsCardsRef above.
  const sessionLimitRef = useRef(null);
  const sessionPickCountRef = useRef(0);

  const feedbackRef = useRef(false);
  const scrollRef = useRef(null);
  const fsrsCardsRef = useRef(fsrsCards);
  // Live mirror of confidentBuffers prop — pickNextBook reads this when
  // FSRS has nothing due, to fall back to non-confident books. Without
  // the ref, the closure would capture the mount-time value and never
  // see books transition to/from confident mid-session.
  const confidentBuffersRef = useRef(confidentBuffers);
  const promptRowRef = useRef(null);
  const quizTopRef = useRef(null);
  const [overlayTop, setOverlayTop] = useState(null);
  useEffect(() => { fsrsCardsRef.current = fsrsCards; }, [fsrsCards]);
  useEffect(() => { confidentBuffersRef.current = confidentBuffers; }, [confidentBuffers]);

  // v4.3: live mirror of sessionSeenBooks for use inside pickNextBook's
  // maintenance branch. The branch needs to filter "already touched this
  // session" without forcing pickNextBook's useCallback to rebuild on
  // every pick — same pattern as confidentBuffersRef above.
  const sessionSeenBooksRef = useRef(new Set());
  useEffect(() => { sessionSeenBooksRef.current = sessionSeenBooks; }, [sessionSeenBooks]);

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
  // (quiz actively playing) or full nav (session-complete screen).
  useEffect(() => {
    if (onPhaseChange) {
      onPhaseChange(sessionComplete ? 'paused' : 'playing');
    }
  }, [sessionComplete, onPhaseChange]);

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
  // when the user taps End session. Idempotent — once `saved` is set,
  // repeat calls are no-ops, so the unmount cleanup won't double-write.
  const saveCurrentSegment = useCallback(() => {
    const { saved, snapshot } = sessionDataRef.current;
    if (saved || !snapshot || snapshot.total <= 0) return;
    addQuizSession(ownerUserIdRef.current, buildSessionEntry(snapshot));
    sessionDataRef.current.saved = true;
  }, [addQuizSession]);

  // Reset all per-segment state for a new segment. Keeps best-streak /
  // bestTimes / fsrsCards / totalQuizMs untouched — those are user-level,
  // not segment-level.
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
  //   1. Due books exist → 20% unseen for variety, otherwise random
  //      from top-8 most-overdue. FSRS decides what's due; we just pick.
  //   2. No due, but unseen exist → pick a random unseen book.
  //   3. No due, no unseen → session-complete screen. (The old "random
  //      from all 66" Branch 4 was eliminated — drilling stable cards
  //      adds no new strength and confuses FSRS calibration.)
  const pickNextBook = useCallback(() => {
    feedbackRef.current = false;
    const cards = fsrsCardsRef.current || {};

    // ─── Session-size limit check ─────────────────────────────────
    // If the user picked Quick (5) or Standard (10) from the home
    // screen, sessionLimitRef holds that number. When pickCount has
    // reached the limit, fire session-complete instead of picking.
    //
    // Placed BEFORE the due/unseen lookup below because we don't want
    // to discover "0 due, 0 unseen → Branch 4 complete" through the
    // wrong code path: the limit-complete is a finite-budget exit,
    // not an out-of-material exit. Logged separately for debugging.
    if (sessionLimitRef.current !== null
        && sessionPickCountRef.current >= sessionLimitRef.current) {
      setSessionComplete(true);
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
      // v4 fallback: no FSRS-due and no unseen books, but the user may
      // still have non-confident books to train toward all-66-gold.
      // Pick from the most-progressable non-confident pool (top 8 by
      // closeness to gold) so the user keeps making visible progress
      // instead of being told to stop. Confident books are excluded —
      // if confidentCount === 66 we drop into the maintenance branch.
      const nonConfident = getNonConfidentBooks(confidentBuffersRef.current || {}, cards, bibleBooks);
      if (nonConfident.length > 0) {
        const pool = nonConfident.slice(0, Math.min(8, nonConfident.length));
        selected = pool[Math.floor(Math.random() * pool.length)];
        branch = 'non-confident-fallback';
      } else {
        // v4.3 maintenance branch: all 66 confident AND nothing FSRS-due.
        // Previously this dropped straight into session-complete and the
        // user couldn't keep training without "Start a new run" (full
        // reset). Now: pick from the books with the lowest FSRS stability
        // — these are the "weakest" gold-lined books, most likely to
        // drift off the gold line first. Top 8 by stability ascending,
        // then random within the pool (same shape as the due-pool and
        // non-confident-fallback branches).
        //
        // Filtered by sessionSeenBooksRef so a Full maintenance session
        // (limit=null, pool=66) naturally ends after touching every book
        // once. Without the filter the same lowest-stability 8 would
        // dominate every pick and the session would loop forever; Quick
        // (limit=5) and Standard (limit=10) end via sessionLimit either
        // way, but Full needs this filter to terminate.
        //
        // This pairs with the launcher fallback in App.jsx that sets
        // trainingPool = 66 when both the FSRS-due and non-confident
        // counts are zero.
        const seen = sessionSeenBooksRef.current || new Set();
        const candidates = bibleBooks.filter(b => !seen.has(b.id));
        if (candidates.length === 0) {
          setSessionComplete(true);
          return;
        }
        const byStability = [...candidates].sort((a, b) => {
          const sa = cards[a.id]?.stability || 0;
          const sb = cards[b.id]?.stability || 0;
          return sa - sb;
        });
        const pool = byStability.slice(0, Math.min(8, byStability.length));
        selected = pool[Math.floor(Math.random() * pool.length)];
        branch = 'maintenance';
      }
    }

    logBookPick(selected, cards[selected.id], branch, dueBooks, unseenBooks, bibleBooks, cards);

    // Successful pick — bump the session counter. Done AFTER all the
    // early-exit checks so an aborted pick (no due, no unseen) doesn't
    // wrongly increment toward the limit.
    sessionPickCountRef.current += 1;

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
  }, [config.display.autoScroll, testamentsLayout, schedule]);

  useEffect(() => {
    // Initialise session-limit refs from the prop captured at mount.
    // Both refs are reset to defaults on session start; only the cap
    // value differs based on user's Quick/Standard/Full choice.
    sessionLimitRef.current = sessionLimit;
    sessionPickCountRef.current = 0;

    // v4 resume: if the user tapped "Resume" on the home screen,
    // initialPausedSession holds the snapshot we wrote on the previous
    // Back. Restore every piece of state from it instead of picking a
    // fresh book. Sets are stored as arrays in the snapshot; revive
    // them as Sets here. Per-question timer (startTime) is re-anchored
    // to "now" — the user shouldn't be penalised for paused-time.
    if (initialPausedSession) {
      const s = initialPausedSession;
      if (s.targetBook) setTargetBook(s.targetBook);
      if (typeof s.streak === 'number') setStreak(s.streak);
      if (s.score) setScore(s.score);
      if (Array.isArray(s.responseTimes)) setResponseTimes(s.responseTimes);
      if (Array.isArray(s.sessionMasteredBooks)) setSessionMasteredBooks(new Set(s.sessionMasteredBooks));
      if (Array.isArray(s.sessionHintedBooks)) setSessionHintedBooks(new Set(s.sessionHintedBooks));
      if (Array.isArray(s.sessionWrongBooks)) setSessionWrongBooks(new Set(s.sessionWrongBooks));
      if (Array.isArray(s.sessionSeenBooks)) setSessionSeenBooks(new Set(s.sessionSeenBooks));
      if (typeof s.sessionNewBests === 'number') setSessionNewBests(s.sessionNewBests);
      if (typeof s.sessionMs === 'number') setSessionMs(s.sessionMs);
      if (typeof s.sessionPickCount === 'number') sessionPickCountRef.current = s.sessionPickCount;
      setStartTime(Date.now());
      logSessionStart(fsrsCardsRef.current || {}, bibleBooks);
    } else {
      logSessionStart(fsrsCardsRef.current || {}, bibleBooks);
      pickNextBook();
    }
    window.scrollTo(0, 0);
    // First pick only — pickNextBook is called manually after each
    // answer, so we don't want a re-run when its identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishSession = useCallback(() => {
    logSessionEnd(fsrsCardsRef.current || {}, bibleBooks);
    saveCurrentSegment();
    // Session completed naturally — clear any paused checkpoint so the
    // user doesn't see a stale Resume CTA referring to the just-ended
    // run. App.jsx writes null → pausedQuizSession on user.
    if (onPause) onPause(null);
    onBack();
  }, [saveCurrentSegment, onBack, onPause]);

  // v4: Back is a pause, not a session-end. Snapshot the full session
  // state to onPause(snapshot); App.jsx persists it onto the user as
  // `pausedQuizSession`. The home screen then offers a Resume CTA that
  // mounts QuizGrid again with the snapshot as `initialPausedSession`,
  // restoring every piece of state including the exact target book.
  // Sets are serialised as arrays for JSON safety. Per-question timer
  // (startTime) is NOT included — it gets re-anchored to "now" on
  // resume so the user isn't penalised for paused-time.
  //
  // If sessionComplete is already true, we're past the natural end —
  // don't pause, just call onBack (the End session button takes this
  // path too).
  const handleBack = useCallback(() => {
    if (sessionComplete) {
      onBack();
      return;
    }
    if (onPause && targetBook) {
      const snapshot = {
        targetBook,
        streak,
        score,
        responseTimes,
        sessionMasteredBooks: Array.from(sessionMasteredBooks),
        sessionHintedBooks: Array.from(sessionHintedBooks),
        sessionWrongBooks: Array.from(sessionWrongBooks),
        sessionSeenBooks: Array.from(sessionSeenBooks),
        sessionNewBests,
        sessionMs,
        sessionPickCount: sessionPickCountRef.current,
        sessionLimit,
        pausedAt: Date.now(),
      };
      onPause(snapshot);
      // Mark this segment as "already handled" so the autosave-on-unmount
      // effect doesn't write a separate quizHistory entry. The data lives
      // in pausedQuizSession now; when the user resumes and finishes
      // naturally, saveCurrentSegment writes one consolidated entry
      // covering both halves of the run. Without this flag, pause +
      // resume would show as "2 sessions" in today's stats instead of 1.
      sessionDataRef.current.saved = true;
    }
    onBack();
  }, [onBack, onPause, sessionComplete, targetBook, streak, score, responseTimes,
      sessionMasteredBooks, sessionHintedBooks, sessionWrongBooks, sessionSeenBooks,
      sessionNewBests, sessionMs, sessionLimit]);

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

      // Update FSRS card with the new rating.
      const currentCard = fsrsCards[targetBook.id]
        ? deserializeCard(fsrsCards[targetBook.id])
        : createBookCard();
      const result = reviewBook(scheduler, currentCard, rating);
      updateFsrsCard(targetBook.id, serializeCard(result.card));
      logAnswerResult(targetBook, fsrsCards[targetBook.id], serializeCard(result.card), rating);

      // ─── Confident-buffer update (v4) ────────────────────────────────
      // Record this attempt on the new gold-line signal. `true` only if
      // the answer was both correct AND within masteryMs (the same
      // criterion FSRS uses to map speed → Rating.Good vs Hard). Slow
      // correct answers push `false` — they're not "confident" hits, the
      // user knew the book but couldn't find it fast.
      const wasConfident = isConfident(confidentBuffers[targetBook.id]);
      const nextBuffer = recordConfidentAttempt(confidentBuffers[targetBook.id], isWithinTime);
      const isNowConfident = isConfident(nextBuffer);
      if (updateConfidentBuffer) {
        updateConfidentBuffer(targetBook.id, isWithinTime);
      }

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

        // Milestone check — did this book newly cross into Confident?
        // v4: the trigger is the confident gold-line signal, not the
        // FSRS-based isMastered() condition. Confident is achievable
        // within a single session, so milestones now fire during the
        // race-to-66 marathon rather than weeks later.
        if (!wasConfident && isNowConfident) {
          setSessionMasteredBooks(prev => new Set(prev).add(book.id));
          // Trigger the one-shot gold-line sweep animation on this cell.
          // 700ms covers the 600ms keyframe plus a small safety margin
          // before clearing the class. If the user answers another book
          // before this fires, the previous animation gets cut off —
          // fine, only the most recent transition is celebrated.
          setJustConfidentBookId(targetBook.id);
          schedule(() => setJustConfidentBookId(null), 700);
          const updatedBuffers = { ...confidentBuffers, [targetBook.id]: nextBuffer };
          const newCount = getConfidentCount(updatedBuffers, bibleBooks);
          const otBookIds = bibleBooks.filter(b => b.testament === 'OT').map(b => b.id);
          const ntBookIds = bibleBooks.filter(b => b.testament === 'NT').map(b => b.id);
          const allOTConfident = otBookIds.every(id => isConfident(updatedBuffers[id]));
          const allNTConfident = ntBookIds.every(id => isConfident(updatedBuffers[id]));
          const all66Confident = newCount === 66;

          // Priority: 66 > OT/NT scripture milestones > count milestones.
          // OT/NT milestones only trigger when the just-confident book is
          // of that testament AND was the last one needed — otherwise
          // any OT book after NT was complete would fire the NT milestone
          // again every time (and vice versa).
          let msg = null;
          if (all66Confident) {
            msg = t.milestone66;
          } else if (targetBook.testament === 'OT' && allOTConfident) {
            msg = t.milestone39;
          } else if (targetBook.testament === 'NT' && allNTConfident) {
            msg = t.milestoneNT;
          } else {
            const countMilestones = { 10: t.milestone10, 20: t.milestone20, 33: t.milestone33, 50: t.milestone50 };
            msg = countMilestones[newCount] || null;
          }

          if (msg) {
            // Show the milestone banner in the existing topbar overlay
            // slot. Auto-dismisses after 2.5s — long enough to register
            // emotionally, short enough that it doesn't block the next
            // prompt. (A dedicated all-66 celebration screen is on the
            // Commit 3 polish list.)
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

    // Confident buffer: wrong answer pushes a `false`. If this book was
    // previously gold-lined (buffer full of trues), the gold line goes
    // away on the next render — same shape as forgetting any book.
    if (updateConfidentBuffer) {
      updateConfidentBuffer(targetBook.id, false);
    }

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

  // The in-quiz "Te doen" stat: stats.dueNow (true FSRS due count,
  // Learn-Ahead-Limit aware).
  const dueDisplay = stats.dueNow;

  const renderBookCell = (book) => {
    const cardData = fsrsCards[book.id];
    // v4: gold line driven by the confident buffer (last 3 correct-fast),
    // not by FSRS-stability. This makes the gold line achievable in a
    // single session and decouples the visual reward from the calendar.
    const bookIsConfident = isConfident(confidentBuffers[book.id]);
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

    const showMasteryLine = config.display.highlightFound && bookIsConfident;
    const isJustConfident = book.id === justConfidentBookId;

    return (
      <button
        key={book.id}
        className={`book-cell ${showMasteryLine ? 'mastered' : ''} ${isJustConfident ? 'just-confident' : ''} ${showCorrect && feedback === 'correct' ? 'correct' : ''} ${showCorrect && feedback === 'slow' ? 'slow' : ''} ${showWrong ? 'wrong' : ''}`}
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
  // Two states:
  // - confidentCount === 66: full celebration (trophy + title + body +
  //   total time + share). Same content the home-screen all-66 card has.
  // - confidentCount < 66: neutral framing. Just "Session complete" +
  //   today's stats + End session. No "stopping strengthens" rest message
  //   (that framing was schedule-shaped despite the disclaimer and
  //   contradicted the v4 "train when you have time" model — same
  //   reasoning as the home-screen rest message we removed in commit 4).
  if (sessionComplete) {
    const today = computeTodayStats(quizHistory);
    const liveBooks = sessionSeenBooks.size;
    const liveSessions = score.total > 0 ? 1 : 0;
    const liveMs = sessionMs;
    const todayBooks = today.books + liveBooks;
    const todaySessions = today.sessions + liveSessions;
    const todayMs = today.durationMs + liveMs;
    const todayMinutes = Math.max(0, Math.round(todayMs / 60000));
    const sessionsLabel = todaySessions === 1 ? t.sessionCompleteSessionSingle : t.sessionCompleteSessions;
    const isAll66 = getConfidentCount(confidentBuffersRef.current || {}, bibleBooks) === 66;
    return (
      <div className="quiz-grid session-complete-screen">
        {isAll66 ? (
          <div className="celebration-66 celebration-66-inline">
            <span className="celebration-trophy" aria-hidden="true">🏆</span>
            <h2 className="celebration-title">{t.celebration66Title}</h2>
            <p className="celebration-body">{t.celebration66Body}</p>
            {totalQuizMs > 0 && (
              <div className="celebration-time">
                <span className="celebration-time-label">{t.celebrationTimeLabel}</span>
                <span className="celebration-time-value">{formatDuration(totalQuizMs + sessionMs)}</span>
              </div>
            )}
          </div>
        ) : (
          <h2 className="session-complete-title">{t.sessionCompleteTitle}</h2>
        )}

        {/* Daily totals — shown in both branches. A line of zeros on a
            fresh-account first-run would feel like scolding, so only
            render when there's something to report. */}
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
        </div>
      </div>
    );
  }

  if (!targetBook) return null;

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

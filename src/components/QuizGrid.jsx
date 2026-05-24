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
// Scales with the user's targetSpeedMs setting because that's their
// declared expected pace: a user with targetSpeedMs=2000 (2s target)
// wants a snappy flow, a user with targetSpeedMs=30000 (30s "relaxed")
// is more contemplative and benefits from a longer pause to register
// the green feedback.
//
// Formula: 50% of targetSpeedMs, clamped between 250ms and 800ms.
//   - 250ms minimum: below this, the green "correct" feedback is barely
//     perceived (Nielsen Norman Group: ~230ms is human visual perception
//     threshold). Below this users wouldn't see their own success.
//     v6.3 note: the slider's 2000ms floor means we never actually hit
//     this floor — autoPickDelay(2000) = 800ms (capped). The floor is
//     kept as a defensive guard against unmigrated stale localStorage.
//   - 800ms maximum: above this, the pause feels like a delay (Material
//     Design pegs 500ms as the upper bound for "responsive" feedback;
//     800ms is our pre-existing value, kept as ceiling for compatibility).
//
// Examples (v6.3 slider range only spans 2000–30000ms):
//   targetSpeedMs=30000 → 800ms (capped)
//   targetSpeedMs=10000 → 800ms (capped — same as old default)
//   targetSpeedMs=2000  → 800ms (capped — same as cap)
// All slider values now hit the 800ms ceiling, so the pause is uniformly
// 800ms in practice. The formula is preserved (rather than hardcoded
// to 800) for any future expansion of the slider range.
function autoPickDelayMs(targetSpeedMs) {
  return Math.min(800, Math.max(250, Math.round(targetSpeedMs * 0.5)));
}

export default function QuizGrid({
  ownerUserId, fsrsCards, updateFsrsCard,
  // ADR 0010: per-book recent-answer tracking for the attention scope.
  // QuizGrid calls this for every answered question (correct, wrong-tap,
  // time-up). Box Mode does NOT — see ADR 0010 for the safe-zone rationale.
  recordRecentAnswer,
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
  onShare,
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

  // v6.3: visible-but-informational timer for Quiz Mode. Mirrors Box
  // Mode's countdown bar visually (same look, same place — above the
  // prompt row), but with NO expiry consequence — the bar reaches zero
  // and just stays there. The user keeps full control of when to
  // answer; whatever they eventually do gets rated by speed in the
  // normal way (FSRS Easy/Good/Hard + confident-buffer credit), exactly
  // as it did before 6.3. The bar's only purpose is transparency:
  // surfacing the previously-invisible speed threshold so users SEE the
  // FSRS rating boundary they were already being measured against.
  //
  // Why no expiry consequence in Quiz Mode (unlike Box): Quiz Mode is
  // the "long-term spaced review" experience; Box Mode is the "speed-
  // sort against the clock" experience. Adding an auto-fire-wrong on
  // timer expiry would collapse the distinction. Keeping Quiz's timer
  // informational preserves mode differentiation while still giving the
  // user the transparency benefit.
  const [timerStart, setTimerStart] = useState(null);
  const [timerProgress, setTimerProgress] = useState(1);

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
  // v6.3.4 (Scope B): live mirror of targetBook for the timer-expiry
  // handler. The tick interval needs the current targetBook to commit
  // an FSRS Hard rating + reveal the cell when the timer runs out;
  // capturing it via closure would mean the handler always sees the
  // book that was current when the interval was first set up, which
  // is fine in steady state but fragile across rapid pause/resume or
  // back-to-back books. Refs sidestep the issue.
  const targetBookRef = useRef(targetBook);
  // Sentinel: ensures the timer-expiry handler fires at most ONCE per
  // question, even if the 100ms tick lands right before the cleanup
  // race. Mirrors Box Mode's `expiryFiredRef`.
  const expiryFiredRef = useRef(false);
  // Tracks whether the 66/66 confident celebration has already fired in
  // this session, so a transient drop-and-recover (e.g. an in-flight
  // answer landing just after the celebration triggers, briefly pushing
  // a book off-confident and back on) doesn't re-trigger the prompt.
  // Reset implicitly on a new mount (fresh session) — refs reinitialise
  // to false. Originally added for v6 commit 37's "Continue training"
  // path, which ADR 0008 removed; the ref is still needed because race
  // conditions between answer-commit and session-complete remain
  // possible even in the speedrun-only model. See ADR 0003.
  const hasTriggeredSixtySixRef = useRef(false);
  // v6 commit 39: mirrors the sessionComplete state in a ref so the
  // time-up tick interval (which captures a stale closure) can check
  // it. Without this, a pending timer expiry could fire AFTER the
  // session-complete prompt was triggered by commit 37's 66-reach
  // logic, pushing a `false` onto a confident book's buffer and
  // silently dropping the count from 66 to 65 between the prompt
  // render and the home render. See ADR 0004.
  const sessionCompleteRef = useRef(false);
  // ADR 0010 refinement: tracks the most recently answered book (id +
  // timestamp) for working-memory contamination detection. Used by:
  //   - recordRecentAnswerFiltered (suppresses same-book correct repeats)
  //   - the correct-flow FSRS rating override (forces Hard on back-to-back)
  //   - the correct-flow confident-buffer override (forces false on back-to-back)
  //
  // Why a SHARED ref instead of separate ones: a back-to-back same-book
  // correct is the same working-memory contamination event regardless
  // of which downstream system reads it. Sharing one source of truth
  // keeps the three protections consistent — if one says "this is
  // back-to-back", the others say the same.
  //
  // Research backing:
  //   - Kahana & Loftus (1999): IRTs to second repeated elements at
  //     nearby positions are artificially shorter (working-memory
  //     contamination). Spaced repetitions show normal RTs.
  //   - Intertrial priming literature: direct repetition produces
  //     well-documented RT-acceleration effects.
  //   - FSRS-6 has its own same-day stability dampening (S^(-w_19)
  //     term), but for cards in learning state the boost can still be
  //     significant — this override provides additional protection.
  //
  // The 60-second time window guards against a rare edge case: user
  // stops answering for ~hour without formally pausing (no component
  // unmount), then returns. Working memory is gone after such a gap,
  // so the next same-book answer is real recall, not contamination.
  // Within 60 seconds the picker can plausibly produce a same-book
  // repeat via the top-8 due pool; beyond that, intervening books and
  // time have flushed working memory.
  //
  // The ref resets on component remount (fresh session, including
  // resume-from-pause).
  const lastAnsweredBookRef = useRef({ bookId: null, ts: 0 });
  const BACK_TO_BACK_WINDOW_MS = 60_000;

  const isBackToBackSameBook = useCallback((bookId) => {
    const ref = lastAnsweredBookRef.current;
    if (ref.bookId !== bookId) return false;
    if (Date.now() - ref.ts > BACK_TO_BACK_WINDOW_MS) return false;
    return true;
  }, []);

  const updateLastAnswered = useCallback((bookId) => {
    lastAnsweredBookRef.current = { bookId, ts: Date.now() };
  }, []);

  const promptRowRef = useRef(null);
  const quizTopRef = useRef(null);
  const [overlayTop, setOverlayTop] = useState(null);
  useEffect(() => { fsrsCardsRef.current = fsrsCards; }, [fsrsCards]);
  useEffect(() => { confidentBuffersRef.current = confidentBuffers; }, [confidentBuffers]);
  useEffect(() => { targetBookRef.current = targetBook; }, [targetBook]);
  // v6 commit 39: keep sessionCompleteRef in sync with state so the
  // time-up tick interval (which holds a stale closure) can read the
  // current value via the ref.
  useEffect(() => { sessionCompleteRef.current = sessionComplete; }, [sessionComplete]);

  // ADR 0010 refinement: wraps recordRecentAnswer with back-to-back
  // suppression. Uses isBackToBackSameBook to detect working-memory
  // contamination. Two rules:
  //   1. If event.correct AND same book as last answered (within 60s)
  //      → SKIP (working-memory contamination — see ref declaration).
  //   2. Misses (correct: false) are always recorded. A miss after a
  //      same-book correct is the strongest "needs attention" signal
  //      (working memory should have helped — it didn't).
  //
  // The ref is updated separately at each answer site via
  // updateLastAnswered, NOT inside this wrapper. This keeps the
  // detection consistent across recentAnswers / FSRS / confident-buffer
  // pathways — they all share the same notion of "what was the
  // previous answered book".
  //
  // Caller can pass `null` for recordRecentAnswer (e.g. if the parent
  // hasn't wired it yet) — the wrapper is a no-op in that case.
  const recordRecentAnswerFiltered = useCallback((bookId, event) => {
    if (!recordRecentAnswer) return;
    if (event.correct && isBackToBackSameBook(bookId)) {
      return; // suppress as working-memory contamination
    }
    recordRecentAnswer(bookId, event);
  }, [recordRecentAnswer, isBackToBackSameBook]);

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

  // ─── v6.3 Quiz Mode timer effects ─────────────────────────────────
  // Mirror of Box Mode's timer structure, with two key differences:
  //   1. No expiry handler. The interval just keeps ticking until the
  //      user answers (which clears timerStart by setting feedback).
  //      No setFeedback('time-up') call, no applyAnswer flow.
  //   2. On expiry, the bar fill goes to 0 and stays there — the user
  //      can see they're "in slow territory" without being interrupted.
  //
  // Effect 1: reset on each new targetBook.
  //
  // v6.3: read the unified speed setting. Clamped defensively to the
  // slider's [2000, 30000] range in case a stale localStorage value
  // sneaks through unmigrated.
  const quizTargetSpeedMs = Math.max(2000, Math.min(30000, config?.targetSpeedMs ?? 10000));

  // Effect 1: cleanup only. Clears timerStart when there's no
  // active question (between sessions / pre-first-pick).
  //
  // v6.3.2: the "reset on each new targetBook" path that used to
  // live here is gone — it caused a one-frame race where the new
  // targetBook rendered with the OLD timerProgress value still in
  // state, producing a CSS-transition "fill-up" the moment the new
  // book appeared. The reset is now batched into pickNextBook so
  // the timer state is synchronized with targetBook in a single
  // render. This effect's job is narrower: just clear the timer
  // when no question is active.
  useEffect(() => {
    if (!targetBook) {
      setTimerStart(null);
    }
  }, [targetBook]);

  // Effect 2: tick interval. Updates timerProgress every 100ms.
  //
  // v6.3.4 (Scope B): on expiry, fires the time-up flow — mirror of
  // Box Mode's expiry handler. The asked book is revealed in blue,
  // the prompt becomes "Time's up — look for the blue cell!", an
  // FSRS Hard rating is committed for the question, and the user is
  // forced to tap the blue cell to advance (no other cells are
  // tappable). This replaces the v6.3.3 "informational only with an
  // amber overtime label" behavior — the modes are now uniform on
  // time-up, and the cell-color confusion that came from amber-vs-
  // orange under deutan colorblindness is eliminated.
  useEffect(() => {
    if (timerStart == null) return;
    expiryFiredRef.current = false;

    const interval = setInterval(() => {
      const elapsed = Date.now() - timerStart;
      const remaining = Math.max(0, quizTargetSpeedMs - elapsed);
      setTimerProgress(remaining / quizTargetSpeedMs);

      if (remaining <= 0 && !expiryFiredRef.current) {
        expiryFiredRef.current = true;
        clearInterval(interval);
        // v6 commit 39: skip the entire time-up flow if we've already
        // entered the session-complete state. Without this guard, a
        // tick callback queued from before commit 37's pickNextBook
        // early-return could fire AFTER setSessionComplete(true), push
        // `false` onto a confident book's buffer, and silently drop
        // the count from 66 to 65 between the celebration render and
        // the home render. See ADR 0004.
        if (sessionCompleteRef.current) return;
        // Skip if user already answered, or if there's no active
        // question (defensive — shouldn't happen since timerStart
        // is only set when a book is asked).
        if (feedbackRef.current) return;
        const tb = targetBookRef.current;
        if (!tb) return;

        // Block other cells immediately so the user can only tap
        // the about-to-be-revealed blue cell.
        feedbackRef.current = true;
        setHintVisible(false);

        // Record the question as a slow miss in the same shape
        // a normal slow-correct answer would use. timeTaken =
        // quizTargetSpeedMs (exactly the threshold) keeps the
        // training-time accumulator honest without inflating it
        // with thinking time the user spent past the deadline.
        const timeTaken = quizTargetSpeedMs;
        const cappedMs = Math.min(timeTaken, MAX_ANSWER_MS);
        setResponseTime(timeTaken);
        setResponseTimes(prev => [...prev, timeTaken]);
        setSessionMs(s => s + cappedMs);
        if (addTrainingTime) addTrainingTime(cappedMs);

        // FSRS Hard rating — same as a slow-correct. The book
        // comes back soon, but not as soon as an Again (true wrong)
        // would schedule it. The user knew the book; they just
        // couldn't find it fast enough, which is exactly what Hard
        // is supposed to capture.
        const currentCardData = fsrsCardsRef.current?.[tb.id];
        const currentCard = currentCardData
          ? deserializeCard(currentCardData)
          : createBookCard();
        const result = reviewBook(scheduler, currentCard, Rating.Hard);
        updateFsrsCard(tb.id, serializeCard(result.card));
        logAnswerResult(tb, currentCardData, serializeCard(result.card), Rating.Hard);

        // ADR 0010 + refinement: record the time-up as a miss. Misses
        // are always recorded (filtered wrapper lets them through
        // unconditionally) — even a miss right after a same-book
        // correct is a strong signal that the user can't hold the
        // book reliably.
        recordRecentAnswerFiltered(tb.id, { ms: 0, correct: false });

        // ADR 0010 refinement: record this as the last-answered book.
        // Time-up updates the ref so a subsequent same-book correct
        // (e.g., from the blue-cell tap acknowledgment after the
        // reveal) is detected as working-memory contamination.
        updateLastAnswered(tb.id);

        // Confident buffer: push `false` — a question that timed
        // out is by definition not a confident answer. Mirrors the
        // slow-correct path.
        if (updateConfidentBuffer) {
          updateConfidentBuffer(tb.id, false);
        }

        // Score: total++ but correct stays the same — same as
        // slow-correct. Streak resets — you didn't get this one
        // confidently.
        setScore(prev => ({ correct: prev.correct, total: prev.total + 1 }));
        setStreak(0);

        // Visual state mirroring Box Mode: blue reveal + orange
        // prompt + "Time's up — look for the blue cell!" label.
        // setCorrectBookId reveals the asked book; the prompt
        // class chain in render handles the prompt styling based
        // on feedback === 'time-up'.
        setFeedback('time-up');
        setCorrectBookId(tb.id);

        // Scroll to the revealed book so a user who'd scrolled
        // away during their search lands back on the answer.
        // Double-rAF for the same reason wrong-tap uses it.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            document.querySelector(`[data-book-id="${tb.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
        });
      }
    }, 100);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStart, quizTargetSpeedMs]);

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

    // v6 commit 37: 66/66 confident check — FIRST early-return.
    // When the user reaches all 66 confident, immediately fire the
    // session-complete screen (which detects isAll66 and renders the
    // 🏆 celebration). Pre-37, this only fired after a full maintenance
    // round had cycled through all 66 books, during which a slow answer
    // could de-confident a book — the user would reach 66 briefly, lose
    // it during maintenance without realising, then see 65/66 on home
    // and assume the share button had caused it.
    //
    // The ref guards against re-triggering: even though ADR 0008 removed
    // the "Continue training" / maintenance round path, race conditions
    // between answer-commit and session-complete remain possible (an
    // in-flight buffer update can briefly push 66 → 65 → 66 before the
    // complete screen mounts). Firing the celebration only once per
    // mount handles this cleanly.
    //
    // See ADR 0003 for the full design rationale, including alternatives
    // considered (freeze buffers in maintenance, warning banner).
    const currentConfidentCount = getConfidentCount(
      confidentBuffersRef.current || {},
      bibleBooks
    );
    if (currentConfidentCount === 66 && !hasTriggeredSixtySixRef.current) {
      hasTriggeredSixtySixRef.current = true;
      setSessionComplete(true);
      return;
    }

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
        // v6.4 (ADR 0008): under the speedrun-only model, "no due, no
        // unseen, no non-confident" can only mean all 66 books are
        // confident. The 66-confident guard near the top of pickNextBook
        // catches that case first and fires setSessionComplete before
        // reaching here — so this else branch should be unreachable
        // under normal flow. Kept as a defensive safety net: if some
        // unforeseen state slips through (e.g. a future picker change
        // bypasses the guard), end the session cleanly rather than
        // surface an empty grid. The pre-v6.4 maintenance picker that
        // lived here (lowest-stability pool filtered by roundSeenBooks
        // for terminating Full sessions) is gone with the Continue-
        // training removal.
        setSessionComplete(true);
        return;
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
    // v6.3.2: batch the visible-timer reset into the same render as
    // setTargetBook so the bar appears at full on the first frame the
    // new book is shown. Without this batching, the useEffect-driven
    // timer reset fired AFTER the render commit, producing a visible
    // "fill-up" CSS transition from the previous question's progress
    // value to 1.0 over 100ms — making the bar appear to MOVE during
    // the first frames of a new question, which contradicted what the
    // timer was actually measuring. Both the visible bar (timerStart/
    // timerProgress) and the FSRS response-time measurement (startTime
    // above) now anchor to the same Date.now() in the same batch.
    setTimerStart(Date.now());
    setTimerProgress(1);
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
      if (Array.isArray(s.sessionSeenBooks)) {
        setSessionSeenBooks(new Set(s.sessionSeenBooks));
      }
      if (typeof s.sessionNewBests === 'number') setSessionNewBests(s.sessionNewBests);
      if (typeof s.sessionMs === 'number') setSessionMs(s.sessionMs);
      if (typeof s.sessionPickCount === 'number') sessionPickCountRef.current = s.sessionPickCount;
      setStartTime(Date.now());
      // v6.3.2: re-anchor the visible timer too on resume, alongside
      // the FSRS response-time anchor (setStartTime above). Same
      // single-batch rule — pinning these together prevents the bar
      // from fill-up-animating when the restored question first
      // renders. The user-shouldn't-be-penalised-for-paused-time
      // logic that applies to startTime also applies to the visible
      // timer; both restart fresh.
      setTimerStart(Date.now());
      setTimerProgress(1);
      // v6.3.3: re-fire auto-scroll on resume. Previously only
      // pickNextBook ran the OT-top / NT-bottom scroll, which meant
      // a paused-and-resumed session would land the user wherever
      // the page happened to be — usually the wrong half for the
      // restored question. Mirrors the pickNextBook scroll logic
      // exactly: same scrollRef target, same delay, same sideBySide
      // exemption (no horizontal-scroll-to-half on tablets/desktop
      // landscape where both halves are visible).
      if (s.targetBook && config.display.autoScroll !== false && testamentsLayout !== 'sideBySide') {
        schedule(() => {
          const el = scrollRef.current;
          if (!el) return;
          if (s.targetBook.testament === 'OT') {
            el.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
          }
        }, 400);
      }
      logSessionStart(fsrsCardsRef.current || {}, bibleBooks);
    } else {
      logSessionStart(fsrsCardsRef.current || {}, bibleBooks);
      pickNextBook();
    }

    // v6 commit 37: on resume, if the user already has 66 confident,
    // skip showing the resumed question and go straight to the
    // session-complete prompt with 🏆 celebration. This is the resume-
    // path equivalent of the pickNextBook early-return; the fresh-start
    // case is handled by pickNextBook itself above. See ADR 0003.
    if (initialPausedSession) {
      const count = getConfidentCount(confidentBuffersRef.current || {}, bibleBooks);
      if (count === 66) {
        hasTriggeredSixtySixRef.current = true;
        setSessionComplete(true);
      }
    }

    window.scrollTo(0, 0);
    // First pick only — pickNextBook is called manually after each
    // answer, so we don't want a re-run when its identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v6.4 (ADR 0008): finishSession removed. Its responsibilities
  // (logSessionEnd + saveCurrentSegment + clear-pause + onBack) are
  // now absorbed into handleBack's sessionComplete branch, which is
  // the only path that needs them in the speedrun-only model.

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
      // v6.4 (speedrun-only model, ADR 0008): the back arrow is the sole
      // exit from the celebration screen — Continue training and End
      // session buttons removed. Absorb their bookkeeping here: write
      // the session segment, clear any stale paused-session snapshot
      // (which can exist if this run was pause-and-resumed), then
      // navigate back. Equivalent to what the old End session button
      // did via finishSession.
      logSessionEnd(fsrsCardsRef.current || {}, bibleBooks);
      saveCurrentSegment();
      if (onPause) onPause(null);
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
  }, [onBack, onPause, sessionComplete, saveCurrentSegment, targetBook, streak, score, responseTimes,
      sessionMasteredBooks, sessionHintedBooks, sessionWrongBooks, sessionSeenBooks,
      sessionNewBests, sessionMs, sessionLimit]);

  // v6.4 (ADR 0008): handleEndSession + handleContinueTraining removed.
  // The speedrun-only model has a single exit path on the celebration
  // screen — the back arrow — which handleBack now handles directly
  // (save + clear-pause + onBack) when sessionComplete is true.

  const handleBookClick = (book) => {
    if (!targetBook) return;
    // v6 commit 39: defense-in-depth — if we've already entered
    // session-complete state, no book click should mutate buffers.
    // In practice the book grid isn't rendered when sessionComplete
    // is true (the session-complete UI replaces it), so this is a
    // belt-and-braces guard against any queued or synthesised click
    // that might slip through. See ADR 0004.
    if (sessionComplete) return;
    // Allow clicking the correct book to dismiss feedback and advance.
    // Both time-up and wrong-answer use the same click-to-advance flow:
    // user taps the revealed blue cell, feedback clears, picker fires.
    // Only the prompt text differs ("⏱ Te traag — was X" for time-up,
    // "❌ Fout — was X" for wrong-answer). See ADR 0007 — supersedes
    // the 1500ms minimum read window from ADR 0002.
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

      const isWithinTime = timeTaken <= config.targetSpeedMs;
      const rating = ratingFromSpeed(timeTaken, config.targetSpeedMs);
      setFeedback(isWithinTime ? 'correct' : 'slow');

      // ADR 0010 + refinement: record this correct answer into the
      // recent-answer window via the filtered wrapper. If this is the
      // SAME book as the last recorded answer, the wrapper suppresses
      // this record as working-memory contamination (the user just
      // located this cell visually; the 1-2s answer measures recall
      // from working memory, not long-term memory).
      recordRecentAnswerFiltered(targetBook.id, { ms: cappedMs, correct: true });

      // ADR 0010 refinement (revised): same-book back-to-back protection
      // for recall-quality metrics. When the user just answered this
      // same book within the last 60 seconds, the current answer is
      // working-memory-assisted, not real recall:
      //   - Confident buffer: force false. Working memory should not
      //     advance the gold-line signal.
      //   - recentAnswers: suppressed (handled in the wrapper above).
      //   - bestTime: skipped (handled in the personal-best block below).
      //   - Score, streak, best-time, training-time: unchanged. The
      //     user DID answer correctly and quickly — those metrics
      //     reflect tap performance, not recall quality.
      //
      // What we DON'T override: the FSRS Rating. An earlier version of
      // this refinement (commit 1069c4e) forced Rating.Hard on wm
      // repeats, intending to keep contaminated books from earning easy
      // long intervals. Live testing revealed this caused a vicious
      // picker cycle: Hard-rated books stay in the ~10-minute due pool,
      // the picker draws randomly from the top-8 of that pool, and
      // since most recently-answered books in an active race are also
      // Hard-overridden, the pool fills with same-book candidates →
      // up to 10 consecutive picks of the same book. Rolled back in
      // f4a2c1d (commit hash TBD when committed). FSRS-6 has its own
      // same-day stability dampening (S^(-w_19) term), which together
      // with the picker's random draw from top-8 provides adequate
      // protection against contaminated long intervals — without the
      // pathological repetition.
      const isWorkingMemoryRepeat = isBackToBackSameBook(targetBook.id);
      const effectiveConfidentHit = isWorkingMemoryRepeat ? false : isWithinTime;

      // Update FSRS card with the natural rating (no override).
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
      //
      // ADR 0010 refinement: effectiveConfidentHit forces false when
      // this is a same-book back-to-back working-memory repeat (see
      // override block above). Real recall must come from spaced
      // practice, not from a working-memory loop.
      const wasConfident = isConfident(confidentBuffers[targetBook.id]);
      const nextBuffer = recordConfidentAttempt(confidentBuffers[targetBook.id], effectiveConfidentHit);
      const isNowConfident = isConfident(nextBuffer);
      if (updateConfidentBuffer) {
        updateConfidentBuffer(targetBook.id, effectiveConfidentHit);
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
        //
        // Two separate concerns that v6 commit 18 split into two
        // distinct conditions:
        //
        //   isFirstSolve — there's no prior best time recorded for this
        //   book yet. We still want to record the current timeTaken as
        //   the baseline (so a future faster solve can be detected as
        //   an improvement), but we do NOT show a "⚡ New best"
        //   celebration. Calling a first-time-anything a "record" is
        //   semantically wrong — a record requires a previous benchmark
        //   to beat. UX-wise, modern apps (Speedrun.com, Anki, Strava,
        //   Duolingo) all treat first-time events as a baseline, not as
        //   a personal record.
        //
        //   isNewBest — there's a prior best AND this attempt is
        //   strictly faster. This is a genuine improvement; show the
        //   celebration and bump the session counter.
        //
        // Both conditions update bestTime; only isNewBest triggers UI.
        //
        // ADR 0010 refinement: same-book back-to-back working-memory
        // repeats are excluded from both the bestTime record and the
        // celebration. A 1-second answer right after a 5-second answer
        // for the same book measures working memory, not real recall —
        // it shouldn't become the personal best. Consistent with the
        // FSRS Rating and confident-buffer overrides above: a wm-assisted
        // tap doesn't count toward any "you've improved" signal. The
        // user's tap was real (score, streak, sessionMs all still count),
        // but the bestTime metric is supposed to reflect recall quality,
        // not raw tap speed.
        const prevBest = bestTimes[targetBook.id];
        const isFirstSolve = !prevBest;
        const isNewBest = !isFirstSolve && timeTaken < prevBest;
        if (!isWorkingMemoryRepeat && (isFirstSolve || isNewBest)) {
          updateBestTime(targetBook.id, timeTaken);
        }
        if (!isWorkingMemoryRepeat && isNewBest) {
          setSessionNewBests(prev => prev + 1);
          setNewBestTime(timeTaken);
          setShowNewBest(true);
          // v6 commit 17: dismiss the "⚡ New best" celebration on the
          // same delay as pickNextBook below. The two displays (plain
          // "✓ Correct X.Xs" and "⚡ New best X.Xs") have identical
          // duration — the inconsistency between a 1500ms record
          // display and a ~800ms standard display was confusing users
          // who expected uniform pacing between questions.
          schedule(() => setShowNewBest(false), autoPickDelayMs(config.targetSpeedMs));
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

      // ADR 0010 refinement: record this as the last-answered book so
      // the NEXT pick can detect back-to-back working-memory contamination.
      // Placed at the end of the correct-flow so all checks above
      // (recentAnswers wrapper, FSRS rating override, confident buffer)
      // saw the PREVIOUS book context, not this one.
      updateLastAnswered(targetBook.id);

      schedule(() => pickNextBook(), autoPickDelayMs(config.targetSpeedMs));
      return;
    }

    // Wrong click — rate as Again
    feedbackRef.current = true;
    setFeedback('wrong');
    setCorrectBookId(targetBook.id);

    // ADR 0010 + refinement: record the miss. Misses always go through
    // the filter (the wrapper only suppresses correct same-book repeats,
    // not misses). A wrong-tap even after a same-book correct is the
    // strongest possible "needs attention" signal — working memory
    // should have helped, but didn't.
    recordRecentAnswerFiltered(targetBook.id, { ms: 0, correct: false });

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

    // ADR 0010 refinement: record this as the last-answered book.
    // Misses still update the ref so a subsequent same-book correct
    // (e.g., from the blue-cell tap acknowledgment) is detected as
    // working-memory contamination — the user just saw the answer
    // revealed.
    updateLastAnswered(targetBook.id);

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
    // v6.3.4 (Scope B): the asked book turns blue for any "this is the
    // answer" state — correct, slow, wrong (revealed), or time-up. The
    // earlier amber `#f59e0b` for slow was confusing under deutan
    // colorblindness (visually fuses with the orange wrong-tap color),
    // and the "you were slow" information is already carried by the
    // prompt label ("⏱ Too slow — Xs") and the FSRS rating downgrade.
    // No need to encode it twice in two different colors that look
    // identical to half the users. Blue alone for the asked book =
    // "this is what you needed to find."
    if (showCorrect) bgColor = '#3b82f6';
    else if (isCorrectReveal) bgColor = '#3b82f6';
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
  // v6.4 (ADR 0008): the speedrun-only model collapses this screen to
  // a single state — sessionComplete only ever fires at 66/66 confident
  // (the maintenance-mode Branch 4 that produced the < 66 "Session
  // complete" variant is eliminated). The screen is purely a milestone
  // moment: trophy + total time + Share + back-arrow header.
  if (sessionComplete) {
    return (
      <div className="quiz-grid session-complete-screen">
        {/* v6.4 (ADR 0008): back-arrow header on the celebration screen.
            Single exit path — same chrome the user already used during
            active quiz. No bottom action buttons (Anki community Github
            #15349: single-action celebration buttons read as friction,
            not service). User dwells as long as they want, taps Share
            if they want, then exits via the back arrow. */}
        <div className="quiz-top">
          <div className="quiz-prompt-row">
            <button className="back-btn" onClick={handleBack}>← {t.back}</button>
          </div>
        </div>
        <div className="celebration-66 celebration-66-inline">
          <span className="celebration-trophy" aria-hidden="true">🏆</span>
          <h2 className="celebration-title">{t.celebration66Title}</h2>
          <p className="celebration-body">{t.celebration66Body}</p>
          {totalQuizMs > 0 && (
            <div className="celebration-time">
              <span className="celebration-time-label">{t.celebrationTimeLabel}</span>
              <span className="celebration-time-value">{formatDuration(totalQuizMs)}</span>
            </div>
          )}
          {/* v6.4 (ADR 0008): Share button on the in-quiz celebration.
              Matches the parallel Share button on the home celebration
              card so users can share at the milestone moment without
              navigating home first. Same .celebration-share-btn style
              for visual consistency. Only renders if onShare is wired —
              defensive null check in case QuizGrid is mounted from a
              context that doesn't pass it through. */}
          {onShare && (
            <div className="celebration-actions">
              <button className="btn celebration-share-btn" onClick={onShare}>
                🔗 {t.share}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!targetBook) return null;

  // v6.3.4 (Scope B): isOvertime flag retired. The "timer expired but
  // no answer yet" state used to be a derived flag that only changed
  // prompt styling. It's now a real feedback state (feedback === 'time-up')
  // committed by the timer-expiry handler, with full Box-Mode-parity
  // behavior: blue reveal, orange prompt, forced tap-blue to advance.

  return (
    <div className="quiz-grid">
      {/* v6.3: visible speed-target countdown bar — same place and
          same visual structure as Box Mode's bar (above .quiz-top).
          Bar fills with the warm accent and ticks down over
          targetSpeedMs. On expiry the fill scales to 0 and stays;
          there is no flow change (the user just sees they're now
          past the FSRS Easy/Good threshold). Container stays
          rendered with its 4px height so the grid below doesn't
          jump when feedback states cycle. */}
      <div
        className="quiz-timer-bar"
        role="progressbar"
        aria-label={t.boxModeTimePressureLabel || 'Time pressure'}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={(!feedback && timerStart != null) ? timerProgress : 0}
      >
        <div
          key={timerStart || 'idle'}
          className="quiz-timer-bar-fill"
          style={{
            transform: `scaleX(${(!feedback && timerStart != null) ? timerProgress : 0})`,
          }}
        />
      </div>

      <div className="quiz-top" ref={quizTopRef}>
        <div className="quiz-prompt-row" ref={promptRowRef}>
          <button className="back-btn" onClick={handleBack}>← {t.back}</button>
          <div className={`quiz-prompt ${
            !hintVisible && feedback === 'correct' && !showNewBest ? 'prompt-correct' :
            !hintVisible && showNewBest ? 'prompt-correct' :
            !hintVisible && feedback === 'slow' ? 'prompt-slow' :
            !hintVisible && (feedback === 'wrong' || feedback === 'time-up') ? 'prompt-wrong' : ''
          }`}>
            {!hintVisible && feedback === 'correct' && !showNewBest
              ? <span className="prompt-book">✓ {t.correct} {formatTime(responseTime)}</span>
              : !hintVisible && showNewBest
              ? <span className="prompt-book">⚡ {t.newBest} {formatTime(newBestTime)}</span>
              : !hintVisible && feedback === 'slow'
              ? <span className="prompt-book">⏱ {t.tooSlow} — {formatTime(responseTime)}</span>
              : !hintVisible && feedback === 'wrong'
              ? <span className="prompt-book">✗ {t.wrongShowCorrect || t.wrong}</span>
              : !hintVisible && feedback === 'time-up'
              ? <span className="prompt-book">⏱ {t.boxModeTimeUp || "Time's up — look for the blue cell!"}</span>
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

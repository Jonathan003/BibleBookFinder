// Box Mode (Doos Modus) — single-session Leitner-style training.
//
// Three phases, switched by `phase` state:
//   1. 'selecting' — pick scope (all 66 / specific group)
//   2. 'playing'   — quiz loop with the boxes display + book grid
//   3. 'complete'  — end-screen with personal-best comparison
//
// Reuses the existing book-grid styling from QuizGrid.css (.book-cell,
// .book-grid, .section, .testaments-side-by-side) so the grid renders
// identically — same fonts, abbreviations, side-by-side layout, mastery
// line, etc. Layout decisions are delegated to useGridLayout, exactly
// like QuizGrid does.
//
// The "rooted" indicator on cells: books that have reached Box 5 get a
// subtle amber background tint and a sparkle icon. They're not disabled
// (so the user can see them on the grid) but they won't be asked again
// — the picker won't pick them.

import { useState, useEffect, useCallback, useRef } from 'react';
import { bibleBooks, groupColors, groupNames, getBookDisplayName } from '../data';
import { useAppConfig } from '../App';
import { useGridLayout } from '../useGridLayout';
import { useTimeoutManager } from '../useTimeoutManager';
import {
  createInitialState, pickNextBookId, applyAnswer, markHintUsed, markSlow, setCurrentBook,
  isComplete, endSession, getBoxCounts, getRecentAnswers, getElapsedMs, TOP_BOX,
} from '../boxMode';
import { recordCompletion, getBoxModeBestForScope } from '../boxModeStorage';
import { formatDuration } from '../timeFormat';
import BoxModeBoxes, { BoxModeRecentDots } from './BoxModeBoxes';
import './BoxMode.css';

// Glow duration on the destination box after each advancement (ms).
// Short enough not to delay the next pick, long enough to register
// visually as the user's eye returns to the boxes display.
const HIGHLIGHT_DURATION_MS = 600;

// Delay between answer commit and the next pick. Short enough to feel
// snappy, long enough to let the user see the feedback color flash
// before the prompt changes.
const NEXT_PICK_DELAY_MS = 700;

// Parse a timePressure setting like 'soft-10s' into { mode, ms } or null
// for 'off' / unset. Defensive against malformed values — caller treats
// null as "no timer."
function parseTimePressure(value) {
  if (!value || value === 'off') return null;
  const m = /^(soft|hard)-(\d+)s$/.exec(value);
  if (!m) return null;
  return { mode: m[1], ms: Number(m[2]) * 1000 };
}

export default function BoxMode({ ownerUserId, onBack }) {
  const { config, t, lang } = useAppConfig();
  const { otColumns, ntColumns, displayMode, testamentsLayout, gridRef } = useGridLayout();
  const schedule = useTimeoutManager();

  // Phase: 'selecting' | 'playing' | 'complete'
  const [phase, setPhase] = useState('selecting');

  // Selection state — scope is locked in when transitioning to 'playing'.
  const [scope, setScope] = useState('all');

  // The full Box Mode game state, or null when not playing.
  const [state, setState] = useState(null);
  // Mirror in a ref so async callbacks (after setTimeout) read fresh state
  // instead of the closure value at scheduling time.
  const stateRef = useRef(null);
  // Scroll container for the book grid. Mirrors QuizGrid's pattern —
  // attached to the .quiz-bottom div which holds both testament sections.
  // When a new book is asked, we scroll this container so the relevant
  // testament half is visible without revealing the exact book location.
  const scrollRef = useRef(null);
  // Refs for the hint-overlay positioning machinery (mirrors QuizGrid).
  // The hint overlay needs to dock just below the prompt row so it
  // covers any topbar elements (pill, boxes, dots) but never the book
  // grid. Static positioning is unreliable across orientations and
  // browsers; computing offsetTop dynamically is.
  const promptRowRef = useRef(null);
  const quizTopRef = useRef(null);
  const [overlayTop, setOverlayTop] = useState(null);
  useEffect(() => { stateRef.current = state; }, [state]);

  // UI feedback
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | null
  const [correctBookId, setCorrectBookId] = useState(null); // book to highlight on wrong answer
  const [highlightedBox, setHighlightedBox] = useState(null); // for destination-box glow

  // Per-question timer.
  //   timerStart    = ms timestamp when the current question started.
  //                   Reset on each new currentBookId pick, on hint use
  //                   (no — hint doesn't reset; user already lost the
  //                   chance to advance), and on session entry.
  //   timerProgress = 0..1, fraction of the time budget remaining.
  //                   Drives the depleting bar's visual width.
  //                   Updated every 100ms while a timer is active.
  // The timer is OFF when config.boxMode.timePressure === 'off' (or
  // unset). In that case, neither the bar renders nor the expiry
  // logic fires, and Box Mode behaves exactly as in v1.
  const [timerStart, setTimerStart] = useState(null);
  const [timerProgress, setTimerProgress] = useState(1);
  const [hintVisible, setHintVisible] = useState(false);

  // ─── Timer effects ────────────────────────────────────────────────
  // These have to be declared AFTER the useState calls they depend on
  // — dep arrays are evaluated during render, so referencing
  // `timerStart` in the dep array before it's been declared throws
  // a temporal-dead-zone error. (Lesson learned the hard way.)

  // Effect 1: reset on each new currentBookId.
  // Triggered when entering 'playing' (first book) and on every
  // advanceToNextBook (either after a correct or wrong answer). Skipped
  // entirely when timePressure is off — no point resetting a non-running
  // timer.
  const tp = parseTimePressure(config?.boxMode?.timePressure);
  const currentBookId = state?.currentBookId;
  useEffect(() => {
    if (!tp) {
      setTimerStart(null);
      setTimerProgress(1);
      return;
    }
    if (phase !== 'playing' || currentBookId == null) {
      setTimerStart(null);
      return;
    }
    setTimerStart(Date.now());
    setTimerProgress(1);
  }, [currentBookId, phase, tp?.ms, tp?.mode]);

  // Effect 2: tick interval. Updates timerProgress every 100ms
  // and fires the expiry handler exactly once when the budget hits
  // zero. We use a sentinel ref to ensure the expiry callback runs at
  // most once per question, even if the interval ticks just before the
  // setTimerStart(null) cleanup races.
  const expiryFiredRef = useRef(false);
  useEffect(() => {
    if (!tp || timerStart == null) return;
    expiryFiredRef.current = false;

    const interval = setInterval(() => {
      const elapsed = Date.now() - timerStart;
      const remaining = Math.max(0, tp.ms - elapsed);
      setTimerProgress(remaining / tp.ms);

      if (remaining <= 0 && !expiryFiredRef.current) {
        expiryFiredRef.current = true;
        clearInterval(interval);
        // Don't fire if user already answered (state changed) or is mid-
        // feedback (correct/wrong flash already in progress).
        const s = stateRef.current;
        if (!s || s.currentBookId == null) return;
        if (feedback) return;

        if (tp.mode === 'soft') {
          // Soft: mark this question slow; correct answer will not
          // advance the box. Timer disappears (it already hit zero) but
          // the user keeps answering.
          const next = markSlow(s);
          setState(next);
          stateRef.current = next;
        } else {
          // Hard: auto-trigger wrong-answer flow. Reveals the correct
          // book and applies demotion via applyAnswer — same effect as
          // the user tapping the wrong book, just triggered by timeout
          // instead of a tap. From here the user must tap the
          // highlighted correct book to acknowledge it and advance,
          // matching the regular wrong-answer flow.
          setFeedback('wrong');
          setCorrectBookId(s.currentBookId);
          const next = applyAnswer(s, { bookId: s.currentBookId, correct: false });
          setState(next);
          stateRef.current = next;
        }
      }
    }, 100);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStart, tp?.ms, tp?.mode, feedback]);

  // ─── Auto-scroll on each new book pick ────────────────────────────
  // Mirrors QuizGrid's behavior: when a new book is asked, scroll the
  // .quiz-bottom container so the relevant testament half is visible.
  // OT book → scroll to top; NT book → scroll to bottom. Doesn't reveal
  // the book's exact location (the user still has to find it within
  // the half), it just brings the right region into view.
  //
  // Skipped in sideBySide layout because both testaments are visible
  // simultaneously — auto-scrolling there would cause a confusing jump
  // with no benefit (same logic QuizGrid uses).
  useEffect(() => {
    if (phase !== 'playing' || currentBookId == null) return;
    if (config.display.autoScroll === false) return;
    if (testamentsLayout === 'sideBySide') return;

    const target = bibleBooks.find(b => b.id === currentBookId);
    if (!target) return;

    schedule(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (target.testament === 'OT') {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }, 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBookId, phase, config.display.autoScroll, testamentsLayout]);

  // ─── Hint overlay position measurement ────────────────────────────
  // Same mechanism QuizGrid uses: measure the prompt-row's bottom edge
  // and pin the absolute-positioned hint overlay there, so it docks
  // just below the prompt and covers other topbar elements (pill,
  // boxes, recent dots) but NEVER the book grid below.
  // Re-measures on viewport resize and on each new book (since prompt
  // text width can change, which can wrap-affect prompt-row height
  // in landscape).
  useEffect(() => {
    const measure = () => {
      if (!promptRowRef.current || !quizTopRef.current) return;
      const promptBottom = promptRowRef.current.offsetTop + promptRowRef.current.offsetHeight;
      setOverlayTop(promptBottom);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [currentBookId, phase]);

  // End-screen result of recordCompletion (which bests were beaten)
  const [completionResult, setCompletionResult] = useState(null);
  // The session data passed to recordCompletion — kept for the end-screen render
  const [finishedSessionData, setFinishedSessionData] = useState(null);

  // ─── Selection screen actions ──────────────────────────────────────

  const startSession = useCallback(() => {
    const failMode = config.boxMode?.failMode || 'soft';
    const initial = createInitialState({ books: bibleBooks, scope, failMode });
    const firstBookId = pickNextBookId(initial);
    if (firstBookId == null) {
      // Empty scope — shouldn't happen with our group filters but guard anyway
      return;
    }
    const withFirst = setCurrentBook(initial, firstBookId);
    setState(withFirst);
    stateRef.current = withFirst;
    setFeedback(null);
    setCorrectBookId(null);
    setHintVisible(false);
    setHighlightedBox(null);
    setPhase('playing');
  }, [config.boxMode?.failMode, scope]);

  // ─── Quiz loop actions ─────────────────────────────────────────────

  const handleBookClick = useCallback((book) => {
    const s = stateRef.current;
    if (!s || s.currentBookId == null) return;
    // Wrong-answer flow uses tap-to-continue (mirrors QuizGrid's
    // pattern, agreed upon as pedagogically stronger than auto-advance).
    // While in 'wrong' feedback state, the only meaningful action is
    // tapping the highlighted correct book to acknowledge it and move
    // on. Taps elsewhere are ignored — no new answer is applied,
    // since one was already applied at the moment of the wrong tap.
    if (feedback === 'wrong') {
      if (book.id !== s.currentBookId) return;
      setFeedback(null);
      setCorrectBookId(null);
      advanceToNextBook();
      return;
    }
    // 'correct' feedback is still a blocking window — the destination-box
    // glow animation needs to play out cleanly without re-clicks racing
    // past it. (The 'correct' window is short — HIGHLIGHT_DURATION_MS
    // 600ms — and ends with an automatic advance, so the user isn't
    // waiting on a tap here.)
    if (feedback === 'correct') return;

    const isCorrect = book.id === s.currentBookId;

    if (isCorrect) {
      // Apply the answer to state, then schedule a glow on the destination
      // box (which we know from the pre-update state) and the next pick.
      const fromBox = s.bookBoxes[s.currentBookId];
      const willAdvance = !s.hintUsedOnCurrent;
      const toBox = willAdvance ? Math.min(TOP_BOX, fromBox + 1) : fromBox;
      const next = applyAnswer(s, { bookId: s.currentBookId, correct: true });
      setState(next);
      stateRef.current = next;
      setFeedback('correct');

      // Highlight the destination box (only if it actually changed — hint-
      // suppressed advancement shouldn't pretend the box moved). The
      // callback guards against stateRef going null (user pressed Back
      // mid-glow) so we don't briefly flash highlights on the selecting
      // screen.
      if (toBox !== fromBox) {
        setHighlightedBox(toBox);
        schedule(() => {
          if (stateRef.current) setHighlightedBox(null);
        }, HIGHLIGHT_DURATION_MS);
      }

      // If complete, transition to end-screen. Otherwise pick next.
      if (isComplete(next)) {
        const ended = endSession(next);
        finishToEndScreen(ended);
      } else {
        schedule(() => {
          if (stateRef.current) advanceToNextBook();
        }, NEXT_PICK_DELAY_MS);
      }
    } else {
      // Wrong: show feedback, reveal correct book, apply demotion (or
      // recovery skip, whichever applies via applyAnswer's logic).
      // Stay on this state — the user must tap the highlighted correct
      // book to acknowledge it and advance (handled in handleBookClick's
      // wrong-feedback branch above). No timed auto-advance.
      setFeedback('wrong');
      setCorrectBookId(s.currentBookId);
      const next = applyAnswer(s, { bookId: s.currentBookId, correct: false });
      setState(next);
      stateRef.current = next;
    }
  }, [feedback, schedule]);

  const advanceToNextBook = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    const nextId = pickNextBookId(s);
    if (nextId == null) {
      // No more eligible books — session complete
      const ended = endSession(s);
      finishToEndScreen(ended);
      return;
    }
    const next = setCurrentBook(s, nextId);
    setState(next);
    stateRef.current = next;
    setFeedback(null);
    setCorrectBookId(null);
    setHintVisible(false);
  }, []);

  const finishToEndScreen = useCallback((endedState) => {
    setState(endedState);
    stateRef.current = endedState;
    const sessionData = {
      elapsedMs: getElapsedMs(endedState),
      mistakes: endedState.mistakes,
      longestStreak: endedState.longestStreak,
    };
    setFinishedSessionData(sessionData);
    const result = recordCompletion(ownerUserId, endedState.scope, sessionData);
    setCompletionResult(result);
    setPhase('complete');
  }, [ownerUserId]);

  const handleHint = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.hintUsedOnCurrent) return;
    if (feedback) return; // can't hint mid-feedback
    setHintVisible(true);
    const next = markHintUsed(s);
    setState(next);
    stateRef.current = next;
  }, [feedback]);

  const handleBack = useCallback(() => {
    if (phase === 'playing') {
      // Mid-session back: bail — no autosave for partial sessions (Box
      // Mode is cram, no FSRS impact). Personal bests only count
      // completed clears. Setting state to null causes pending scheduled
      // callbacks to no-op via their stateRef guards.
      setPhase('selecting');
      setState(null);
      stateRef.current = null;
    } else {
      onBack();
    }
  }, [phase, onBack]);

  // Cleanup is handled implicitly by useTimeoutManager on unmount.

  // ─── Selection screen ──────────────────────────────────────────────

  if (phase === 'selecting') {
    return (
      <div className="boxmode-screen boxmode-selecting">
        <div className="boxmode-header">
          <button className="back-btn" onClick={onBack}>← {t.back}</button>
          <h2>{t.boxModeTitle}</h2>
        </div>

        <p className="boxmode-intro">{t.boxModeIntro}</p>

        <div className="boxmode-scope-options">
          <button
            className={`boxmode-scope-option ${scope === 'all' ? 'selected' : ''}`}
            onClick={() => setScope('all')}
          >
            <span className="scope-label">{t.boxModeScopeAll}</span>
            <span className="scope-count">66</span>
          </button>
          {Object.keys(groupNames[lang] || groupNames.nl).map(groupId => {
            const count = bibleBooks.filter(b => b.group === groupId).length;
            const groupLabel = (groupNames[lang]?.[groupId] || groupNames.nl[groupId] || '').split('—')[0].trim();
            const id = `group:${groupId}`;
            return (
              <button
                key={id}
                className={`boxmode-scope-option ${scope === id ? 'selected' : ''}`}
                onClick={() => setScope(id)}
              >
                <span className="scope-label">{groupLabel}</span>
                <span className="scope-count">{count}</span>
              </button>
            );
          })}
        </div>

        <button className="btn boxmode-start-btn" onClick={startSession}>
          {t.boxModeStart}
        </button>

        <p className="boxmode-disclaimer">{t.boxModeDisclaimer}</p>
      </div>
    );
  }

  // ─── End screen ────────────────────────────────────────────────────

  if (phase === 'complete' && state && finishedSessionData) {
    const prev = getBoxModeBestForScope(ownerUserId, state.scope);
    const scopeLabel = scope === 'all'
      ? t.boxModeScopeAll
      : (groupNames[lang]?.[state.scope.slice('group:'.length)] || '').split('—')[0].trim();
    const totalBooks = state.selectedBookIds.length;

    return (
      <div className="boxmode-screen boxmode-complete">
        <div className="boxmode-celebration-icon">🎯</div>
        <h2 className="boxmode-complete-title">
          {t.boxModeCompleteTitle.replace('{count}', totalBooks).replace('{scope}', scopeLabel)}
        </h2>
        {completionResult?.isFirstCompletion && (
          <div className="boxmode-first-clear">{t.boxModeFirstClear}</div>
        )}

        <div className="boxmode-complete-stats">
          <div className="boxmode-stat">
            <span className="boxmode-stat-number">{formatDuration(finishedSessionData.elapsedMs)}</span>
            <span className="boxmode-stat-label">{t.boxModeStatTime}</span>
            {completionResult?.fastestNew && !completionResult?.isFirstCompletion && (
              <span className="boxmode-record-badge">{t.boxModeNewRecord}</span>
            )}
          </div>
          <div className="boxmode-stat">
            <span className="boxmode-stat-number">{finishedSessionData.mistakes}</span>
            <span className="boxmode-stat-label">{t.boxModeStatMistakes}</span>
            {completionResult?.fewestMistakesNew && !completionResult?.isFirstCompletion && (
              <span className="boxmode-record-badge">{t.boxModeNewRecord}</span>
            )}
          </div>
          <div className="boxmode-stat">
            <span className="boxmode-stat-number">{finishedSessionData.longestStreak}</span>
            <span className="boxmode-stat-label">{t.boxModeStatStreak}</span>
            {completionResult?.longestStreakNew && !completionResult?.isFirstCompletion && (
              <span className="boxmode-record-badge">{t.boxModeNewRecord}</span>
            )}
          </div>
        </div>

        {prev && !completionResult?.isFirstCompletion && (
          <div className="boxmode-prev-best">
            <span className="prev-best-label">{t.boxModePrevBest}:</span>
            <span className="prev-best-value">
              {formatDuration(prev.fastestMs)} · {prev.fewestMistakes} {t.boxModeStatMistakes.toLowerCase()} · {prev.longestStreak} {t.boxModeStatStreak.toLowerCase()}
            </span>
          </div>
        )}

        <div className="boxmode-complete-buttons">
          <button className="btn" onClick={() => { setPhase('selecting'); setState(null); stateRef.current = null; }}>
            {t.boxModeAnotherSelection}
          </button>
          <button className="btn boxmode-restart-btn" onClick={() => {
            // Same scope, fresh session
            setState(null);
            stateRef.current = null;
            startSession();
          }}>
            {t.boxModeAgain}
          </button>
          <button className="btn boxmode-finish-btn" onClick={onBack}>
            {t.boxModeFinish}
          </button>
        </div>
      </div>
    );
  }

  // ─── Playing screen ────────────────────────────────────────────────
  // From here on, state must be present.
  if (!state || state.currentBookId == null) {
    return null; // transient state, shouldn't render
  }

  const counts = getBoxCounts(state);
  const recent = getRecentAnswers(state, 10);
  const targetBook = bibleBooks.find(b => b.id === state.currentBookId);
  if (!targetBook) return null;

  const otBooks = bibleBooks.filter(b => b.testament === 'OT');
  const ntBooks = bibleBooks.filter(b => b.testament === 'NT');
  const inSelectedScope = (book) => state.selectedBookIds.includes(book.id);

  const hintGroupName = groupNames[lang]?.[targetBook.group] || '';

  const renderBookCell = (book) => {
    const isInScope = inSelectedScope(book);
    const isTarget = book.id === state.currentBookId;
    const isCorrectReveal = book.id === correctBookId;
    const showCorrect = feedback === 'correct' && isTarget;
    const showWrong = feedback === 'wrong' && !isTarget && !isCorrectReveal;
    const inTopBox = state.bookBoxes[book.id] === TOP_BOX;
    const displayName = getBookDisplayName(book, displayMode, lang);

    const colors = groupColors[book.group] || groupColors.law;
    let bgColor = colors.normal;
    if (showCorrect) bgColor = '#3b82f6';
    else if (isCorrectReveal) bgColor = '#3b82f6';
    else if (feedback === 'wrong' && isTarget) bgColor = '#3b82f6';
    else if (showWrong) bgColor = '#f97316';

    return (
      <button
        key={book.id}
        className={`book-cell ${inTopBox ? 'boxmode-rooted' : ''}${!isInScope ? ' boxmode-out-of-scope' : ''}${showCorrect ? ' correct' : ''}${showWrong ? ' wrong' : ''}`}
        style={{ backgroundColor: bgColor }}
        data-book-id={book.id}
        aria-label={lang === 'nl' ? book.nl : book.en}
        onClick={() => isInScope && handleBookClick(book)}
        disabled={!isInScope || feedback === 'wrong' && book.id !== correctBookId}
      >
        <span className="book-name">{displayName}</span>
      </button>
    );
  };

  return (
    <div className="quiz-grid boxmode-playing">
      {/* Countdown bar — full-width strip at the very top. Lives OUTSIDE
          .quiz-top so it doesn't get caught up in the landscape
          flex-direction: row layout (which would compete with the back
          button and pill for horizontal space). Above the row in both
          orientations.
          Always rendered when tp is on (time pressure enabled) so the
          4px space stays reserved — the inner fill scales to 0 during
          feedback or after expiry, leaving the empty container in
          place. This prevents the book-grid from jumping up by 4px
          every time the bar appears/disappears. */}
      {tp && (
        <div
          className={`boxmode-timer-bar boxmode-timer-${tp.mode}`}
          role="progressbar"
          aria-label={t.boxModeTimePressureLabel || 'Time pressure'}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={(!feedback && timerStart != null) ? timerProgress : 0}
        >
          <div
            className="boxmode-timer-bar-fill"
            style={{
              // During feedback or before/after a timer cycle, fill
              // is at 0 (invisible). Container still occupies its 4px.
              transform: `scaleX(${(!feedback && timerStart != null) ? timerProgress : 0})`,
            }}
          />
        </div>
      )}

      <div className="quiz-top" ref={quizTopRef}>
        <div className="quiz-prompt-row" ref={promptRowRef}>
          <button className="back-btn" onClick={handleBack}>← {t.back}</button>
          <div className={`quiz-prompt ${
            feedback === 'correct' ? 'prompt-correct' :
            feedback === 'wrong'   ? 'prompt-wrong'   : ''
          }`}>
            {feedback === 'correct'
              ? <span className="prompt-book">✓ {t.correct}</span>
              : feedback === 'wrong'
              ? <span className="prompt-book">✗ {t.wrongShowCorrect || t.wrong}</span>
              : <span className="prompt-book">{lang === 'nl' ? targetBook.nl : targetBook.en}</span>
            }
          </div>
          {!feedback && (
            <button
              className="boxmode-hint-btn"
              onClick={handleHint}
              disabled={state.hintUsedOnCurrent || hintVisible}
              aria-label={t.hint}
            >
              💡
            </button>
          )}
        </div>

        {/* Box Mode pill */}
        <div className="trainahead-pill boxmode-pill" aria-live="polite">
          📦 {t.boxModeInProgress}
          {state.hintUsedOnCurrent && <span className="boxmode-hint-marker"> · 💡 {t.boxModeHintMarker}</span>}
          {state.slowOnCurrent && <span className="boxmode-slow-marker"> · ⏱ {t.boxModeTimePressureSlowMarker || 'too slow'}</span>}
        </div>

        {/* The 5-box display */}
        <BoxModeBoxes counts={counts} highlightedBox={highlightedBox} lang={lang} />

        {/* Recent-answers strip */}
        <BoxModeRecentDots recent={recent} slots={10} />

        {/* Hint reveal: same pattern as QuizGrid. Pinned to the bottom
            edge of the prompt row via the measured overlayTop (see the
            measure-effect above). Gated on overlayTop !== null so it
            doesn't briefly render at the wrong position on first mount. */}
        {hintVisible && overlayTop !== null && (
          <div
            className="topbar-overlay hint-overlay boxmode-hint-overlay"
            style={{ top: overlayTop }}
            onClick={() => setHintVisible(false)}
          >
            <div className="hint-color-dot" style={{ backgroundColor: groupColors[targetBook.group]?.normal }} />
            <span className="overlay-text">{t.hintReveal} <strong>{hintGroupName}</strong></span>
            <span className="boxmode-hint-cost">{t.boxModeHintCost}</span>
          </div>
        )}
      </div>

      <div
        className={`quiz-bottom${testamentsLayout === 'sideBySide' ? ' testaments-side-by-side' : ''}`}
        ref={scrollRef}
      >
        <div className="section" style={testamentsLayout === 'sideBySide' ? { flex: otColumns } : undefined}>
          <h3 className="section-title">{t.hebrewSection}</h3>
          <div
            className={`book-grid${displayMode === 'short' ? ' using-abbreviations' : ''}`}
            ref={gridRef}
            style={{ gridTemplateColumns: `repeat(${otColumns}, 1fr)` }}
          >
            {otBooks.map(renderBookCell)}
          </div>
        </div>

        <div className="section" style={testamentsLayout === 'sideBySide' ? { flex: ntColumns } : undefined}>
          <h3 className="section-title">{t.greekSection}</h3>
          <div
            className={`book-grid${displayMode === 'short' ? ' using-abbreviations' : ''}`}
            style={{ gridTemplateColumns: `repeat(${ntColumns}, 1fr)` }}
          >
            {ntBooks.map(renderBookCell)}
          </div>
        </div>
      </div>
    </div>
  );
}

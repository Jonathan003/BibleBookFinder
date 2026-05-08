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
  createInitialState, pickNextBookId, applyAnswer, markHintUsed, setCurrentBook,
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

// Wrong-answer overlay duration before the prompt clears. Same idea as
// QuizGrid's wrong-answer flow but compressed slightly — Box Mode doesn't
// have the "tap the correct book" requirement, so the user just reads
// the answer and moves on.
const WRONG_FEEDBACK_MS = 1500;

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
  useEffect(() => { stateRef.current = state; }, [state]);

  // UI feedback
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | null
  const [correctBookId, setCorrectBookId] = useState(null); // book to highlight on wrong answer
  const [highlightedBox, setHighlightedBox] = useState(null); // for destination-box glow
  const [hintVisible, setHintVisible] = useState(false);

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
    if (feedback === 'wrong') return; // mid-feedback: ignore taps until cleared

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
      setFeedback('wrong');
      setCorrectBookId(s.currentBookId);
      const next = applyAnswer(s, { bookId: s.currentBookId, correct: false });
      setState(next);
      stateRef.current = next;
      // After WRONG_FEEDBACK_MS, clear the highlight and move to next
      // book. Guard against stateRef going null (user pressed Back
      // during the feedback window).
      schedule(() => {
        if (!stateRef.current) return;
        setFeedback(null);
        setCorrectBookId(null);
        advanceToNextBook();
      }, WRONG_FEEDBACK_MS);
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
      <div className="quiz-top">
        <div className="quiz-prompt-row">
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
        </div>

        {/* The 5-box display */}
        <BoxModeBoxes counts={counts} highlightedBox={highlightedBox} lang={lang} />

        {/* Recent-answers strip */}
        <BoxModeRecentDots recent={recent} slots={10} />

        {/* Hint reveal: same pattern as QuizGrid */}
        {hintVisible && (
          <div className="topbar-overlay hint-overlay boxmode-hint-overlay" onClick={() => setHintVisible(false)}>
            <div className="hint-color-dot" style={{ backgroundColor: groupColors[targetBook.group]?.normal }} />
            <span className="overlay-text">{t.hintReveal} <strong>{hintGroupName}</strong></span>
            <span className="boxmode-hint-cost">{t.boxModeHintCost}</span>
          </div>
        )}
      </div>

      <div className={`quiz-bottom${testamentsLayout === 'sideBySide' ? ' testaments-side-by-side' : ''}`}>
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

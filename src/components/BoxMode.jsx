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

// v6.3: parseTimePressure() removed. The pre-6.3 config field
// boxMode.timePressure (an 'off' | 'soft-Xs' | 'hard-Xs' string) is
// gone; Box Mode now reads config.targetSpeedMs directly as ms. There
// is no 'off' option — the slider's upper bound (30s) effectively
// removes pressure for users who don't want it, without needing a
// special case in the timer code.

// v5: total number of canonical groups in the 'all' scope. If the
// user multi-selects all of them, we normalize to 'all' so personal-
// bests don't fragment into a redundant 9-group multi entry.
const TOTAL_GROUPS = 9;

/**
 * v5: compute the canonical scope key for storage / filtering from
 * a list of selected scope IDs. The list contains either ['all'] or
 * one+ 'group:xxx' entries.
 *
 * Outputs (canonical forms):
 *   - 'all'                     when the list is ['all'] or empty
 *   - 'group:law'               when the list is ['group:law']
 *   - 'multi:gospels+law'       when 2-8 groups are selected;
 *                               group IDs are sorted alphabetically
 *                               so the same combination always
 *                               produces the same key (for
 *                               personal-best comparison across
 *                               sessions).
 *   - 'all'                     when all 9 groups are selected
 *                               (normalized to avoid a redundant
 *                               multi entry).
 */
function computeScopeKey(selected) {
  if (!selected || selected.length === 0) return 'all';
  if (selected.length === 1) return selected[0];
  const groupIds = selected
    .filter(s => s.startsWith('group:'))
    .map(s => s.slice('group:'.length))
    .sort();
  if (groupIds.length === TOTAL_GROUPS) return 'all';
  if (groupIds.length === 1) return `group:${groupIds[0]}`;
  return `multi:${groupIds.join('+')}`;
}

/**
 * v5: human-readable display name for any canonical scope key.
 * Used by the playing-screen pill, the end-screen completion title,
 * and the selection-screen summary line. Single-line; the caller
 * can wrap or truncate as needed for its layout.
 *
 * Examples:
 *   'all'                       → 'All 66 books' (or NL equivalent)
 *   'group:law'                 → 'Pentateuch'
 *   'multi:gospels+law'         → 'Pentateuch · Gospels' (group order
 *                                 preserved from the canonical sort;
 *                                 separator is the middle dot).
 */
function scopeDisplayName(scopeKey, lang, t) {
  if (scopeKey === 'all') return t.boxModeScopeAll;
  if (scopeKey.startsWith('group:')) {
    const groupId = scopeKey.slice('group:'.length);
    return (groupNames[lang]?.[groupId] || groupNames.nl[groupId] || groupId)
      .split('—')[0].trim();
  }
  if (scopeKey.startsWith('multi:')) {
    const groupIds = scopeKey.slice('multi:'.length).split('+');
    return groupIds
      .map(id => (groupNames[lang]?.[id] || groupNames.nl[id] || id).split('—')[0].trim())
      .join(' · ');
  }
  return scopeKey;
}

export default function BoxMode({ ownerUserId, onBack, initialPausedSession = null, onPause }) {
  const { config, t, lang } = useAppConfig();
  const { otColumns, ntColumns, displayMode, testamentsLayout, gridRef } = useGridLayout();
  const schedule = useTimeoutManager();

  // Phase: 'selecting' | 'playing' | 'complete'
  const [phase, setPhase] = useState('selecting');

  // Selection state — v5: a list of selected scope IDs to support
  // multi-select. v5.1: every tap on a chip toggles it in/out
  // (filter-chip pattern). The scope KEY passed to createInitialState
  // / recordCompletion is derived via computeScopeKey when
  // transitioning to 'playing'.
  // - Default ['all'] (one element, the catch-all).
  // - List contains either ['all'] OR one+ 'group:xxx' entries (never
  //   mixed — 'all' is mutually exclusive with groups).
  // - If empty, we fall back to ['all'] in handlers.
  const [selectedScopes, setSelectedScopes] = useState(['all']);

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
  // v6.3: the timer is ALWAYS on in Box Mode now. The pre-6.3 'off' /
  // 'soft' / 'hard' selector is gone; the unified config.targetSpeedMs
  // setting drives both modes, and Box Mode always uses what used to
  // be the 'hard' expiry flow (auto-wrong with blue-cell tap to
  // acknowledge). Users who want minimal pressure set targetSpeedMs
  // near 30000ms.
  const [timerStart, setTimerStart] = useState(null);
  const [timerProgress, setTimerProgress] = useState(1);
  const [hintVisible, setHintVisible] = useState(false);

  // ─── Timer effects ────────────────────────────────────────────────
  // These have to be declared AFTER the useState calls they depend on
  // — dep arrays are evaluated during render, so referencing
  // `timerStart` in the dep array before it's been declared throws
  // a temporal-dead-zone error. (Lesson learned the hard way.)

  // v6.3: read the unified speed setting. Clamped defensively to the
  // slider's [2000, 30000] range in case a stale localStorage value
  // sneaks through unmigrated.
  const targetSpeedMs = Math.max(2000, Math.min(30000, config?.targetSpeedMs ?? 10000));

  // Effect 1: cleanup only. Clears timerStart when the session
  // leaves the playing phase (paused, ended, returned to home).
  //
  // v6.3.2: the "reset on each new currentBookId" path that used to
  // live here is gone — it caused a one-frame race where the new
  // currentBookId rendered with the OLD timerProgress value still in
  // state, producing a CSS-transition "fill-up" the moment the new
  // book appeared. The reset is now batched into advanceToNextBook
  // and the session-start function so the timer state is synchronized
  // with currentBookId in a single render. This effect's job is
  // narrower: just clear the timer on phase exit.
  const currentBookId = state?.currentBookId;
  useEffect(() => {
    if (phase !== 'playing' || currentBookId == null) {
      setTimerStart(null);
    }
  }, [currentBookId, phase]);

  // Effect 2: tick interval. Updates timerProgress every 100ms
  // and fires the expiry handler exactly once when the budget hits
  // zero. We use a sentinel ref to ensure the expiry callback runs at
  // most once per question, even if the interval ticks just before the
  // setTimerStart(null) cleanup races.
  const expiryFiredRef = useRef(false);
  useEffect(() => {
    if (timerStart == null) return;
    expiryFiredRef.current = false;

    const interval = setInterval(() => {
      const elapsed = Date.now() - timerStart;
      const remaining = Math.max(0, targetSpeedMs - elapsed);
      setTimerProgress(remaining / targetSpeedMs);

      if (remaining <= 0 && !expiryFiredRef.current) {
        expiryFiredRef.current = true;
        clearInterval(interval);
        // Don't fire if user already answered (state changed) or is mid-
        // feedback (correct/wrong/time-up flash already in progress).
        const s = stateRef.current;
        if (!s || s.currentBookId == null) return;
        if (feedback) return;

        // v6.3: always the auto-wrong flow (the pre-6.3 'hard' branch).
        // We tag the feedback as 'time-up' rather than 'wrong' so the
        // UI can show an honest "Time's up!" message + amber tint
        // instead of the misleading "Wrong" label — the user didn't
        // click incorrectly, they just ran out of time. The blue-cell-
        // tap acknowledgment flow is identical to a wrong tap.
        setFeedback('time-up');
        setCorrectBookId(s.currentBookId);
        const next = applyAnswer(s, { bookId: s.currentBookId, correct: false });
        setState(next);
        stateRef.current = next;
      }
    }, 100);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStart, targetSpeedMs, feedback]);

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

  // ─── v4 resume on mount ────────────────────────────────────────────
  // If the user tapped "Resume" on the home screen, initialPausedSession
  // holds the snapshot we wrote on the previous Back. Skip the scope
  // picker and jump straight back into playing with the saved game
  // state. Per-question timer (timerStart) is NOT restored — it
  // re-anchors on the next currentBookId pick effect.
  // v5: the pause snapshot stores the canonical `scope` string (e.g.
  // 'multi:gospels+law'). We don't strictly need to populate
  // selectedScopes here — the user is going straight to 'playing' and
  // selectedScopes only matters in the scope-picker UI — but doing it
  // anyway means that if the user backs out of the resumed session via
  // "Another selection" on the end screen, they'll see their previous
  // multi-selection still highlighted in the picker, which is the
  // less-surprising behavior.
  useEffect(() => {
    if (!initialPausedSession) return;
    const s = initialPausedSession;
    if (s.scope) {
      if (s.scope === 'all' || s.scope.startsWith('group:')) {
        setSelectedScopes([s.scope]);
      } else if (s.scope.startsWith('multi:')) {
        const groupIds = s.scope.slice('multi:'.length).split('+');
        setSelectedScopes(groupIds.map(id => `group:${id}`));
      }
    }
    if (s.state) {
      setState(s.state);
      stateRef.current = s.state;
    }
    setPhase('playing');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Selection screen actions ──────────────────────────────────────

  const startSession = useCallback(() => {
    const failMode = config.boxMode?.failMode || 'soft';
    // v5: derive canonical scope key from the selectedScopes list.
    // Empty / all-9 normalize to 'all'; single entry stays as-is;
    // 2-8 groups become 'multi:groupId1+...' (sorted).
    const scope = computeScopeKey(selectedScopes);
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
    // v6.3.2: see advanceToNextBook above for the rationale — set
    // timer state in the same batch as currentBookId so the bar
    // renders at full from the first frame.
    setTimerStart(Date.now());
    setTimerProgress(1);
    setPhase('playing');
  }, [config.boxMode?.failMode, selectedScopes]);

  // ─── Quiz loop actions ─────────────────────────────────────────────

  const handleBookClick = useCallback((book) => {
    const s = stateRef.current;
    if (!s || s.currentBookId == null) return;
    // Wrong-answer flow uses tap-to-continue (mirrors QuizGrid's
    // pattern, agreed upon as pedagogically stronger than auto-advance).
    // While in 'wrong' or 'time-up' feedback state, the only meaningful
    // action is tapping the highlighted correct book to acknowledge it
    // and move on. Taps elsewhere are ignored — no new answer is
    // applied, since one was already applied at the moment of the
    // wrong tap (or the timer's expiry, for time-up).
    //
    // v6.3: 'time-up' is the new feedback state for Box Mode timer
    // expiry — same blue-cell-tap flow as 'wrong', just different
    // labeling and tint to be honest about the cause.
    // ADR 0007: both feedback states use the identical click-to-advance
    // path. No minimum read window — only the prompt text differs.
    if (feedback === 'wrong' || feedback === 'time-up') {
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
    // v6.3.2: batch the timer reset into the same render as the book
    // change so the bar appears at full ON THE FIRST FRAME the new
    // book is visible. Previously the timer-reset lived in a useEffect
    // that fires AFTER the render commit — meaning Render N would show
    // the new book with the OLD timerProgress value (often 0.0 if the
    // previous question had expired), and Render N+1 would then
    // transition the bar from that old value to 1.0 over 100ms,
    // producing a visible "fill-up" animation that contradicted what
    // the timer is actually doing. Setting these in the same batch
    // means React renders ONCE with currentBookId=new AND
    // timerStart=now AND timerProgress=1.
    setTimerStart(Date.now());
    setTimerProgress(1);
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
    // Box session completed naturally — clear any paused checkpoint so
    // the user doesn't see a stale Resume CTA after the finish screen.
    if (onPause) onPause(null);
  }, [ownerUserId, onPause]);

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
      // v4: Back during a session is a pause, not a bail. Snapshot the
      // full game state to onPause; App.jsx persists it onto the user
      // as `pausedBoxSession`, and the home screen offers a Resume CTA
      // that re-mounts BoxMode with the snapshot, jumping straight
      // back into the same in-progress session. Pre-v4 behaviour
      // (silently reset to the scope picker, losing all session
      // progress) was a long-standing complaint — same surface fix as
      // for Quiz Mode.
      // v5: scope on the snapshot is taken from the running state
      // (state.scope is the canonical key set by createInitialState)
      // rather than from selectedScopes — `state.scope` is the source
      // of truth during a running session and may differ from the
      // current selectedScopes if the user has clicked around in the
      // picker after pausing (not currently reachable from the UI
      // since pausing goes back to the home screen, but safer to
      // mirror the in-game scope verbatim).
      if (onPause && stateRef.current) {
        onPause({
          scope: stateRef.current.scope,
          state: stateRef.current,
          pausedAt: Date.now(),
        });
      }
      setPhase('selecting');
      setState(null);
      stateRef.current = null;
      onBack();
    } else {
      onBack();
    }
  }, [phase, onBack, onPause]);

  // Cleanup is handled implicitly by useTimeoutManager on unmount.

  // ─── v5.1: filter-chip scope picker handler ───────────────────────
  // Every tap on a scope chip toggles. No timing-based gestures
  // (long-press was removed in v5.1 — see CHANGES.md). The toggle
  // logic:
  //
  // - Tap 'All 66 books' → replace selection with just ['all'].
  //   ('all' is the catch-all reset; mutually exclusive with groups.)
  // - Tap a group while 'all' is selected → drop 'all', select just
  //   that group. Starts a fresh multi-selection.
  // - Tap a group while other groups are selected →
  //     - already in selection: remove it (toggle off)
  //     - not in selection: add it
  //     - removing leaves empty: fall back to ['all']
  //     - adding reaches all 9: collapse to ['all'] (canonical form)
  //
  // Result: every interaction is one tap. Works identically on
  // touch, mouse, and keyboard. No discoverability text needed —
  // the chip's selected/unselected visual state communicates the
  // toggle. A summary line below the picker appears once the
  // selection has 2+ chips active.

  const handleScopeTap = useCallback((scopeId) => {
    if (scopeId === 'all') {
      setSelectedScopes(['all']);
      return;
    }
    setSelectedScopes(prev => {
      let next = prev.filter(s => s !== 'all');
      if (next.includes(scopeId)) {
        next = next.filter(s => s !== scopeId);
      } else {
        next = [...next, scopeId];
      }
      if (next.length === 0) return ['all'];
      if (next.length === TOTAL_GROUPS) return ['all'];
      return next;
    });
  }, []);

  // ─── Selection screen ──────────────────────────────────────────────

  if (phase === 'selecting') {
    const scopeKeyPreview = computeScopeKey(selectedScopes);
    const selectionLabel = scopeDisplayName(scopeKeyPreview, lang, t);
    const selectionBookCount = scopeKeyPreview === 'all'
      ? 66
      : (scopeKeyPreview.startsWith('group:')
          ? bibleBooks.filter(b => b.group === scopeKeyPreview.slice('group:'.length)).length
          : (() => {
              const groupIds = scopeKeyPreview.slice('multi:'.length).split('+');
              const set = new Set(groupIds);
              return bibleBooks.filter(b => set.has(b.group)).length;
            })());
    return (
      <div className="boxmode-screen boxmode-selecting">
        <div className="boxmode-header">
          <button className="back-btn" onClick={onBack}>← {t.back}</button>
          <h2>{t.boxModeTitle}</h2>
        </div>

        <p className="boxmode-intro">{t.boxModeIntro}</p>

        <div className="boxmode-scope-options">
          <button
            className={`boxmode-scope-option ${selectedScopes.includes('all') ? 'selected' : ''}`}
            onClick={() => handleScopeTap('all')}
          >
            <span className="scope-label">{t.boxModeScopeAll}</span>
            <span className="scope-count">66</span>
          </button>
          {Object.keys(groupNames[lang] || groupNames.nl).map(groupId => {
            const count = bibleBooks.filter(b => b.group === groupId).length;
            const groupLabel = (groupNames[lang]?.[groupId] || groupNames.nl[groupId] || '').split('—')[0].trim();
            const id = `group:${groupId}`;
            const isSelected = selectedScopes.includes(id);
            return (
              <button
                key={id}
                className={`boxmode-scope-option ${isSelected ? 'selected' : ''}`}
                onClick={() => handleScopeTap(id)}
              >
                <span className="scope-label">{groupLabel}</span>
                <span className="scope-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* v5.1: selection summary appears only when multi-scope is
            active (2+ chips selected). For single-scope sessions the
            chip's selected highlight is sufficient — no extra text
            below the picker. Removes the v5 "long-press" hint that's
            no longer relevant. */}
        {selectedScopes.length > 1 && (
          <p className="boxmode-multi-hint">
            <strong>{selectionLabel} — {selectionBookCount} {selectionBookCount === 1 ? (t.book || 'book') : (t.books || 'books')}</strong>
          </p>
        )}

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
    // v5: use the scopeDisplayName helper so multi-scope keys
    // (`multi:gospels+law`) get a readable label ("Pentateuch · Gospels")
    // instead of crashing the split('—') path. The helper handles all
    // three canonical forms.
    const scopeLabel = scopeDisplayName(state.scope, lang, t);
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
            <span>
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
    // v6.3 (revised): 'time-up' is a distinct feedback STATE (different
    // label, different cause) but the visual treatment of the revealed
    // cell is identical to every other "here's where the book actually
    // is" cue in the app — solid blue (#3B82F6). Three reasons for
    // dropping the earlier amber treatment:
    //   1. The prompt literally says "look for the blue cell"; an
    //      amber cell makes the message contradict itself.
    //   2. Uniformity between Quiz Mode and Box Mode: both modes show
    //      the same blue reveal on a wrong answer, time-up should
    //      match. Adding a third color for one edge case is noise.
    //   3. Amber (#F59E0B) and orange (#F97316) are exactly the pair
    //      that deutan colorblindness fuses, so encoding "time-up"
    //      via amber cell color would fail for the primary user.
    // The semantic distinction is carried entirely by the label text
    // ("Time's up — look for the blue cell!" vs "Wrong"). No cell-
    // level animation either — same uniformity argument.
    const inTopBox = state.bookBoxes[book.id] === TOP_BOX;
    const displayName = getBookDisplayName(book, displayMode, lang);

    const colors = groupColors[book.group] || groupColors.law;
    let bgColor = colors.normal;
    if (showCorrect) bgColor = '#3b82f6';
    else if (isCorrectReveal) bgColor = '#3b82f6';
    else if (showWrong) bgColor = '#f97316';

    // v6.3: 'time-up' shares wrong's tap-the-blue-cell flow, so the
    // disabled-rule mirrors it: only the correct (revealed) cell is
    // tappable while either feedback is active.
    const inAcknowledgeMode = feedback === 'wrong' || feedback === 'time-up';

    return (
      <button
        key={book.id}
        className={`book-cell ${inTopBox && config.display.highlightTopBox !== false ? 'boxmode-rooted' : ''}${showCorrect ? ' correct' : ''}${showWrong ? ' wrong' : ''}`}
        style={{ backgroundColor: bgColor }}
        data-book-id={book.id}
        aria-label={lang === 'nl' ? book.nl : book.en}
        onClick={() => isInScope && handleBookClick(book)}
        disabled={inAcknowledgeMode && book.id !== correctBookId}
        aria-disabled={!isInScope || (inAcknowledgeMode && book.id !== correctBookId)}
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
          Always rendered (v6.3: was conditionally rendered on tp; the
          timer is now always on in Box Mode). The 4px space stays
          reserved — the inner fill scales to 0 during feedback or
          after expiry, leaving the empty container in place. This
          prevents the book-grid from jumping up by 4px every time the
          bar appears/disappears. */}
      <div
        className="boxmode-timer-bar"
        role="progressbar"
        aria-label={t.boxModeTimePressureLabel || 'Time pressure'}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={(!feedback && timerStart != null) ? timerProgress : 0}
      >
        <div
          key={timerStart || 'idle'}
          className="boxmode-timer-bar-fill"
          style={{
            // During feedback or before/after a timer cycle, fill
            // is at 0 (invisible). Container still occupies its 4px.
            transform: `scaleX(${(!feedback && timerStart != null) ? timerProgress : 0})`,
          }}
        />
      </div>

      <div className="quiz-top" ref={quizTopRef}>
        <div className="quiz-prompt-row" ref={promptRowRef}>
          <button className="back-btn" onClick={handleBack}>← {t.back}</button>
          <div className={`quiz-prompt ${
            feedback === 'correct' ? 'prompt-correct' :
            (feedback === 'wrong' || feedback === 'time-up') ? 'prompt-wrong' : ''
          }`}>
            {feedback === 'correct'
              ? <span className="prompt-book">✓ {t.correct}</span>
              : feedback === 'time-up'
              ? <span className="prompt-book">⏱ {t.boxModeTimeUp || "Time's up — look for the blue cell!"}</span>
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

        {/* Box Mode pill — v5: surfaces the active scope summary in
            place of the generic "Box Mode in progress" text. For
            single-scope sessions this is "📦 Pentateuch" / "📦 All 66
            books"; for multi-scope sessions it becomes
            "📦 Pentateuch · Gospels". Keeps the user oriented when
            mid-session and useful as a sanity check for multi-scope
            selections (especially before the picker UX is fully
            muscle-memorized).

            v6.3: the "too slow" marker that used to appear here when
            the soft timer expired is gone — soft timer mode itself is
            gone. Hint marker stays. */}
        <div className="trainahead-pill boxmode-pill" aria-live="polite">
          📦 {scopeDisplayName(state.scope, lang, t)}
          {state.hintUsedOnCurrent && <span className="boxmode-hint-marker"> · 💡 {t.boxModeHintMarker}</span>}
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

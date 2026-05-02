import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { bibleBooks, groupColors, groupNames, getBookDisplayName } from '../data';
import { useAppConfig } from '../App';
import { useGridLayout } from '../useGridLayout';
import { useTimeoutManager } from '../useTimeoutManager';
import {
  createScheduler, createBookCard, ratingFromSpeed,
  reviewBook, getDueBooks, serializeCard, deserializeCard,
  Rating, getBookStats, isMastered
} from '../fsrs';
import { formatDuration } from '../timeFormat';
import './QuizGrid.css';

// Per-question cap for the cumulative training-time counter. If the user
// takes longer than this on a single question (typically because they
// walked away, locked their phone, or got distracted by a notification),
// only this many milliseconds count toward totalQuizMs for that question.
//
// Why 30s? The default masteryMs is 10s, so 30s = 3× mastery. Genuine
// hard-thinking on a difficult book rarely exceeds this; longer is almost
// always idle time. This is the same idea as Anki's "Maximum answer
// seconds" setting (default 60s in Anki). We use 30s because mastery in
// this app is faster — book identification is simpler than recalling a
// flashcard answer.
//
// The cap protects the share-message claim ("X books mastered in Y time")
// from being inflated by AFK moments. Without it, a single sleeping-with-
// the-app-open incident could add hours of fake training time.
const MAX_ANSWER_MS = 30000;

export default function QuizGrid({ ownerUserId, fsrsCards, updateFsrsCard, bestTimes, updateBestTime, bestStreak, setBestStreak, addQuizSession, addTrainingTime, totalQuizMs = 0, onBack, onPhaseChange }) {
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
  const [correctBookId, setCorrectBookId] = useState(null);
  const [sessionNewBests, setSessionNewBests] = useState(0);
  const [sessionStartTime] = useState(() => Date.now());
  const [showSummary, setShowSummary] = useState(false);
  const [milestone, setMilestone] = useState(null); // message string | null
  const [showNewBest, setShowNewBest] = useState(false);
  
  const feedbackRef = useRef(false);
  const scrollRef = useRef(null);
  const fsrsCardsRef = useRef(fsrsCards);
  const promptRowRef = useRef(null);
  const quizTopRef = useRef(null);
  const [overlayTop, setOverlayTop] = useState(null);
  useEffect(() => { fsrsCardsRef.current = fsrsCards; }, [fsrsCards]);

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
    masteredIds: sessionMasteredBooks,
    hintedIds: sessionHintedBooks,
    wrongIds: sessionWrongBooks,
  };
  useEffect(() => () => {
    const { saved, snapshot } = sessionDataRef.current;
    if (saved || !snapshot || snapshot.total <= 0) return;
    const avgTime = snapshot.responseTimes.length > 0
      ? Math.round(snapshot.responseTimes.reduce((a, b) => a + b, 0) / snapshot.responseTimes.length)
      : 0;
    addQuizSession(ownerUserIdRef.current, {
      correct: snapshot.correct,
      total: snapshot.total,
      avgTime,
      masteredBookIds: [...snapshot.masteredIds],
      hintedBookIds: [...snapshot.hintedIds],
      wrongBookIds: [...snapshot.wrongIds],
    });
  }, [addQuizSession]);

  // Report phase upward so App's header knows whether to show focus-mode
  // (quiz actively playing) or full nav (summary/pause state).
  useEffect(() => {
    if (onPhaseChange) onPhaseChange(showSummary ? 'paused' : 'playing');
  }, [showSummary, onPhaseChange]);

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

  // FSRS-driven book selection
  const pickNextBook = useCallback(() => {
    feedbackRef.current = false;
    const cards = fsrsCardsRef.current || {};
    const { dueBooks, unseenBooks } = getDueBooks(cards, bibleBooks);

    let selected;
    if (dueBooks.length > 0) {
      // Mix: 80% due books, 20% unseen (if available)
      if (unseenBooks.length > 0 && Math.random() < 0.2) {
        selected = unseenBooks[Math.floor(Math.random() * unseenBooks.length)];
      } else {
        // Pool top-8 most-overdue books for variety, then weight non-mastered
        // books 3× heavier than mastered ones. Rationale:
        //
        // FSRS schedules each book independently based on its own stability.
        // Once you have many mastered books, they all come due regularly for
        // maintenance reviews. A user trying to master their LAST few non-
        // mastered books would find them buried by all the mastered-due ones
        // — even when their non-mastered book IS due, it's outranked by 5+
        // more-overdue mastered books in the top-5 pool.
        //
        // The 3× weight nudges selection toward non-mastered due books
        // WITHOUT breaking FSRS spacing: only books whose due-date already
        // arrived are eligible. So a non-mastered book never gets MORE
        // reviews than FSRS scheduled — it just gets PICKED sooner from
        // the pool when both options exist.
        //
        // Mastery itself remains earned: the same 3-rep / stability>7
        // requirements apply. The boost only changes ordering, not the
        // criteria. This keeps the share message ("X mastered in Y time")
        // a legitimate achievement.
        const pool = dueBooks.slice(0, Math.min(8, dueBooks.length));
        const weighted = [];
        for (const book of pool) {
          const weight = isMastered(cards[book.id]) ? 1 : 3;
          for (let i = 0; i < weight; i++) weighted.push(book);
        }
        selected = weighted[Math.floor(Math.random() * weighted.length)];
      }
    } else if (unseenBooks.length > 0) {
      selected = unseenBooks[Math.floor(Math.random() * unseenBooks.length)];
    } else {
      // All books reviewed and none due — pick random for practice
      selected = bibleBooks[Math.floor(Math.random() * bibleBooks.length)];
    }

    setTargetBook(selected);
    setStartTime(Date.now());
    setResponseTime(null);
    setFeedback(null);
    setHintVisible(false);
    // In sideBySide layout both testaments are visible at once on tablets
    // and desktop landscape, so OT-top / NT-bottom auto-scroll would cause
    // a confusing jump with no benefit. Skip it. (On phones in landscape
    // some rows may need manual scrolling, but auto-scroll-to-top-or-bottom
    // there is still wrong since both halves are partially visible.)
    if (config.quiz.autoScroll !== false && testamentsLayout !== 'sideBySide') {
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
  }, [config.quiz.autoScroll, testamentsLayout]);

  useEffect(() => {
    pickNextBook();
    window.scrollTo(0, 0);
  }, [pickNextBook]);

  const finishSession = useCallback(() => {
    // Mark as saved before triggering onBack so the unmount cleanup
    // doesn't write a duplicate entry to quizHistory.
    sessionDataRef.current.saved = true;
    if (score.total > 0) {
      const avgTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;
      addQuizSession(ownerUserIdRef.current, {
        correct: score.correct,
        total: score.total,
        avgTime,
        masteredBookIds: [...sessionMasteredBooks],
        hintedBookIds: [...sessionHintedBooks],
        wrongBookIds: [...sessionWrongBooks],
      });
    }
    onBack();
  }, [score, responseTimes, addQuizSession, onBack, sessionMasteredBooks, sessionHintedBooks, sessionWrongBooks]);

  const handleBack = useCallback(() => {
    if (score.total > 0) {
      setShowSummary(true);
    } else {
      onBack();
    }
  }, [score.total, onBack]);

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
      setResponseTime(timeTaken);
      setResponseTimes(prev => [...prev, timeTaken]);

      // Cumulative training time: cap per-question at MAX_ANSWER_MS so
      // AFK moments don't inflate the share-message claim. See constant
      // definition for rationale.
      if (addTrainingTime) {
        addTrainingTime(Math.min(timeTaken, MAX_ANSWER_MS));
      }

      const isWithinTime = timeTaken <= config.quiz.masteryMs;
      const rating = ratingFromSpeed(timeTaken, config.quiz.masteryMs);
      setFeedback(isWithinTime ? 'correct' : 'slow');

      // Update FSRS card
      const currentCard = fsrsCards[targetBook.id]
        ? deserializeCard(fsrsCards[targetBook.id])
        : createBookCard();
      const result = reviewBook(scheduler, currentCard, rating);
      updateFsrsCard(targetBook.id, serializeCard(result.card));

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
            setMilestone(msg);
            schedule(() => setMilestone(null), 3000);
          }
        }
      } else {
        setStreak(0);
      }

      schedule(() => pickNextBook(), 800);
      return;
    }

    // Wrong click — rate as Again
    feedbackRef.current = true;
    setFeedback('wrong');
    setCorrectBookId(targetBook.id);

    // Track time spent on this question for the cumulative training
    // counter. Wrong answers get the same per-question cap as correct
    // ones — what matters for "time spent training" is engagement, not
    // outcome. See MAX_ANSWER_MS for rationale.
    const timeTaken = Date.now() - startTime;
    if (addTrainingTime) {
      addTrainingTime(Math.min(timeTaken, MAX_ANSWER_MS));
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

    // Wait for user to click the correct (blue) book to advance
  };

  const handleHint = () => {
    if (!targetBook) return;
    if (!hintVisible) {
      setSessionHintedBooks(prev => new Set(prev).add(targetBook.id));
    }
    setHintVisible(prev => !prev);
  };

  const formatTime = (ms) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

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

  if (!targetBook) return null;

  // Session summary screen
  if (showSummary) {
    const durationMin = Math.max(1, Math.round((Date.now() - sessionStartTime) / 60000));
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
              ? <span className="prompt-book">⚡ {t.newBest} {formatTime(responseTime)}</span>
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
            <span className="stat-value">{stats.dueNow}</span>
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
      </div>

      {milestone && (
        <div className="milestone-banner">{milestone}</div>
      )}

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

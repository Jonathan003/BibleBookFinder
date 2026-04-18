import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { bibleBooks, groupColors, groupNames } from '../data';
import { useAppConfig } from '../App';
import { useGridLayout } from '../useGridLayout';
import {
  createScheduler, createBookCard, ratingFromSpeed,
  reviewBook, getDueBooks, serializeCard, deserializeCard,
  Rating, getBookStats, isMastered
} from '../fsrs';
import './QuizGrid.css';

export default function QuizGrid({ fsrsCards, updateFsrsCard, bestTimes, updateBestTime, bestStreak, setBestStreak, addQuizSession, onBack, onSettings }) {
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
  const [revealBookId, setRevealBookId] = useState(null);
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

  const { orientation, activeColumns, useAbbreviations, gridRef } = useGridLayout();

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
        // Pick from top 5 most overdue to add some variety
        const pool = dueBooks.slice(0, Math.min(5, dueBooks.length));
        selected = pool[Math.floor(Math.random() * pool.length)];
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
    if (config.quiz.autoScroll !== false) {
      // Scroll after DOM updates and new book name is visible
      // OT book: scroll to top, NT book: scroll to bottom
      setTimeout(() => {
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
  }, [config.quiz.autoScroll]);

  useEffect(() => {
    pickNextBook();
    window.scrollTo(0, 0);
  }, [pickNextBook]);

  const finishSession = useCallback(() => {
    if (score.total > 0) {
      const avgTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;
      addQuizSession({
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
      setRevealBookId(null);
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
        setSessionMasteredBooks(prev => new Set(prev).add(book.id));

        // Personal best check
        const prevBest = bestTimes[targetBook.id];
        if (!prevBest || timeTaken < prevBest) {
          updateBestTime(targetBook.id, timeTaken);
          setSessionNewBests(prev => prev + 1);
          setShowNewBest(true);
          setTimeout(() => setShowNewBest(false), 1500);
        }

        // Milestone check — did this book newly cross the mastered threshold?
        const wasAlreadyMastered = isMastered(fsrsCards[targetBook.id]);
        const isNowMastered = isMastered(serializeCard(result.card));
        if (!wasAlreadyMastered && isNowMastered) {
          const newCount = stats.mastered + 1;
          const updatedFsrsCards = { ...fsrsCards, [targetBook.id]: serializeCard(result.card) };
          const otBookIds = bibleBooks.filter(b => b.testament === 'OT').map(b => b.id);
          const ntBookIds = bibleBooks.filter(b => b.testament === 'NT').map(b => b.id);
          const allOTMastered = otBookIds.every(id => isMastered(updatedFsrsCards[id]));
          const allNTMastered = ntBookIds.every(id => isMastered(updatedFsrsCards[id]));
          const all66Mastered = newCount === 66;

          // Priority: 66 > OT/NT scripture milestones > count milestones
          let msg = null;
          if (all66Mastered) {
            msg = t.milestone66;
          } else if (allOTMastered) {
            msg = t.milestone39;
          } else if (allNTMastered) {
            msg = t.milestoneNT;
          } else {
            const countMilestones = { 10: t.milestone10, 20: t.milestone20, 33: t.milestone33, 50: t.milestone50 };
            msg = countMilestones[newCount] || null;
          }

          if (msg) {
            setMilestone(msg);
            setTimeout(() => setMilestone(null), 3000);
          }
        }
      } else {
        setStreak(0);
      }

      setTimeout(() => pickNextBook(), 800);
      return;
    }

    // Wrong click — rate as Again
    feedbackRef.current = true;
    setFeedback('wrong');
    setCorrectBookId(targetBook.id);
    setTimeout(() => {
      document.querySelector(`[data-book-id="${targetBook.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    setTimeout(() => setRevealBookId(targetBook.id), 650);
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
    const displayName = useAbbreviations
      ? (lang === 'nl' ? book.nlAbbr : book.enAbbr)
      : (lang === 'nl' ? book.nl : book.en);

    const colors = groupColors[book.group] || groupColors.law;
    let bgColor = colors.normal;
    if (showCorrect && feedback === 'correct') bgColor = '#3b82f6';
    else if (showCorrect && feedback === 'slow') bgColor = '#f59e0b';
    else if (isCorrectReveal) bgColor = '#3b82f6';
    else if (feedback === 'wrong' && isTarget) bgColor = '#ef4444';
    else if (showWrong) bgColor = '#f97316';

    const showMasteryLine = config.display.highlightFound && bookIsMastered;

    return (
      <button
        key={book.id}
        className={`book-cell ${showMasteryLine ? 'mastered' : ''} ${showCorrect && feedback === 'correct' ? 'correct' : ''} ${book.id === revealBookId ? 'reveal' : ''} ${showCorrect && feedback === 'slow' ? 'slow' : ''} ${showWrong ? 'wrong' : ''}`}
        style={{ backgroundColor: bgColor }}
        data-book-id={book.id}
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
        </div>
        <div className="summary-buttons">
          <button className="btn" onClick={() => { setShowSummary(false); setStartTime(Date.now()); }}>
            {t.keepGoing}
          </button>
          {onSettings && (
            <button className="btn settings-summary-btn" onClick={onSettings}>
              ⚙️ {t.settingsTitle || 'Settings'}
            </button>
          )}
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

      <div className="quiz-bottom" ref={scrollRef}>
        <div className="section">
          <h3 className="section-title">{t.hebrewSection}</h3>
          <div className="book-grid" ref={gridRef} style={{ gridTemplateColumns: `repeat(${activeColumns}, 1fr)` }}>
            {otBooks.map(renderBookCell)}
          </div>
        </div>

        <div className="section">
          <h3 className="section-title">{t.greekSection}</h3>
          <div className="book-grid" style={{ gridTemplateColumns: `repeat(${activeColumns}, 1fr)` }}>
            {ntBooks.map(renderBookCell)}
          </div>
        </div>
      </div>
    </div>
  );
}

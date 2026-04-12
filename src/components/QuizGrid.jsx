import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { bibleBooks, groupColors, groupNames } from '../data';
import { useAppConfig } from '../App';
import {
  createScheduler, createBookCard, ratingFromSpeed,
  reviewBook, getDueBooks, serializeCard, deserializeCard,
  Rating, getBookStats
} from '../fsrs';
import './QuizGrid.css';

export default function QuizGrid({ fsrsCards, updateFsrsCard, bestTimes, updateBestTime, bestStreak, setBestStreak, addQuizSession, onBack }) {
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
  const [sessionNewBests, setSessionNewBests] = useState(0);
  const [sessionStartTime] = useState(() => Date.now());
  const [showSummary, setShowSummary] = useState(false);
  const [milestone, setMilestone] = useState(null); // message string | null
  const [showNewBest, setShowNewBest] = useState(false);
  
  const feedbackRef = useRef(false);
  const scrollRef = useRef(null);
  const fsrsCardsRef = useRef(fsrsCards);
  useEffect(() => { fsrsCardsRef.current = fsrsCards; }, [fsrsCards]);

  // FSRS scheduler based on learning pace
  const scheduler = useMemo(() => {
    return createScheduler(config.quiz.learningPace || 'balanced');
  }, [config.quiz.learningPace]);

  // Reactive orientation
  const [isLandscape, setIsLandscape] = useState(
    () => window.matchMedia('(orientation: landscape)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const handler = (e) => setIsLandscape(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  let orientation = config.grid.orientation;
  if (orientation === 'auto') {
    orientation = isLandscape ? 'landscape' : 'portrait';
  }
  const activeColumns = orientation === 'landscape' ? config.grid.landscape : config.grid.portrait;

  // Smart abbreviation detection
  const gridRef = useRef(null);
  const [autoAbbr, setAutoAbbr] = useState(false);
  const abbrMode = config.display.abbreviations || 'auto';

  const longestNameLength = useMemo(() => {
    return bibleBooks.reduce((max, book) => {
      const name = lang === 'nl' ? book.nl : book.en;
      return Math.max(max, name.length);
    }, 0);
  }, [lang]);

  useEffect(() => {
    if (abbrMode !== 'auto') return;
    const checkFit = () => {
      const el = gridRef.current;
      if (!el) return;
      const cellWidth = el.offsetWidth / activeColumns;
      const maxChars = Math.floor((cellWidth - 20) / 7.5);
      setAutoAbbr(longestNameLength > maxChars);
    };
    const timer = setTimeout(checkFit, 50);
    window.addEventListener('resize', checkFit);
    return () => { clearTimeout(timer); window.removeEventListener('resize', checkFit); };
  }, [abbrMode, activeColumns, longestNameLength]);

  const useAbbreviations = orientation === 'landscape' ? false : abbrMode === 'always' ? true : abbrMode === 'never' ? false : autoAbbr;

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
    scrollRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, []);

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
    if (!targetBook || feedbackRef.current) return;

    if (book.id === targetBook.id) {
      feedbackRef.current = true;
      setHintVisible(false);
      const timeTaken = Date.now() - startTime;
      setResponseTime(timeTaken);
      setResponseTimes(prev => [...prev, timeTaken]);

      const isMastered = timeTaken <= config.quiz.masteryMs;
      const rating = ratingFromSpeed(timeTaken, config.quiz.masteryMs);
      setFeedback(isMastered ? 'correct' : 'slow');

      // Update FSRS card
      const currentCard = fsrsCards[targetBook.id]
        ? deserializeCard(fsrsCards[targetBook.id])
        : createBookCard();
      const result = reviewBook(scheduler, currentCard, rating);
      updateFsrsCard(targetBook.id, serializeCard(result.card));

      // Score only counts if within time limit
      setScore(prev => ({
        correct: isMastered ? prev.correct + 1 : prev.correct,
        total: prev.total + 1
      }));

      if (isMastered) {
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
        const wasAlreadyMastered = fsrsCards[targetBook.id]?.stability > 7;
        const isNowMastered = result.card.stability > 7;
        if (!wasAlreadyMastered && isNowMastered) {
          const newCount = stats.mastered + 1;
          const milestoneMessages = {
            10: t.milestone10,
            20: t.milestone20,
            33: t.milestone33,
            39: t.milestone39,
            50: t.milestone50,
            66: t.milestone66,
          };
          const msg = milestoneMessages[newCount];
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
    setSessionWrongBooks(prev => new Set(prev).add(targetBook.id));
    setScore(prev => ({ ...prev, total: prev.total + 1 }));
    setStreak(0);

    // Update FSRS card for wrong answer
    const currentCard = fsrsCards[targetBook.id]
      ? deserializeCard(fsrsCards[targetBook.id])
      : createBookCard();
    const result = reviewBook(scheduler, currentCard, Rating.Again);
    updateFsrsCard(targetBook.id, serializeCard(result.card));

    setTimeout(() => {
      feedbackRef.current = false;
      setFeedback(null);
      setResponseTime(null);
    }, 600);
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

  const BookCell = ({ book }) => {
    const cardData = fsrsCards[book.id];
    const isMastered = cardData && cardData.stability > 7;
    const isTarget = book.id === targetBook?.id;
    const showCorrect = (feedback === 'correct' || feedback === 'slow') && isTarget;
    const showWrong = feedback === 'wrong' && !isTarget;
    const displayName = useAbbreviations
      ? (lang === 'nl' ? book.nlAbbr : book.enAbbr)
      : (lang === 'nl' ? book.nl : book.en);

    const colors = groupColors[book.group] || groupColors.law;
    let bgColor = colors.normal;
    if (showCorrect && feedback === 'correct') bgColor = '#3b82f6';
    else if (showCorrect && feedback === 'slow') bgColor = '#f59e0b';
    else if (feedback === 'wrong' && isTarget) bgColor = '#ef4444';
    else if (showWrong) bgColor = '#f97316';

    const showMasteryLine = config.display.highlightFound && isMastered;

    return (
      <button
        className={`book-cell ${showMasteryLine ? 'mastered' : ''}`}
        style={{ backgroundColor: bgColor }}
        onClick={() => handleBookClick(book)}
        disabled={feedbackRef.current}
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
          <button className="btn" onClick={() => setShowSummary(false)}>
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
      <div className="quiz-top">
        <div className="quiz-prompt-row">
          <button className="back-btn" onClick={handleBack}>← {t.back}</button>
          <div className="quiz-prompt">
            <span className="prompt-book">{lang === 'nl' ? targetBook.nl : targetBook.en}</span>
          </div>
          <div className="quiz-stats">
            <span className="mode-icon">🎯</span>
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
        </div>

        {/* Fixed-height zone — always same height, never causes layout shift */}
        <div className={`quiz-feedback-zone${
          hintVisible ? ' fb-state-hint' :
          (feedback === 'correct' || showNewBest) ? ' fb-state-correct' :
          feedback === 'slow' ? ' fb-state-slow' :
          feedback === 'wrong' ? ' fb-state-wrong' : ''
        }`}>
          {hintVisible
            ? (
              <span className="fb-hint">
                <span className="hint-color-dot" style={{ backgroundColor: groupColors[targetBook.group]?.normal }} />
                {t.hintReveal} <strong>{hintGroup}</strong>
              </span>
            )
            : feedback === 'correct' && !showNewBest
              ? <span className="fb-correct">{t.correct} {formatTime(responseTime)}</span>
              : showNewBest
                ? <span className="fb-correct">⚡ {t.newBest} {formatTime(responseTime)}</span>
                : feedback === 'slow'
                  ? <span className="fb-slow">{t.tooSlow} — {formatTime(responseTime)}</span>
                  : feedback === 'wrong'
                    ? <span className="fb-wrong">{t.wrong}</span>
                    : null
          }
        </div>
      </div>

      {milestone && (
        <div className="milestone-banner">{milestone}</div>
      )}

      <div className="quiz-bottom" ref={scrollRef}>
        <div className="section">
          <h3 className="section-title">{t.hebrewSection}</h3>
          <div className="book-grid" ref={gridRef} style={{ gridTemplateColumns: `repeat(${activeColumns}, 1fr)` }}>
            {otBooks.map(book => <BookCell key={book.id} book={book} />)}
          </div>
        </div>

        <div className="section">
          <h3 className="section-title">{t.greekSection}</h3>
          <div className="book-grid" style={{ gridTemplateColumns: `repeat(${activeColumns}, 1fr)` }}>
            {ntBooks.map(book => <BookCell key={book.id} book={book} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

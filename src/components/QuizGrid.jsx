import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { bibleBooks, groupColors, groupNames } from '../data';
import { useAppConfig } from '../App';
import './QuizGrid.css';

export default function QuizGrid({ foundBooks, masteredBookIds, markFound, bestStreak, setBestStreak, addQuizSession, onBack }) {
  const { config, t, lang } = useAppConfig();
  const [targetBook, setTargetBook] = useState(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [startTime, setStartTime] = useState(null);
  const [responseTime, setResponseTime] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [responseTimes, setResponseTimes] = useState([]);
  const [bookTimes, setBookTimes] = useState({});
  
  const [hintVisible, setHintVisible] = useState(false);
  const [sessionMasteredBooks, setSessionMasteredBooks] = useState(new Set());
  const [sessionHintedBooks, setSessionHintedBooks] = useState(new Set());
  const [sessionWrongBooks, setSessionWrongBooks] = useState(new Set());
  
  const feedbackRef = useRef(false);
  const scrollRef = useRef(null);

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

  // Find the longest book name across all books for the current language
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
      // At 0.85rem (~13.6px), average char is ~7.5px, minus padding (20px)
      const maxChars = Math.floor((cellWidth - 20) / 7.5);
      setAutoAbbr(longestNameLength > maxChars);
    };
    // Delay first check so DOM is ready
    const timer = setTimeout(checkFit, 50);
    window.addEventListener('resize', checkFit);
    return () => { clearTimeout(timer); window.removeEventListener('resize', checkFit); };
  }, [abbrMode, activeColumns, longestNameLength]);

  const useAbbreviations = orientation === 'landscape' ? false : abbrMode === 'always' ? true : abbrMode === 'never' ? false : autoAbbr;

  const pickRandomBook = useCallback(() => {
    feedbackRef.current = false;
    const index = Math.floor(Math.random() * bibleBooks.length);
    const book = bibleBooks[index];
    setTargetBook(book);
    setStartTime(Date.now());
    setResponseTime(null);
    setFeedback(null);
    setHintVisible(false);
    // Scroll to top on new question
    scrollRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    pickRandomBook();
    window.scrollTo(0, 0);
  }, [pickRandomBook]);

  const handleBack = useCallback(() => {
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

  const handleBookClick = (book) => {
    if (!targetBook || feedbackRef.current) return;

    if (book.id === targetBook.id) {
      feedbackRef.current = true;
      setFeedback('correct');
      setHintVisible(false);
      const timeTaken = Date.now() - startTime;
      setResponseTime(timeTaken);
      setResponseTimes(prev => [...prev, timeTaken]);

      // Track best time per book
      const prevBest = bookTimes[targetBook.id] || Infinity;
      if (timeTaken < prevBest) {
        setBookTimes(prev => ({ ...prev, [targetBook.id]: timeTaken }));
      }

      const isMastered = timeTaken <= config.quiz.masteryMs;
      
      setScore(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));

      if (isMastered) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak > bestStreak) setBestStreak(newStreak);
        markFound(book.id);
        setSessionMasteredBooks(prev => new Set(prev).add(book.id));
      } else {
        setStreak(0);
      }

      setTimeout(() => pickRandomBook(), 800);
      return;
    }

    // Wrong click
    feedbackRef.current = true;
    setFeedback('wrong');
    setSessionWrongBooks(prev => new Set(prev).add(book.id));
    setScore(prev => ({ ...prev, total: prev.total + 1 }));
    setStreak(0);

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

  const BookCell = ({ book }) => {
    const isMastered = masteredBookIds.includes(book.id);
    const isTarget = book.id === targetBook?.id;
    const showCorrect = feedback === 'correct' && isTarget;
    const showWrong = feedback === 'wrong' && !isTarget;
    const displayName = useAbbreviations
      ? (lang === 'nl' ? book.nlAbbr : book.enAbbr)
      : (lang === 'nl' ? book.nl : book.en);

    const colors = groupColors[book.group] || groupColors.law;
    let bgColor = colors.normal;
    if (config.display.highlightFound && isMastered) bgColor = colors.hover;
    if (showCorrect) bgColor = '#3b82f6';
    else if (feedback === 'wrong' && isTarget) bgColor = '#ef4444';
    else if (showWrong) bgColor = '#f97316';

    return (
      <button
        className="book-cell"
        style={{ backgroundColor: bgColor }}
        onClick={() => handleBookClick(book)}
        disabled={feedbackRef.current}
      >
        <span className="book-name">{displayName}</span>
      </button>
    );
  };

  if (!targetBook) return null;

  const prevBest = bookTimes[targetBook.id];
  const targetLabel = prevBest ? `~${formatTime(prevBest)}` : '';

  return (
    <div className="quiz-grid">
      <div className="quiz-top">
        <div className="quiz-prompt-row">
          <button className="back-btn" onClick={handleBack}>← {t.back}</button>
          <div className="quiz-prompt">
            <span className="prompt-book">{lang === 'nl' ? targetBook.nl : targetBook.en}</span>
            {targetLabel && <span className="prompt-target">{targetLabel}</span>}
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
          <button className={`hint-btn ${hintVisible ? 'active' : ''}`} onClick={handleHint}>
            💡
          </button>
        </div>
      </div>

      {feedback === 'correct' && (
        <div className="feedback correct"><p>{t.correct} {formatTime(responseTime)}</p></div>
      )}
      {feedback === 'wrong' && (
        <div className="feedback wrong"><p>{t.wrong}</p></div>
      )}

      {hintVisible && (
        <div className="feedback hint">
          <div className="hint-color-dot" style={{ backgroundColor: groupColors[targetBook.group]?.normal }} />
          <p>{t.hintReveal} <strong>{hintGroup}</strong></p>
        </div>
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

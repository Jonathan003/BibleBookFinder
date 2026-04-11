import { useState, useEffect, useCallback, useRef } from 'react';
import { bibleBooks, groupColors } from '../data';
import { useAppConfig } from '../App';
import './QuizGrid.css';

export default function QuizGrid({ foundBooks, markFound, bestStreak, setBestStreak, addQuizSession, onBack }) {
  const { config, t, lang } = useAppConfig();
  const [targetBook, setTargetBook] = useState(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [startTime, setStartTime] = useState(null);
  const [responseTime, setResponseTime] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [responseTimes, setResponseTimes] = useState([]);
  const [bookTimes, setBookTimes] = useState({});
  
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

  const feedbackRef = useRef(false);

  const pickRandomBook = useCallback(() => {
    feedbackRef.current = false;
    const index = Math.floor(Math.random() * bibleBooks.length);
    const book = bibleBooks[index];
    setTargetBook(book);
    setStartTime(Date.now());
    setResponseTime(null);
    setFeedback(null);
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
      addQuizSession({ correct: score.correct, total: score.total, avgTime });
    }
    onBack();
  }, [score, responseTimes, addQuizSession, onBack]);

  const handleBookClick = (book) => {
    if (!targetBook || feedback || feedbackRef.current) return;

    const timeTaken = Date.now() - startTime;
    setResponseTime(timeTaken);

    const prevBest = bookTimes[targetBook.id] || Infinity;
    const isAlwaysGood = timeTaken <= config.quiz.alwaysGoodMs;
    const isNearBest = timeTaken <= prevBest + config.quiz.beatRecordMs;
    const isFirstTry = prevBest === Infinity;
    const isCorrect = isAlwaysGood || isNearBest || isFirstTry;

    if (book.id === targetBook.id && isCorrect) {
      feedbackRef.current = true;
      setFeedback('correct');
      setResponseTimes(prev => [...prev, timeTaken]);
      setScore(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));

      if (timeTaken < prevBest) {
        setBookTimes(prev => ({ ...prev, [targetBook.id]: timeTaken }));
      }

      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      markFound(book.id);

      setTimeout(() => pickRandomBook(), 800);
    } else if (book.id === targetBook.id) {
      feedbackRef.current = true;
      setFeedback('slow');
      setScore(prev => ({ ...prev, total: prev.total + 1 }));
      setStreak(0);
      setTimeout(() => { feedbackRef.current = false; setFeedback(null); setResponseTime(null); }, 1000);
    } else {
      feedbackRef.current = true;
      setFeedback('wrong');
      setScore(prev => ({ ...prev, total: prev.total + 1 }));
      setStreak(0);
      setTimeout(() => { feedbackRef.current = false; setFeedback(null); setResponseTime(null); }, 600);
    }
  };

  const formatTime = (ms) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

  const otBooks = bibleBooks.filter(b => b.testament === 'OT');
  const ntBooks = bibleBooks.filter(b => b.testament === 'NT');

  const BookCell = ({ book }) => {
    const isFound = foundBooks.includes(book.id);
    const showFeedback = feedback && book.id === targetBook.id;
    const showWrong = feedback === 'wrong' && book.id !== targetBook.id;
    const displayName = orientation === 'landscape'
      ? (lang === 'nl' ? book.nl : book.en)
      : (lang === 'nl' ? book.nlAbbr : book.enAbbr);

    const colors = groupColors[book.group] || groupColors.law;
    let bgColor = colors.normal;
    if (config.display.highlightFound && isFound) bgColor = colors.hover;
    if (showFeedback === 'correct') bgColor = '#3b82f6';
    else if (showFeedback === 'slow') bgColor = '#ef4444';
    else if (showWrong) bgColor = '#f97316';

    return (
      <button
        className="book-cell"
        style={{ backgroundColor: bgColor }}
        onClick={() => handleBookClick(book)}
        disabled={feedback !== null || feedbackRef.current}
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
        <button className="back-btn" onClick={handleBack}>← {t.back}</button>
        <div className="quiz-prompt">
          <span className="prompt-book">{lang === 'nl' ? targetBook.nl : targetBook.en}</span>
          {targetLabel && <span className="prompt-target">{targetLabel}</span>}
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
        </div>
      </div>

      {feedback === 'correct' && (
        <div className="feedback correct"><p>{t.correct} {formatTime(responseTime)}</p></div>
      )}
      {feedback === 'wrong' && (
        <div className="feedback wrong"><p>{t.wrong}</p></div>
      )}
      {feedback === 'slow' && (
        <div className="feedback slow"><p>{t.tooSlow}</p></div>
      )}

      <div className="quiz-bottom">
        <div className="section">
          <h3 className="section-title">{t.hebrewSection}</h3>
          <div className="book-grid" style={{ gridTemplateColumns: `repeat(${activeColumns}, 1fr)` }}>
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

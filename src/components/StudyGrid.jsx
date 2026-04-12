import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { bibleBooks, groupColors, groupNames } from '../data';
import { useAppConfig } from '../App';
import './QuizGrid.css';

export default function StudyGrid({ quizHistory, onBack }) {
  const { config, t, lang } = useAppConfig();
  const [targetBook, setTargetBook] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [sessionFoundBooks, setSessionFoundBooks] = useState(new Set());

  const feedbackRef = useRef(false);
  const pickerRef = useRef(null);

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

  // Determine weak books from quiz history
  const weakBookIds = useMemo(() => {
    const weakSet = new Set();
    const recentSessions = (quizHistory || []).slice(-5);
    recentSessions.forEach(session => {
      if (session.hintedBookIds) session.hintedBookIds.forEach(id => weakSet.add(id));
      if (session.wrongBookIds) session.wrongBookIds.forEach(id => weakSet.add(id));
    });
    return weakSet;
  }, [quizHistory]);

  const pickRandomBook = useCallback(() => {
    feedbackRef.current = false;

    let available = bibleBooks.filter(b => !sessionFoundBooks.has(b.id));
    if (available.length === 0) {
      // All books found this session — reset and start over
      setSessionFoundBooks(new Set());
      available = [...bibleBooks];
    }

    const weakPool = available.filter(b => weakBookIds.has(b.id));
    const normalPool = available.filter(b => !weakBookIds.has(b.id));

    let selectedBook;
    // 70% chance to pick a weak book if available
    if (weakPool.length > 0 && normalPool.length > 0 && Math.random() < 0.7) {
      selectedBook = weakPool[Math.floor(Math.random() * weakPool.length)];
    } else if (weakPool.length > 0 && normalPool.length === 0) {
      selectedBook = weakPool[Math.floor(Math.random() * weakPool.length)];
    } else {
      selectedBook = available[Math.floor(Math.random() * available.length)];
    }

    setTargetBook(selectedBook);
    setHintVisible(false);
    setFeedback(null);
  }, [weakBookIds, sessionFoundBooks]);

  pickerRef.current = pickRandomBook;

  useEffect(() => {
    pickerRef.current();
    window.scrollTo(0, 0);
  }, []);

  const handleBookClick = (book) => {
    if (!targetBook || feedbackRef.current) return;

    if (book.id === targetBook.id) {
      feedbackRef.current = true;
      setFeedback('correct');
      setHintVisible(false);
      setSessionFoundBooks(prev => new Set(prev).add(book.id));
      setTimeout(() => pickerRef.current(), 800);
      return;
    }

    // Wrong click
    feedbackRef.current = true;
    setFeedback('wrong');
    setTimeout(() => {
      feedbackRef.current = false;
      setFeedback(null);
    }, 600);
  };

  const handleHint = () => {
    if (!targetBook) return;
    setHintVisible(prev => !prev);
  };

  const otBooks = bibleBooks.filter(b => b.testament === 'OT');
  const ntBooks = bibleBooks.filter(b => b.testament === 'NT');

  const hintGroup = groupNames[lang]?.[targetBook?.group] || '';

  const BookCell = ({ book }) => {
    const isTarget = book.id === targetBook?.id;
    const showCorrect = feedback === 'correct' && isTarget;
    const showWrong = feedback === 'wrong' && !isTarget;
    const displayName = useAbbreviations
      ? (lang === 'nl' ? book.nlAbbr : book.enAbbr)
      : (lang === 'nl' ? book.nl : book.en);

    const colors = groupColors[book.group] || groupColors.law;
    let bgColor = colors.normal;

    if (showCorrect) bgColor = '#3b82f6';
    else if (feedback === 'wrong' && isTarget) bgColor = '#ef4444';
    else if (showWrong) bgColor = '#f97316';

    return (
      <button
        className={`book-cell ${showCorrect ? 'correct' : ''} ${showWrong ? 'wrong' : ''}`}
        style={{ backgroundColor: bgColor }}
        onClick={() => handleBookClick(book)}
        disabled={feedbackRef.current}
      >
        <span className="book-name">{displayName}</span>
      </button>
    );
  };

  if (!targetBook) return null;

  return (
    <div className="study-grid quiz-grid">
      <div className="study-header quiz-top">
        <div className="quiz-prompt-row">
          <button className="back-btn" onClick={onBack}>← {t.back}</button>
          <div className="quiz-prompt">
            <span className="prompt-book">{lang === 'nl' ? targetBook.nl : targetBook.en}</span>
          </div>
        </div>
        <div className="quiz-stats">
          <div className="study-badge">
            <span className="study-badge-icon">📖</span>
            <span>{t.studyMode}</span>
          </div>
          <button className={`hint-btn ${hintVisible ? 'active' : ''}`} onClick={handleHint}>
            💡
          </button>
        </div>
      </div>

      {feedback === 'correct' && <div className="feedback correct"><p>{t.correct}</p></div>}
      {feedback === 'wrong' && <div className="feedback wrong"><p>{t.wrong}</p></div>}

      {hintVisible && (
        <div className="feedback hint">
          <div className="hint-color-dot" style={{ backgroundColor: groupColors[targetBook.group]?.normal }} />
          <p>{t.hintReveal} <strong>{hintGroup}</strong></p>
        </div>
      )}

      <div className="quiz-bottom">
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

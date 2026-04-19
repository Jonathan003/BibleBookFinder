import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { bibleBooks, groupColors, groupNames } from '../data';
import { useAppConfig } from '../App';
import { useGridLayout } from '../useGridLayout';
import './QuizGrid.css';

const GROUPS = [
  { id: 'all', icon: '📖' },
  { id: 'law', icon: '📜' },
  { id: 'history', icon: '⚔️' },
  { id: 'poetry', icon: '🎵' },
  { id: 'prophets', icon: '🔥' },
  { id: 'gospels', icon: '🕊️' },
  { id: 'acts', icon: '💨' },
  { id: 'epistles', icon: '✉️' },
  { id: 'revelation', icon: '👑' },
];

const ALL_GROUP_IDS = ['law', 'history', 'poetry', 'prophets', 'gospels', 'acts', 'epistles', 'revelation'];

export default function StudyGrid({ savedGroups, onSaveGroups, onBack, fsrsCards }) {
  const { config, t, lang } = useAppConfig();
  // Derived from prop — no local copy, no sync effect needed
  const selectedGroups = useMemo(() => new Set(savedGroups || []), [savedGroups]);
  const [started, setStarted] = useState(false);
  const [targetBook, setTargetBook] = useState(null);

  const [feedback, setFeedback] = useState(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [correctBookId, setCorrectBookId] = useState(null);
  const [sessionCount, setSessionCount] = useState(0);

  const feedbackRef = useRef(false);
  const pickerRef = useRef(null);
  const scrollRef = useRef(null);
  const promptRowRef = useRef(null);
  const quizTopRef = useRef(null);
  const [overlayTop, setOverlayTop] = useState(null);

  // Track every setTimeout so they can be cancelled on unmount.
  const timeoutsRef = useRef(new Set());
  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.clear();
  }, []);
  const schedule = (fn, ms) => {
    const id = setTimeout(() => {
      timeoutsRef.current.delete(id);
      fn();
    }, ms);
    timeoutsRef.current.add(id);
    return id;
  };

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

  const { orientation, activeColumns, useAbbreviations, gridRef } = useGridLayout([started]);

  const pickRandomBook = useCallback(() => {
    feedbackRef.current = false;
    const pool = selectedGroups.size > 0
      ? bibleBooks.filter(b => selectedGroups.has(b.group))
      : bibleBooks;

    let selected;
    const bookSelection = config.study?.bookSelection || 'focused';
    if (bookSelection === 'focused' && fsrsCards && Object.keys(fsrsCards).length > 0) {
      // Weight books by difficulty: lower stability = higher weight
      const weights = pool.map(b => {
        const stability = fsrsCards[b.id]?.stability || 0;
        // Books never seen (stability=0) get weight 3, hard books get high weight, easy books get low weight
        if (stability === 0) return 3;
        return Math.max(0.5, 10 / (stability + 1));
      });
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let rand = Math.random() * totalWeight;
      let idx = 0;
      for (let i = 0; i < weights.length; i++) {
        rand -= weights[i];
        if (rand <= 0) { idx = i; break; }
      }
      selected = pool[idx];
    } else {
      selected = pool[Math.floor(Math.random() * pool.length)];
    }
    setTargetBook(selected);
    setHintVisible(false);
    setFeedback(null);
    setCorrectBookId(null);
    if (config.quiz.autoScroll !== false) {
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
  }, [selectedGroups, config.quiz.autoScroll]);

  // Latest-ref pattern: effects and timeouts always call the current
  // pickRandomBook without needing it as a dependency (avoids stale closures)
  pickerRef.current = pickRandomBook;

  useEffect(() => {
    if (started) {
      pickerRef.current();
    }
  }, [started]);

  const handleBookClick = (book) => {
    if (!targetBook) return;
    // Allow clicking the correct book to dismiss wrong feedback
    if (feedbackRef.current && book.id === correctBookId) {
      feedbackRef.current = false;
      setFeedback(null);
      setCorrectBookId(null);
      pickerRef.current();
      return;
    }
    if (feedbackRef.current) return;

    if (book.id === targetBook.id) {
      feedbackRef.current = true;
      setFeedback('correct');
      setHintVisible(false);
      setSessionCount(prev => prev + 1);
      schedule(() => pickerRef.current(), 800);
      return;
    }

    // Wrong click — show where the correct book is
    // User must click the correct (blue) book to advance
    feedbackRef.current = true;
    setFeedback('wrong');
    setCorrectBookId(targetBook.id);
    schedule(() => {
      document.querySelector(`[data-book-id="${targetBook.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleHint = () => {
    if (!targetBook) return;
    setHintVisible(prev => !prev);
  };

  const otBooks = bibleBooks.filter(b => b.testament === 'OT');
  const ntBooks = bibleBooks.filter(b => b.testament === 'NT');

  const hintGroup = groupNames[lang]?.[targetBook?.group] || '';

  const toggleGroup = (groupId) => {
    const current = savedGroups || [];
    const newGroups = current.includes(groupId)
      ? current.filter(g => g !== groupId)
      : [...current, groupId];
    onSaveGroups(newGroups);
  };

  const toggleAll = () => {
    if (selectedGroups.size === ALL_GROUP_IDS.length) {
      onSaveGroups([]);
    } else {
      onSaveGroups([...ALL_GROUP_IDS]);
    }
  };

  const selectedBookCount = selectedGroups.size === 0 ? 0
    : bibleBooks.filter(b => selectedGroups.has(b.group)).length;

  // Group selection screen
  if (!started) {
    const allSelected = selectedGroups.size === ALL_GROUP_IDS.length;
    return (
      <div className="study-grid quiz-grid">
        <div className="study-header quiz-top">
          <div className="quiz-prompt-row">
            <button className="back-btn" onClick={onBack}>← {t.back}</button>
            <div className="quiz-prompt">
              <span className="prompt-book">{t.studyChooseGroup || 'Choose groups to study'}</span>
            </div>
          </div>
        </div>
        <div className="quiz-bottom" style={{ padding: '0.5rem' }}>
          <div className="group-picker">
            <button
              className={`group-pick-btn ${allSelected ? 'selected' : ''}`}
              onClick={toggleAll}
            >
              <span className="group-pick-check">{allSelected ? '☑' : '☐'}</span>
              <span className="group-pick-icon">📖</span>
              <span className="group-pick-label">{t.allBooks || 'All Books'}</span>
              <span className="group-pick-count">66 {t.books || 'books'}</span>
            </button>
            {GROUPS.filter(g => g.id !== 'all').map(group => {
              const isSelected = selectedGroups.has(group.id);
              const groupLabel = groupNames[lang]?.[group.id] || group.id;
              const count = bibleBooks.filter(b => b.group === group.id).length;
              return (
                <button
                  key={group.id}
                  className={`group-pick-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleGroup(group.id)}
                >
                  <span className="group-pick-check">{isSelected ? '☑' : '☐'}</span>
                  <span className="group-pick-icon">{group.icon}</span>
                  <span className="group-pick-label">{groupLabel}</span>
                  <span className="group-pick-count">{count} {t.books || 'books'}</span>
                </button>
              );
            })}
          </div>
          <button
            className="group-start-btn"
            disabled={selectedGroups.size === 0}
            onClick={() => {
              onSaveGroups([...selectedGroups]);
              setStarted(true);
            }}
          >
            {t.startStudy || 'Start'} ({selectedBookCount} {t.books || 'books'})
          </button>
        </div>
      </div>
    );
  }

  const renderBookCell = (book) => {
    const isTarget = book.id === targetBook?.id;
    const isCorrectReveal = book.id === correctBookId;
    const showCorrect = feedback === 'correct' && isTarget;
    const showWrong = feedback === 'wrong' && !isTarget && !isCorrectReveal;
    const displayName = useAbbreviations
      ? (lang === 'nl' ? book.nlAbbr : book.enAbbr)
      : (lang === 'nl' ? book.nl : book.en);

    const colors = groupColors[book.group] || groupColors.law;
    let bgColor = colors.normal;

    if (showCorrect) bgColor = '#3b82f6';
    else if (isCorrectReveal) bgColor = '#3b82f6';
    // Target book on a wrong click: use blue (same as isCorrectReveal) rather
    // than red.  Consistent with the fix applied in QuizGrid.jsx for deutan
    // colorblind users.
    else if (feedback === 'wrong' && isTarget) bgColor = '#3b82f6';
    else if (showWrong) bgColor = '#f97316';

    return (
      <button
        key={book.id}
        className={`book-cell ${showCorrect ? 'correct' : ''} ${showWrong ? 'wrong' : ''}`}
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

  return (
    <div className="study-grid quiz-grid">
      <div className="study-header quiz-top" ref={quizTopRef}>
        <div className="quiz-prompt-row" ref={promptRowRef}>
          <button className="back-btn" onClick={() => setStarted(false)}>← {t.back}</button>
          <div className={`quiz-prompt ${
            !hintVisible && feedback === 'correct' ? 'prompt-correct' :
            !hintVisible && feedback === 'wrong' ? 'prompt-wrong' : ''
          }`}>
            {!hintVisible && feedback === 'correct'
              ? <span className="prompt-book">✓ {t.correct}</span>
              : !hintVisible && feedback === 'wrong'
              ? <span className="prompt-book">✗ {t.wrongShowCorrect || 'Wrong — look for the blue cell!'}</span>
              : <span className="prompt-book">{lang === 'nl' ? targetBook.nl : targetBook.en}</span>
            }
          </div>
        </div>
        <div className="quiz-stats">
          <div className="study-badge">
            <span className="study-badge-icon">📖</span>
            <span>{t.studyMode}</span>
          </div>
          <div className="stat">
            <span className="stat-value">{sessionCount}</span>
            <span className="stat-label">{t.practiced || 'Practiced'}</span>
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

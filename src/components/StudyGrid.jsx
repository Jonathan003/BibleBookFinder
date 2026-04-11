import { useState, useEffect } from 'react';
import { bibleBooks, groupColors } from '../data';
import { useAppConfig } from '../App';
import './StudyGrid.css';

export default function StudyGrid({ foundBooks, markFound, onBack }) {
  const [selectedBook, setSelectedBook] = useState(null);
  const { config, t, lang } = useAppConfig();

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

  const otBooks = bibleBooks.filter(b => b.testament === 'OT');
  const ntBooks = bibleBooks.filter(b => b.testament === 'NT');

  const handleBookClick = (book) => {
    setSelectedBook(book);
    markFound(book.id);
  };

  const BookCell = ({ book }) => {
    const isFound = foundBooks.includes(book.id);
    const isSelected = selectedBook?.id === book.id;
    const displayName = orientation === 'landscape'
      ? (lang === 'nl' ? book.nl : book.en)
      : (lang === 'nl' ? book.nlAbbr : book.enAbbr);

    const colors = groupColors[book.group] || groupColors.law;
    let bgColor = colors.normal;
    if (config.display.highlightFound && isFound) bgColor = colors.hover;
    if (isSelected) bgColor = colors.active;

    return (
      <button
        className="book-cell"
        style={{ backgroundColor: bgColor }}
        onClick={() => handleBookClick(book)}
      >
        <span className="book-name">{displayName}</span>
      </button>
    );
  };

  return (
    <div className="study-grid">
      <div className="study-header">
        <button className="back-btn" onClick={onBack}>← {t.back}</button>
        <h2>{t.studyMode}</h2>
        <div style={{ width: 60 }} />
      </div>

      {selectedBook && (
        <div className="book-detail">
          <h3>{lang === 'nl' ? selectedBook.nl : selectedBook.en}</h3>
          <p>#{selectedBook.id} • {selectedBook.testament === 'OT' ? t.hebrewSection : t.greekSection}</p>
        </div>
      )}

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
  );
}

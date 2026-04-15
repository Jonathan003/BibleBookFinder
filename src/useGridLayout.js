import { useState, useEffect, useRef, useMemo } from 'react';
import { bibleBooks } from './data';
import { useAppConfig } from './App';

// Shared hook for orientation detection, column count, and smart abbreviations
// extraDeps: optional array of dependencies to trigger abbreviation recheck (e.g. [started])
export function useGridLayout(extraDeps = []) {
  const { config, lang } = useAppConfig();

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
      const maxChars = Math.floor((cellWidth - 16) / 6);
      setAutoAbbr(longestNameLength > maxChars);
    };
    const timer = setTimeout(checkFit, 50);
    window.addEventListener('resize', checkFit);
    return () => { clearTimeout(timer); window.removeEventListener('resize', checkFit); };
  }, [abbrMode, activeColumns, longestNameLength, ...extraDeps]);

  const useAbbreviations = orientation === 'landscape' ? false : abbrMode === 'always' ? true : abbrMode === 'never' ? false : autoAbbr;

  return { orientation, activeColumns, useAbbreviations, gridRef };
}

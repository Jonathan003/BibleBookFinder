import { useState, useEffect, useCallback, useMemo } from 'react';
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
  //
  // We use a callback ref (not useRef) so the measurement effect re-runs
  // when the grid element is actually attached. Consumers like QuizGrid
  // conditionally return null before the first book is picked, so the
  // grid doesn't exist at initial mount — a useRef would be null on the
  // first useEffect run and never trigger a re-run when the element
  // later appears. Callback refs fire exactly when React attaches or
  // detaches the DOM node.
  const [gridEl, setGridEl] = useState(null);
  const gridRef = useCallback((node) => setGridEl(node), []);
  const [autoAbbr, setAutoAbbr] = useState(false);
  const abbrMode = config.display.abbreviations || 'auto';

  const longestNameLength = useMemo(() => {
    return bibleBooks.reduce((max, book) => {
      const name = lang === 'nl' ? book.nl : book.en;
      return Math.max(max, name.length);
    }, 0);
  }, [lang]);

  useEffect(() => {
    if (abbrMode !== 'auto' || !gridEl) return;
    const checkFit = () => {
      const cellWidth = gridEl.offsetWidth / activeColumns;
      const maxChars = Math.floor((cellWidth - 16) / 6);
      setAutoAbbr(longestNameLength > maxChars);
    };
    // Measure once now — gridEl is guaranteed to be an attached DOM node
    // because the callback ref only fires after React has committed it.
    // ResizeObserver handles subsequent size changes (rotation, column
    // count change, parent resize) in a single mechanism.
    checkFit();
    const ro = new ResizeObserver(checkFit);
    ro.observe(gridEl);
    return () => ro.disconnect();
  }, [gridEl, abbrMode, activeColumns, longestNameLength, ...extraDeps]);

  const useAbbreviations = orientation === 'landscape' ? false : abbrMode === 'always' ? true : abbrMode === 'never' ? false : autoAbbr;

  return { orientation, activeColumns, useAbbreviations, gridRef };
}

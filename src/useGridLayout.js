import { useState, useEffect, useCallback, useMemo } from 'react';
import { bibleBooks } from './data';
import { useAppConfig } from './App';

// Shared hook for orientation detection, column count, and abbreviation level.
//
// Returns `displayMode`: one of 'full' | 'long' | 'short'.
//   'full'  → full localized names ('Genesis', 'Numeri')
//   'long'  → long abbreviations   ('Gen.', '1 Sam.')
//   'short' → short abbreviations  ('Ge', '1Sa')
//
// The setting per orientation is one of: 'auto' | 'full' | 'long' | 'short'.
// When set to 'auto', the cascade picks the highest level that fits in the
// rendered cell width — measured against BOTH languages (NL and EN), so the
// same level is chosen regardless of which language is currently active.
// This prevents the layout from flipping between abbreviation levels when
// the user toggles NL ↔ EN.
//
// extraDeps: optional dependencies to force a re-measure (e.g. [started]).
export function useGridLayout(extraDeps = []) {
  const { config } = useAppConfig();

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

  // Callback ref so the measurement effect re-runs when the grid element
  // is actually attached. Consumers like QuizGrid render null before the
  // first book is picked, so the grid element doesn't exist on initial
  // mount — a useRef would be null on the first useEffect run and would
  // never re-trigger when the element later appears. Callback refs fire
  // exactly when React attaches or detaches the DOM node.
  const [gridEl, setGridEl] = useState(null);
  const gridRef = useCallback((node) => setGridEl(node), []);

  const setting = orientation === 'landscape'
    ? (config.display.abbreviationsLandscape || 'auto')
    : (config.display.abbreviationsPortrait  || 'auto');

  // Longest length per level, computed across BOTH languages so the auto
  // cascade is language-independent. If long names fit in NL but not in EN,
  // we drop to long abbreviations everywhere — the layout never flips on
  // language toggle.
  const longestLengths = useMemo(() => {
    let full = 0, long = 0, short = 0;
    for (const book of bibleBooks) {
      full  = Math.max(full,  book.nl.length,         book.en.length);
      long  = Math.max(long,  book.nlAbbrLong.length, book.enAbbrLong.length);
      short = Math.max(short, book.nlAbbr.length,     book.enAbbr.length);
    }
    return { full, long, short };
  }, []);

  // Auto-cascade result. Only computed/used when setting === 'auto'.
  // Default 'short' is the safe initial value: if measurement hasn't run yet,
  // showing short abbreviations is guaranteed to fit. Once the ResizeObserver
  // fires (synchronously on first observe), this gets upgraded if possible.
  const [autoMode, setAutoMode] = useState('short');

  useEffect(() => {
    if (setting !== 'auto' || !gridEl) return;
    const recompute = () => {
      const cellWidth = gridEl.offsetWidth / activeColumns;
      // ~6px per character, ~16px horizontal padding. Same heuristic the
      // previous two-level auto used; conservative on the safe side
      // (under-estimates fit slightly, so we abbreviate a hair earlier
      // than strictly necessary rather than overflowing).
      const maxChars = Math.floor((cellWidth - 16) / 6);
      let next;
      if (longestLengths.full  <= maxChars) next = 'full';
      else if (longestLengths.long <= maxChars) next = 'long';
      else next = 'short';
      setAutoMode(prev => prev === next ? prev : next);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(gridEl);
    return () => ro.disconnect();
  }, [gridEl, setting, activeColumns, longestLengths, ...extraDeps]);

  // Resolve final displayMode. Explicit settings bypass the cascade.
  const displayMode = setting === 'auto' ? autoMode : setting;

  return { orientation, activeColumns, displayMode, gridRef };
}

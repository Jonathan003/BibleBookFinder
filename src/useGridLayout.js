import { useState, useEffect, useCallback, useMemo } from 'react';
import { bibleBooks } from './data';
import { useAppConfig } from './App';

// Shared hook for orientation detection, columns, abbreviation level, and
// OT/NT layout (stacked vs side-by-side in landscape).
//
// Returns:
//   orientation       'portrait' | 'landscape' (resolves 'auto' via media query)
//   testamentsLayout  'stacked' | 'sideBySide'
//                     Always 'stacked' in portrait (no horizontal room).
//                     In landscape, follows config.display.testamentsLayout.
//   otColumns         number of columns for the OT (Hebrew-Aramaic) grid
//   ntColumns         number of columns for the NT (Christian Greek) grid
//                     In stacked mode, otColumns === ntColumns (one width).
//                     In sideBySide, they're independent (typical 4 + 3).
//   displayMode       'full' | 'long' | 'short'
//                     'full'  → full localized names ('Genesis', 'Numeri')
//                     'long'  → long abbreviations   ('Gen.', '1 Sam.')
//                     'short' → short abbreviations  ('Ge', '1Sa')
//   gridRef           callback ref to attach to ONE grid for measurement.
//                     In sideBySide we attach it to the OT grid: OT has more
//                     columns than NT, so its cells are smaller, so it's the
//                     limiting factor for the auto-cascade. Both grids end
//                     up using the same displayMode for visual consistency.
//
// The abbreviation setting per orientation is one of: 'auto' | 'full' | 'long' | 'short'.
// When 'auto', the cascade picks the highest level that fits in the rendered
// cell width — measured against BOTH languages (NL and EN), so the same level
// is chosen regardless of which language is currently active.
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

  // Resolve testamentsLayout. Portrait is always stacked because there's no
  // horizontal room for two halves; the setting only takes effect in landscape.
  const testamentsLayout = orientation === 'landscape'
    ? (config.display.testamentsLayout || 'stacked')
    : 'stacked';

  // Resolve column counts. In stacked mode both grids use the same value
  // (one set of columns spanning full width). In sideBySide each grid has
  // its own count.
  let otColumns, ntColumns;
  if (orientation === 'portrait') {
    otColumns = ntColumns = config.grid.portrait;
  } else if (testamentsLayout === 'sideBySide') {
    otColumns = config.grid.landscapeSideBySideOT ?? 4;
    ntColumns = config.grid.landscapeSideBySideNT ?? 3;
  } else {
    otColumns = ntColumns = config.grid.landscape;
  }

  // Callback ref so the measurement effect re-runs when the grid element
  // is actually attached. Consumers render null before the first book is
  // picked, so the grid element doesn't exist on initial mount — a useRef
  // would be null on the first useEffect run and would never re-trigger
  // when the element later appears. Callback refs fire exactly when React
  // attaches or detaches the DOM node. The consumer attaches gridRef to
  // the OT grid; in sideBySide that's the smaller-cell grid (worst case).
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

  // Columns used for the cell-width estimate. Uses otColumns since gridRef
  // is attached to the OT grid. We include this in the deps so changing
  // testamentsLayout (which may change otColumns) triggers a re-measure.
  const measuredColumns = otColumns;

  useEffect(() => {
    if (setting !== 'auto' || !gridEl) return;
    const recompute = () => {
      const cellWidth = gridEl.offsetWidth / measuredColumns;
      // ~6px per character, ~16px horizontal padding. Conservative on the
      // safe side (under-estimates fit slightly, so we abbreviate a hair
      // earlier than strictly necessary rather than overflowing).
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
  }, [gridEl, setting, measuredColumns, longestLengths, ...extraDeps]);

  // Resolve final displayMode. Explicit settings bypass the cascade.
  const displayMode = setting === 'auto' ? autoMode : setting;

  return {
    orientation,
    testamentsLayout,
    otColumns,
    ntColumns,
    // Backwards-compat alias: code that just wants "the column count" still
    // works. Equals otColumns; in stacked mode that's also the NT count.
    activeColumns: otColumns,
    displayMode,
    gridRef,
  };
}

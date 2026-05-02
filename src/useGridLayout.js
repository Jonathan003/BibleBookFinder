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

  // Longest TEXT per level, computed across BOTH languages so the auto
  // cascade is language-independent. If long names fit in NL but not in EN,
  // we drop to long abbreviations everywhere — the layout never flips on
  // language toggle. We need the actual STRINGS (not lengths) here because
  // the cascade measures their pixel width via canvas; "1 Thessalonicenzen"
  // and "1 Corinthians" are both 14+ chars but render very differently.
  const longestStrings = useMemo(() => {
    let full = '', long = '', short = '';
    for (const book of bibleBooks) {
      if (book.nl.length         > full.length)  full  = book.nl;
      if (book.en.length         > full.length)  full  = book.en;
      if (book.nlAbbrLong.length > long.length)  long  = book.nlAbbrLong;
      if (book.enAbbrLong.length > long.length)  long  = book.enAbbrLong;
      if (book.nlAbbr.length     > short.length) short = book.nlAbbr;
      if (book.enAbbr.length     > short.length) short = book.enAbbr;
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

    // Lazy canvas context — one per hook instance, reused across recomputes.
    // Canvas is never inserted into the DOM, just used as a measurement
    // engine. measureText() is fast (microseconds) and doesn't trigger
    // layout, so calling it on every resize is fine.
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const recompute = () => {
      // Measure the actual rendered cell — its font and padding determine
      // how much room text really has. We grab the first .book-cell as
      // representative; all cells in the grid share styling. If for some
      // reason there are no cells yet (initial mount race), bail and let
      // ResizeObserver retry once they appear.
      const sampleCell = gridEl.querySelector('.book-cell');
      if (!sampleCell) return;

      const cellStyle  = getComputedStyle(sampleCell);
      const cellWidth  = sampleCell.offsetWidth;
      const padLeft    = parseFloat(cellStyle.paddingLeft)  || 0;
      const padRight   = parseFloat(cellStyle.paddingRight) || 0;
      const available  = cellWidth - padLeft - padRight;

      // Match canvas font to cell font for accurate measurement.
      // The font shorthand combines weight, size, family — exactly what
      // measureText needs to produce pixel-accurate widths.
      ctx.font = cellStyle.font || `${cellStyle.fontWeight} ${cellStyle.fontSize} ${cellStyle.fontFamily}`;

      // Each level's longest string measured in real pixels in the real
      // font. Tiny safety margin (1px) to absorb sub-pixel rounding from
      // canvas vs DOM layout — without it, a string measured at exactly
      // `available` px sometimes overflows by half a pixel and triggers
      // an ellipsis or wrap.
      const fits = (text) => ctx.measureText(text).width + 1 <= available;

      let next;
      if (fits(longestStrings.full))      next = 'full';
      else if (fits(longestStrings.long)) next = 'long';
      else                                next = 'short';

      setAutoMode(prev => prev === next ? prev : next);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(gridEl);
    return () => ro.disconnect();
    // autoMode is in deps so the effect re-runs after each cascade decision.
    // This handles a subtle padding-mismatch bug in portrait: when autoMode
    // is 'short', the .using-abbreviations CSS rule kicks in (only in
    // portrait) and applies bigger padding to cells. We measure with that
    // bigger padding and decide e.g. 'long'. After re-render, the class is
    // gone, padding shrinks, MORE room is available for text — but
    // ResizeObserver does NOT fire because gridEl's own size didn't change
    // (only cell-internal padding did). Without re-measuring, we'd be stuck
    // on 'long' even though 'full' would now fit. The setAutoMode bail-out
    // (`prev === next ? prev : next`) prevents infinite loops: once the
    // cascade reaches a stable level, the same `next` is re-derived and no
    // state update fires. Convergence happens in at most 2-3 iterations.
  }, [gridEl, setting, measuredColumns, longestStrings, autoMode, ...extraDeps]);

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

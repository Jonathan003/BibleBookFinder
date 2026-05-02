import { useState, useEffect, useCallback } from 'react';
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
      ctx.font = cellStyle.font ||
        `${cellStyle.fontWeight} ${cellStyle.fontSize} ${cellStyle.fontFamily}`;

      // Find the widest single SEGMENT (substring between spaces) at each
      // level, across both languages. Multi-word names like "1 Thessalonicenzen"
      // wrap naturally at spaces; what matters is that the widest indivisible
      // word fits on a single line. CSS handles the wrap into 2 lines for the
      // few outliers that need it. The user-visible result matches what manual
      // 'full' mode produces (verified against user screenshot).
      //
      // Examples (in jw-library-style font ~13px):
      //   "Thessalonicenzen" → ~104px (widest segment in NL full)
      //   "Deuteronomium"    → ~85px
      //   "Solomon"          → ~45px
      //   "1"                → ~7px
      //
      // Single-word names ARE their own segment (e.g. "Klaagliederen").
      // No-spaces means no wrap is possible, so they must fit on one line.
      const widestSegment = (text) =>
        Math.max(...text.split(' ').map(s => ctx.measureText(s).width));

      let fullMax = 0, longMax = 0, shortMax = 0;
      for (const book of bibleBooks) {
        fullMax  = Math.max(fullMax,
          widestSegment(book.nl),         widestSegment(book.en));
        longMax  = Math.max(longMax,
          widestSegment(book.nlAbbrLong), widestSegment(book.enAbbrLong));
        shortMax = Math.max(shortMax,
          widestSegment(book.nlAbbr),     widestSegment(book.enAbbr));
      }

      // 1px slack to absorb sub-pixel rounding between canvas measurement
      // and DOM layout — without it a segment measured at exactly `available`
      // sometimes overflows by half a pixel and triggers wrap-mid-word.
      const fits = (segPx) => segPx + 1 <= available;

      let next;
      if (fits(fullMax))      next = 'full';
      else if (fits(longMax)) next = 'long';
      else                    next = 'short';

      setAutoMode(prev => prev === next ? prev : next);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(gridEl);
    return () => ro.disconnect();
    // autoMode is in deps so the effect re-runs after each cascade decision.
    // Handles the portrait padding mismatch: in 'short' mode the
    // .using-abbreviations CSS rule applies bigger padding (only in portrait).
    // After re-render with a higher mode, padding shrinks, more room is
    // available — but ResizeObserver does NOT fire (gridEl's own size hasn't
    // changed, only cell-internal padding). Re-running the effect catches
    // this. The setAutoMode bail-out (prev === next ? prev : next) guarantees
    // convergence in 2-3 iterations.
  }, [gridEl, setting, measuredColumns, autoMode, ...extraDeps]);

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

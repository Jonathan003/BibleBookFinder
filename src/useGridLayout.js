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

      // Padding is measured from the CELL (the cell controls horizontal
      // padding), but font is measured from the rendered TEXT element.
      // .book-name overrides .book-cell with font-size 0.85rem and
      // font-weight 500. Measuring against the cell's default 16px/400
      // font would overestimate text width by ~17% on Roboto/Inter and
      // reject layouts that actually fit comfortably — which is exactly
      // why S22+ landscape was previously stuck on 'long' even though
      // 'full' has plenty of room.
      const cellStyle = getComputedStyle(sampleCell);
      const textEl    = sampleCell.querySelector('.book-name') || sampleCell;
      const textStyle = getComputedStyle(textEl);

      const cellWidth = sampleCell.offsetWidth;
      const padLeft   = parseFloat(cellStyle.paddingLeft)  || 0;
      const padRight  = parseFloat(cellStyle.paddingRight) || 0;
      const available = cellWidth - padLeft - padRight;

      ctx.font = textStyle.font ||
        `${textStyle.fontWeight} ${textStyle.fontSize} ${textStyle.fontFamily}`;

      // Find the widest single SEGMENT (substring between spaces) at each
      // level, across both languages. Multi-word names like "1 Thessalonicenzen"
      // wrap naturally at spaces; what matters is that the widest indivisible
      // word fits in available × N_lines pixels. CSS handles the actual wrap
      // (overflow-wrap: break-word + -webkit-line-clamp: 2).
      //
      // Examples (in 0.85rem/500-weight font ~13.6px):
      //   "Thessalonicenzen" → ~96px (widest segment in NL full)
      //   "Thessalonians"    → ~84px (widest segment in EN full)
      //   "Deuteronomium"    → ~78px
      //   "Genesis"          → ~52px
      //   "1"                → ~7px
      //
      // Single-word names ARE their own segment (e.g. "Klaagliederen").
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

      // 2-line threshold. CSS allows up to 2 lines per cell
      // (-webkit-line-clamp: 2), so a segment fits as long as its width
      // ≤ 2 × available. Browser wraps at spaces preferentially via
      // overflow-wrap; the few segments wider than `available` itself
      // get broken mid-word as a fallback. This is much more permissive
      // than the previous strict-single-line check, which forced
      // landscape S22+ down to 'long' just because "Thessalonicenzen"
      // was 1-2px over the single-line budget.
      const fits = (segPx) => segPx <= 2 * available;

      // Cascade order depends on orientation:
      //
      // PORTRAIT — full → short, skipping 'long' on purpose.
      //   In portrait, 'short' mode triggers .using-abbreviations CSS,
      //   which makes cells square (aspect-ratio: 1/1) — the JW Library
      //   Study Bible look the user wants on phones. 'long' mode in
      //   portrait gives rectangular cells with text like "Klaagl." or
      //   "1 Chron." — neither the clean square look NOR the full names.
      //   Skipping 'long' means: if 'full' fits (tablet portrait), use it;
      //   otherwise fall back to 'short' (phone portrait → square cells).
      //
      //   This also fixes the rotation hysteresis bug: previously, after
      //   landscape→portrait, 'long' would persist because the smaller
      //   non-using-abbreviations padding made 'long' fit comfortably.
      //   With 'long' skipped in portrait, cascade settles correctly.
      //
      // LANDSCAPE — full → long → short.
      //   No .using-abbreviations engagement (the CSS is portrait-only),
      //   cells are rectangular regardless of mode. All three levels
      //   look fine; pick the most informative one that fits.
      let next;
      if (orientation === 'portrait') {
        next = fits(fullMax) ? 'full' : 'short';
      } else {
        next = fits(fullMax) ? 'full' : fits(longMax) ? 'long' : 'short';
      }

      setAutoMode(prev => prev === next ? prev : next);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(gridEl);
    return () => ro.disconnect();
    // Deps:
    // - orientation: rotation may not change column counts (e.g. portrait
    //   6 cols ↔ landscape stacked 6 cols), so we need it explicitly to
    //   trigger a re-cascade with the new orientation-aware order.
    // - autoMode: in 'short' mode the .using-abbreviations CSS rule
    //   applies bigger padding (portrait only). After re-render with a
    //   different mode, padding shrinks, more room is available — but
    //   ResizeObserver does NOT fire (gridEl's own size hasn't changed,
    //   only cell-internal padding). Re-running the effect catches this.
    //   The setAutoMode bail-out (prev === next ? prev : next) guarantees
    //   convergence in 1-2 iterations.
  }, [gridEl, setting, orientation, measuredColumns, autoMode, ...extraDeps]);

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

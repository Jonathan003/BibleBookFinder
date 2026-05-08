// The 5-box visual indicator that runs across the top of Box Mode.
//
// Layout philosophy (matches plan from research turn):
//   • Always horizontal, full-width across whatever container holds it
//   • 5 equal-width boxes, gradient from cool (Box 1, "needs work") to
//     warm amber (Box 5, "rooted")
//   • Each box shows its count + a small label
//   • On phone-portrait the labels collapse to just "1" "2" "3" "4" "5"
//     to save horizontal space; tablets keep the longer labels
//   • The "highlight" prop briefly amber-glows a destination box when a
//     book has just advanced into it, providing the per-correct-answer
//     dopamine hit without elaborate slide animations

import './BoxMode.css';

export default function BoxModeBoxes({ counts, highlightedBox = null, lang = 'nl' }) {
  // counts: array of length 5 from getBoxCounts(state)
  // highlightedBox: 1-5, or null. Caller clears it on a timer for the glow effect.
  const labels = lang === 'nl'
    ? ['Doos 1', 'Doos 2', 'Doos 3', 'Doos 4', 'Doos 5']
    : ['Box 1', 'Box 2', 'Box 3', 'Box 4', 'Box 5'];

  return (
    <div className="boxmode-boxes" role="group" aria-label={lang === 'nl' ? 'Voortgang in dozen' : 'Box progress'}>
      {counts.map((count, i) => {
        const boxNum = i + 1;
        const isHighlighted = highlightedBox === boxNum;
        const isTop = boxNum === 5;
        const isEmpty = count === 0;
        return (
          <div
            key={boxNum}
            className={`boxmode-box box-${boxNum}${isHighlighted ? ' highlight' : ''}${isEmpty ? ' empty' : ''}${isTop ? ' top-box' : ''}`}
          >
            <span className="boxmode-box-count">{count}</span>
            <span className="boxmode-box-label">{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Recent-answers strip — last 10 results as small dots.
 * Blue = correct, orange = wrong, hollow = not yet asked.
 */
export function BoxModeRecentDots({ recent, slots = 10 }) {
  // recent: array of { bookId, correct, ts }, oldest-first, length ≤ slots
  // We render right-aligned (most recent on the right) with empty slots filling left.
  const filled = recent.length;
  const empty = Math.max(0, slots - filled);
  return (
    <div className="boxmode-recent-dots" aria-hidden="true">
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e${i}`} className="boxmode-dot empty" />
      ))}
      {recent.map((r, i) => (
        <span
          key={`f${i}`}
          className={`boxmode-dot ${r.correct ? 'correct' : 'wrong'}`}
        />
      ))}
    </div>
  );
}

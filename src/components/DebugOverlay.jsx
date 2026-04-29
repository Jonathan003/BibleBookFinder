import { useEffect, useState, useRef } from 'react';

// Diagnostic overlay for the "cell stays differently colored after
// animation" bug on Galaxy S22+. Shows live what state the
// last-clicked cell is in: pseudo-classes, computed style, active
// element. If we see e.g. ":focus" stuck on the button, we know
// browser default focus styling is the cause. If ":hover" sticks,
// it's touch-emulated hover. If neither, it's React state staying
// stale or something else entirely.
export default function DebugOverlay({ feedback, correctBookId }) {
  const [info, setInfo] = useState(null);
  const lastClickedRef = useRef(null);

  // Track last-clicked book-cell. Use capture-phase so we beat React's
  // own click handler and the cell's :active state.
  useEffect(() => {
    const onPointer = (e) => {
      const cell = e.target.closest('.book-cell');
      if (cell) lastClickedRef.current = cell;
    };
    document.addEventListener('pointerdown', onPointer, true);
    return () => document.removeEventListener('pointerdown', onPointer, true);
  }, []);

  // Poll the tracked cell 4x/sec.
  useEffect(() => {
    const id = setInterval(() => {
      const cell = lastClickedRef.current;
      if (!cell) {
        setInfo({ noCell: true });
        return;
      }
      const cs = getComputedStyle(cell);
      const active = document.activeElement;
      // Try to detect pseudo-class state by querying matches
      let pseudos = [];
      try {
        if (cell.matches(':hover')) pseudos.push('hover');
      } catch {}
      try {
        if (cell.matches(':focus')) pseudos.push('focus');
      } catch {}
      try {
        if (cell.matches(':focus-visible')) pseudos.push('focus-visible');
      } catch {}
      try {
        if (cell.matches(':active')) pseudos.push('active');
      } catch {}

      setInfo({
        bookId: cell.getAttribute('data-book-id'),
        bgColor: cs.backgroundColor,
        filter: cs.filter,
        opacity: cs.opacity,
        color: cs.color,
        pseudos: pseudos.join(', ') || '(none)',
        activeIsThis: active === cell,
        activeTag: active ? active.tagName + (active.className ? '.' + active.className.slice(0, 20) : '') : 'none',
        feedback: feedback ?? 'null',
        correctBookId: correctBookId ?? 'null',
      });
    }, 250);
    return () => clearInterval(id);
  }, [feedback, correctBookId]);

  if (!info) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      color: '#0f0',
      fontFamily: 'monospace',
      fontSize: 11,
      padding: 6,
      lineHeight: 1.3,
      zIndex: 99999,
      pointerEvents: 'none',
    }}>
      {info.noCell ? (
        <div>Tap a cell to start tracking…</div>
      ) : (
        <>
          <div>cell: <b style={{ color: '#ff0' }}>{info.bookId}</b> | bg: <b>{info.bgColor}</b></div>
          <div>filter: {info.filter} | opacity: {info.opacity}</div>
          <div>color (text): {info.color}</div>
          <div>pseudo-classes: <b style={{ color: '#ff0' }}>{info.pseudos}</b></div>
          <div>doc.activeElement: {info.activeIsThis ? <b style={{ color: '#ff0' }}>THIS CELL</b> : info.activeTag}</div>
          <div>react.feedback: {info.feedback} | react.correctBookId: {info.correctBookId}</div>
        </>
      )}
    </div>
  );
}

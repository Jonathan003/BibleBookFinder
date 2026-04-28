import { useState, useEffect } from 'react';

// TEMPORARY: width diagnostic overlay. Remove once layout bug is fixed.
// Shows getBoundingClientRect().width for key elements so we can see
// exactly which container is constraining the grid on real devices.
export default function DebugOverlay() {
  const [info, setInfo] = useState({});

  useEffect(() => {
    const measure = () => {
      const get = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), x: Math.round(r.left) };
      };
      setInfo({
        window: window.innerWidth,
        body: get('body'),
        app: get('.app'),
        appMain: get('.app-main'),
        quizGrid: get('.quiz-grid'),
        quizBottom: get('.quiz-bottom'),
        section: get('.section'),
        bookGrid: get('.book-grid'),
        cell: get('.book-cell'),
        safeLeft: getComputedStyle(document.documentElement)
          .getPropertyValue('--safe-area-left') ||
          (CSS.supports('padding-left: env(safe-area-inset-left)')
            ? 'env supported'
            : 'no env'),
      });
    };
    measure();
    const id = setInterval(measure, 500);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  const fmt = (item) => {
    if (item == null) return 'null';
    if (typeof item === 'object') return `w:${item.w} x:${item.x}`;
    return String(item);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.85)',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: '10px',
        padding: '4px 6px',
        lineHeight: 1.3,
        pointerEvents: 'none',
        maxWidth: '50vw',
      }}
    >
      <div>win: {info.window}</div>
      <div>body: {fmt(info.body)}</div>
      <div>app: {fmt(info.app)}</div>
      <div>main: {fmt(info.appMain)}</div>
      <div>quiz: {fmt(info.quizGrid)}</div>
      <div>btm: {fmt(info.quizBottom)}</div>
      <div>sec: {fmt(info.section)}</div>
      <div>grid: {fmt(info.bookGrid)}</div>
      <div>cell: {fmt(info.cell)}</div>
    </div>
  );
}

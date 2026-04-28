import { useState, useEffect } from 'react';

// TEMPORARY: width diagnostic overlay v2. Compares window.innerWidth,
// 100vw, and 100dvw computed values — to test whether dvw reclaims
// more screen real estate than the standard viewport on Samsung.
// Remove once experiment is concluded.
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
      // Compute what 100vw and 100dvw evaluate to in CSS pixels
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;width:100vw;height:1px;left:0;top:-9999px;pointer-events:none;visibility:hidden';
      document.body.appendChild(probe);
      const vw = Math.round(probe.getBoundingClientRect().width);
      probe.style.width = '100dvw';
      const dvw = Math.round(probe.getBoundingClientRect().width);
      document.body.removeChild(probe);

      setInfo({
        innerW: window.innerWidth,
        vw,
        dvw,
        screenW: window.screen.width,
        body: get('body'),
        grid: get('.book-grid'),
      });
    };
    measure();
    const id = setInterval(measure, 500);
    return () => clearInterval(id);
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
      <div>innerW: {info.innerW}</div>
      <div>100vw: {info.vw}</div>
      <div>100dvw: {info.dvw}</div>
      <div>screen: {info.screenW}</div>
      <div>body: {fmt(info.body)}</div>
      <div>grid: {fmt(info.grid)}</div>
    </div>
  );
}

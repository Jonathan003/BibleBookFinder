import { useRef, useEffect, useCallback } from 'react';

// Reusable timeout manager. All timeouts scheduled via schedule()
// are automatically cleared when the component unmounts.
//
// Without this discipline, navigating away mid-session (Back, switch
// user, navigate to Settings) lets pending callbacks fire on an
// unmounted component — causing React state warnings and, worse,
// stale state writes that survive past their context.
//
// Usage:
//   const schedule = useTimeoutManager();
//   schedule(() => doSomething(), 500);
//
// Same signature as setTimeout, but cleanup is implicit.
export function useTimeoutManager() {
  const timeoutsRef = useRef(new Set());

  useEffect(() => {
    const set = timeoutsRef.current;
    return () => {
      set.forEach(clearTimeout);
      set.clear();
    };
  }, []);

  return useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timeoutsRef.current.delete(id);
      fn();
    }, ms);
    timeoutsRef.current.add(id);
    return id;
  }, []);
}

import { useState, useEffect, useMemo } from 'react';

// useMemo variant that periodically forces re-evaluation. Useful for
// computations that depend on the current time but where time is an
// implicit input (e.g. anything that calls `new Date()` internally).
//
// Without this hook, time-dependent memoized values become stale: they
// only recompute when their explicit deps change, but `now` keeps
// advancing. The result is that "Next book: within an hour" can keep
// showing long after "an hour" has passed, until something else triggers
// a render.
//
// Args:
//   fn         — the compute function (same as useMemo's)
//   deps       — explicit dependencies (same as useMemo's)
//   refreshMs  — how often to force re-evaluation, in ms.
//                Pass 0/null/undefined to disable the timer.
//   enabled    — gate to suspend ticking when the value isn't visible
//                (e.g. only refresh forecast while on the menu, not
//                inside Quiz/Settings). Saves a tick-cycle when hidden.
//
// Implementation: a hidden tick state is incremented on the interval;
// adding it to the useMemo deps forces re-evaluation. React batches
// the re-render so multiple useRefreshableMemo calls firing in the same
// frame produce a single render.
export function useRefreshableMemo(fn, deps, refreshMs, enabled = true) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled || !refreshMs) return undefined;
    const id = setInterval(() => setTick(t => t + 1), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs, enabled]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(fn, [...deps, tick]);
}

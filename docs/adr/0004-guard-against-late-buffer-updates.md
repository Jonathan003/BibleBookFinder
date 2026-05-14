# ADR 0004: Guard against late buffer updates after session-complete

## Status

Accepted

Date: 2026-05-14

## Context

After shipping commit 37 (ADR 0003 — immediate session-complete on 66 confident), the originally reported bug was still occurring: the user trained to 66/66, saw the 🏆 "All 66 confident!" prompt, clicked End session, and landed on home showing 65/66.

Debug instrumentation (commit 38) captured the exact timeline:

```
15:14:55.887 → 56.787   session-complete RENDER ×20 (all: refCount=66, stateCount=66)
15:14:56.884   updateConfidentBuffer  {bookId: 61, isGoodHit: false, prevCount: 66, nextCount: 65}
15:14:56.884   confidentCount useMemo  {count: 65}
15:14:56.887   session-complete RENDER  {isAll66: TRUE, refCount: 66, stateCount: 65, refMatchesState: FALSE}
15:14:56.890   confidentBuffersRef SYNC  {count: 65}
15:15:32.307   finishSession.start  {count: 65}   ← End clicked 35s later, already 65
```

A `updateConfidentBuffer(book 61, false)` call fired ~100ms AFTER the session-complete prompt appeared but BEFORE the user clicked End. This pushed `false` onto book 61's already-confident buffer, dropping the count from 66 to 65.

Root cause traced to the time-up tick interval in `QuizGrid.jsx` (the `useEffect` on `[timerStart]`). The interval runs every 100ms and on expiry pushes `false` onto the current target book's buffer. When commit 37's early-return in `pickNextBook` triggers `setSessionComplete(true)`, that does not cancel pending interval ticks — and the interval's closure has no knowledge of `sessionComplete` because the state value captured at effect-time may be stale.

Subtle artifact in the prompt render: `isAll66` is computed from `confidentBuffersRef.current`, not from the state. The ref is synced via a separate `useEffect` that runs AFTER the render commit, so for one render cycle the ref still showed 66 while the state was already 65 (the smoking gun: `refMatchesState: FALSE`). This is why the user saw the 🏆 prompt at all — the prompt rendered from stale ref data.

## Decision

Add a `sessionCompleteRef` that mirrors the `sessionComplete` state, and guard every buffer-update call site against firing when session-complete is active.

Implementation:

1. **`sessionCompleteRef = useRef(false)`** alongside other QuizGrid refs
2. **Sync `useEffect`** keeps the ref in step with the state: `useEffect(() => { sessionCompleteRef.current = sessionComplete; }, [sessionComplete])`
3. **Time-up tick interval** — primary fix: early-return if `sessionCompleteRef.current` is true, placed BEFORE the existing `feedbackRef`/`targetBook` defensive checks. This is the call site that actually fired the buggy update.
4. **`handleBookClick`** — defense-in-depth: early-return if `sessionComplete` is true. The book grid isn't rendered in session-complete state so a real click shouldn't reach here, but synthesised or queued events are guarded.
5. The correct/wrong-answer paths inside `handleBookClick` are now covered by the `handleBookClick`-level guard; no per-path duplication needed.

## Alternatives Considered

### Option A — Time-up ref guard only (CHOSEN, with defense-in-depth)

The minimum surgical fix. The time-up tick interval is the only confirmed firing-after-session-complete path; guarding it stops the bug. The `handleBookClick` guard is added as belt-and-braces with negligible cost.

### Option B — Cancel all pending timeouts when entering session-complete

In `pickNextBook` (and the resume-path 66-check), when calling `setSessionComplete(true)`, also call a `schedule.clearAll()` to kill all pending timeouts. **Rejected** because:

- `useTimeoutManager` doesn't expose `clearAll()` currently (would need to extend its API)
- The relevant interval is created in a `useEffect`, not via `schedule()` — clearing `schedule`'s timeouts wouldn't have stopped this specific bug
- Side-effect concerns: cancelling all timeouts could break other in-flight UI animations (scroll-to-book, prompt fade, etc.) in ways we can't predict

The ref-guard approach is more precise: it doesn't cancel work, it just makes sure side-effecting work checks the guard before acting.

### Option C — Move `isAll66` computation to read state instead of ref

The render-time `isAll66` is currently computed from `confidentBuffersRef.current`, which can be stale by one render cycle. **Rejected as the primary fix** because:

- The actual data divergence (state vs ref) is a symptom, not the cause
- Fixing the render alone would mean the prompt no longer shows 🏆 when the bug fires, but the count would still silently drop — worse UX (user trained to 66, no celebration appears)
- The ref-based read exists for good reasons elsewhere in the file (the tick interval, the pickNextBook check)

Once the buffer-update guard is in place, the ref/state divergence shouldn't occur in practice for this flow, so we leave the render code unchanged.

### Option D — Set `feedbackRef.current = true` when entering session-complete

The time-up handler already has an `if (feedbackRef.current) return` check. We could set `feedbackRef.current = true` in `pickNextBook` when triggering session-complete, reusing the existing guard. **Rejected** because:

- `feedbackRef` has a specific semantic ("the user has just received feedback on a question; block further interaction until acknowledged") that doesn't match session-complete
- Conflating the two states would make future maintenance harder (someone reads "feedbackRef.current = true" in pickNextBook and wonders what feedback was given)
- A dedicated `sessionCompleteRef` documents the intent clearly

## Consequences

### Positive

- **66/66 status is durable**: once reached and the celebration prompt appears, no late-arriving timer/click can de-confident a book before the user acts
- **Render-time data divergence is masked but not aggravated**: state and ref might briefly disagree, but with no late updates firing, both will converge to 66 by next render
- **Defense-in-depth**: handleBookClick guard catches any other code path that might queue a synthetic click while session-complete is showing
- **Cheap implementation**: one ref, one sync useEffect, two early-returns, ~12 lines including comments
- **No new external API**: `useTimeoutManager` untouched

### Negative

- **One more ref to keep in sync**: adds modest cognitive load when modifying QuizGrid. Mitigation: a clear inline comment explaining why the ref exists.
- **Doesn't fix the underlying interval-lifecycle issue**: tick intervals can still queue late callbacks; we just no-op them. A future refactor to clear the interval immediately on session-complete would be cleaner, but is out of scope here.
- **Late ticks still log/work partially**: `expiryFiredRef.current = true` and `clearInterval(interval)` execute before our guard. This is intentional — we want the interval cleaned up, just not the buffer-update side-effects.

## Review Trigger

Reopen this decision if:

- A new buffer-update call site is added that doesn't go through `handleBookClick` or the time-up handler (then it needs its own guard)
- `useTimeoutManager` gains a `clearAll()` method and option B becomes feasible — switching to that would let us delete `sessionCompleteRef`
- Telemetry (if added) shows continued reports of count discrepancies between session-complete and home — would mean another firing path exists

## Related

- v6 commit 39: implements the late-buffer-update guard
- v6 commit 38: debug instrumentation that pinpointed the firing path; removed in commit 39 once the fix landed
- ADR 0001: gold line philosophy — the ring buffer that this fix protects
- ADR 0002: time-up flow click-to-advance with minimum read window — the same time-up handler this fix guards against post-session-complete firing
- ADR 0003: immediate session-complete on 66 confident — the upstream change that exposed this latent race condition

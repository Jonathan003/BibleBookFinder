# ADR 0007: Time-up uses the same click-to-advance flow as wrong-answer

## Status

Accepted (supersedes ADR 0002)

Date: 2026-05-15

## Context

ADR 0002 introduced a 1500ms minimum read window (`TIME_UP_DISPLAY_MS`) on the time-up flow: after the blue cell is revealed, taps during the first 1500ms are silently ignored, so the user is forced to see the "⏱ Te traag — was X" / "Time's up — was X" label long enough to read it. The wrong-answer flow has no such gate — a tap on the revealed blue cell advances immediately.

The asymmetry was meant to address a specific pre-commit-34 bug: when the timer expired while the user's finger was already moving toward the correct cell, the tap arrived 0-50ms after the reveal and the screen advanced before the user could read what the answer was. The 1500ms window guaranteed legibility regardless of tap timing.

In real use the trade-off didn't hold up. ADR 0002 explicitly anticipated this in its Review Trigger #3: *"Accessibility testing surfaces issues with the silent-no-op behavior (users tapping repeatedly thinking the button is broken)."* That's exactly what happened. The user reported (2026-05-15):

- After my zip introduced the soft-reset path (ADR 0005), the picker started surfacing weaker FSRS-due books more frequently, causing time-ups to happen more often.
- On those time-ups, the first tap was silently ignored. The user perceived this as a regression: *"It works correct for when I click the wrong book — I only have to push the blue box once. Only when too late I have to push the blue box twice."*
- The user explicitly proposed: *"Maybe it can be fixed that way. To let it work the same way as when clicking a wrong book. With different text of course."*

The underlying observation is correct. The two flows do roughly the same thing — show a blue reveal, the user taps it to advance — and the asymmetry was a workaround for a specific edge case, not a deliberate design feature the user cares about. The cure was worse than the disease.

## Decision

**Time-up uses the identical click-to-advance flow as wrong-answer.** The minimum read window is removed entirely. Only the prompt text differs:

- Wrong-answer: "❌ Fout — was X" / "❌ Wrong — was X"
- Time-up: "⏱ Te traag — was X" / "⏱ Time's up — was X"

Mechanically: the `feedback === 'time-up'` branch inside `handleBookClick` is removed. Both feedback states fall through to the same advance code. The `TIME_UP_DISPLAY_MS` constant and the `timeUpAtRef` ref become dead code and are removed.

**Applied symmetrically to both Quiz Mode and Box Mode**, matching the symmetry ADR 0002 originally established. Both `src/components/QuizGrid.jsx` and `src/components/BoxMode.jsx` get the same treatment: constant removed, ref removed, time-up branch in their `handleBookClick` collapsed into the wrong-answer branch.

## Alternatives Considered

- **Shorten the window to 500ms** (what I initially proposed). Rejected because the user explicitly asked for symmetric behaviour with wrong-answer, not a different timing. Any non-zero gate still leaves a special case that has to be explained, which is the design noise the user wanted gone.
- **Auto-advance after a fixed duration** (ADR 0002's Option A2 from v6 commit 34). Already rejected in v6 commit 35 for breaking the consistent "you tap to acknowledge" mental model. Not reconsidered.
- **Visual indicator during the window** ("waiting…" affordance so the silence isn't unexplained). Rejected — added UI complexity for a brief moment, and the user's actual ask was to remove the asymmetry, not to communicate it better.
- **Keep the 1500ms window as configured behaviour with a settings toggle**. Rejected as over-engineering for a binary preference the user has now expressed twice (once when ADR 0002 was first written, once now).

## Consequences

### Positive

- Time-up and wrong-answer have identical interaction: see the reveal, read the prompt, tap the blue cell to advance. Single mental model.
- No silent no-op behaviour. Every tap on the reveal advances. The "is this button broken?" failure mode is gone.
- Less state to maintain. `TIME_UP_DISPLAY_MS` constant and `timeUpAtRef` ref removed; the time-up tick handler no longer needs to record a timestamp.
- Pairs naturally with the soft-reset model (ADR 0005), which surfaces time-up scenarios more frequently. The previously-rare path is now a common path, and treating it identically to wrong-answer keeps it from feeling like a special case.

### Negative

- The original pre-commit-34 bug (tap-already-in-motion lands 0-50ms after reveal, advances before the prompt can be read) is back as a theoretical edge case. Acceptable because:
  - It only matters when the user was *about to tap the correct book themselves* (they already knew the answer), so the prompt's information value is low in that case.
  - If they were about to tap a wrong book, that tap falls through `feedbackRef.current && book.id === correctBookId` and gets ignored by the `if (feedbackRef.current) return;` guard, exactly as before.
  - In practice the tap-already-in-motion case is rare; the user reports it doesn't happen at all in their use of the wrong-answer flow, which has the same shape.

## Review Trigger

Reopen if:

- A user reports skipping past the time-up prompt without reading it and missing the answer
- Accessibility testing surfaces a different issue with the immediate-advance flow (e.g., screen reader users who need the reveal to persist longer)
- The prompt text or layout changes in a way that makes the "was X" label genuinely hard to read at a glance

## Related

- ADR 0002 — Time-up flow: click-to-advance with minimum read window (superseded by this ADR — the click-to-advance part stays, the minimum window is removed)
- ADR 0005 — Soft-reset for "Start a new run" (surfacing more weak books made the time-up gate more visible in real use, triggering this revision)
- Code: `handleBookClick` in `src/components/QuizGrid.jsx` and `src/components/BoxMode.jsx` (both modes updated symmetrically)
- User report: 2026-05-15 chat session, "It works correct for when I click the wrong book"

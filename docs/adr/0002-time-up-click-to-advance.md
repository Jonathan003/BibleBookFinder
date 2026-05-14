# ADR 0002: Time-up flow — click-to-advance with minimum read window

## Status

Accepted

Date: 2026-05-14

Note: this decision shipped, was reverted, and re-shipped within a 24-hour window. v6 commit 34 implemented the auto-advance approach (option A2 below); v6 commit 35 reverted to the design described here (option A1) after the user reported it felt inconsistent with the wrong-answer flow.

## Context

When the Quiz Mode or Box Mode timer expires before the user answers, the asked book lights up blue and the prompt changes to "⏱ Te traag — was Markus" / "Time's up — was Mark". This is the **time-up** state.

In the original implementation (pre-commit-34), the user had to tap the revealed blue cell to advance to the next question. A bug surfaced during real-app testing: the user's tap could arrive 0-50ms after the reveal (their finger was already moving toward the book they'd just located when the timer expired). The dismiss-via-tap path fired immediately on this tap, advancing to the next question before the user had any chance to read the prompt label or register the blue color.

The user reported: "I clicked the correct book but it wasn't blue, and went automatically to the next question. It went so fast I couldn't read what it was."

The bug forced a design question: should time-up use auto-advance with a fixed duration (commit 34's first attempt), or stay click-to-advance with a guard preventing premature dismissal (commit 35's revert)?

## Decision

**Time-up uses click-to-advance**, like the wrong-answer flow. The blue reveal stays on screen indefinitely until the user taps the highlighted book. There is no auto-advance timer.

**But: a minimum read window of 1500ms is enforced.** During this window, taps on the revealed book are silently ignored. After the window, taps work normally and advance the session.

This applies symmetrically to Quiz Mode and Box Mode (both files implement the same pattern via `timeUpAtRef` and the conditional check in their respective `handleBookClick`).

The wrong-answer flow has no minimum window — that flow is an active learning acknowledgment (user tapped wrong → correct book is revealed → they tap it to confirm). The user has already processed the feedback before tapping.

## Alternatives Considered

### Option A1 — Click-to-advance with minimum window (CHOSEN)

Reveal stays. Tap works only after 1500ms. User retains control over pacing.

### Option A2 — Auto-advance with fixed 1500ms duration

Reveal stays for 1500ms then automatically moves on, no tap needed. Initially chosen in commit 34, reverted in commit 35.

Rejected on the merits: the user reported preferring explicit acknowledgment for both wrong and time-up. The mixed model (auto-advance for time-up + click-to-advance for wrong) introduced an inconsistency the user found jarring. Uniform click-to-advance matches the mental model "I should always confirm I saw the answer".

### Option B — Visual countdown indicator with auto-advance

Auto-advance plus a visible progress bar showing time-until-advance. Rejected as additional UI complexity for a brief moment, and didn't address the user's preference for explicit acknowledgment.

### Option C — All scenarios auto-advance (including wrong)

Auto-advance everything for consistency. Rejected because wrong-answer feedback is an active learning moment: the user benefits from the physical action of finding and tapping the correct book. Removing that would weaken the pedagogical value.

## Consequences

### Positive

- **Pacing consistency**: wrong and time-up both require explicit tap to advance. The user's mental model is unified.
- **Read window guarantees legibility**: 1500ms is grounded in Material Design's LENGTH_LONG (also 1500ms), reading-speed estimate (~50ms × 30 characters for the prompt), and Anki's "Time to show answer" default range.
- **Tap timing no longer matters**: a tap arriving 50ms after the reveal vs 5 seconds after produces the same result (taps before 1500ms are no-ops). The bug that prompted this work is structurally fixed.

### Negative

- **User must actively tap to advance**, even when not engaged. A user who walks away mid-session will see the reveal stuck until they return and tap.
- **The 1500ms wait can feel sluggish** to users wanting fast pacing. Counter-argument: target users for time-up are by definition the ones who weren't fast — pacing for them is already slow by context.
- **Implementation requires a timestamp ref** (`timeUpAtRef`) plus a conditional in the dismiss path. Slightly more state than auto-advance would need.

## Review Trigger

Reopen this decision if:

- Users with fast target times (2-3 seconds) report the 1500ms wait feels disproportionate
- Mobile UX patterns shift such that auto-advance becomes the dominant user expectation for similar reveals
- Accessibility testing surfaces issues with the silent-no-op behavior (users tapping repeatedly thinking the button is broken)

## Related

- v6 commit 34: Original auto-advance implementation (option A2, superseded by 35)
- v6 commit 35: Revert to click-to-advance with read window (option A1, current implementation)
- Research during commit 34 development: Material Design snackbar timing, rhythm game judgment systems (Beat Saber, DDR, Rhythm Heaven), Anki/SuperMemo/RemNote feedback patterns

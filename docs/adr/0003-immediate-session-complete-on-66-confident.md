# ADR 0003: Quiz Mode flow on reaching 66 confident — immediate session-complete

## Status

Accepted

Date: 2026-05-14

## Context

In Quiz Mode, the user trains toward all 66 books being confident (gold-lined). Pre-commit-37 behaviour:

1. User reaches 66 confident during normal play
2. Quiz continues silently into a **maintenance branch** (lowest-FSRS-stability books, see `QuizGrid.jsx` v4.3 maintenance branch comment)
3. Maintenance branch asks each of the 66 books once more
4. Only after all 66 maintenance questions have been answered does the session-complete prompt appear with the 🏆 "All 66 confident!" celebration

The problem: during the silent maintenance round, a single slow-correct answer pushes `false` into that book's ring buffer, dropping it from confident. The 66/66 state is therefore fragile — the user may briefly hit 66 but lose it during maintenance without realising. They then see the session-complete prompt (potentially without the 🏆 if they're now at 65/66), or share their progress from home and find 65/66 instead of the 66/66 they thought they had.

Reported by the user 2026-05-14 with a screenshot showing 65/66 on home after training to "all 66" in quiz and sharing. The 14 Familiar + 52 Rooted FSRS tier breakdown summed to 66 (FSRS data intact), but the ring-buffer-based confident count was 65. Per ADR 0001 these are deliberately decoupled signals, so the count discrepancy is correct — but the user's experience of "I reached 66, then immediately lost it" was a real UX failure.

## Decision

When the user reaches 66 confident, **immediately trigger the session-complete screen** with the 🏆 celebration. No silent maintenance round in between.

Implementation:
- A new `hasTriggeredSixtySixRef` tracks whether the celebration has fired in this session
- `pickNextBook` checks at the start of the function: if `confidentCount === 66` and the ref is false, set `sessionComplete = true` and the ref to true, return immediately
- On paused-session resume: after restoring snapshot state, if `confidentCount === 66`, immediately trigger sessionComplete (skip the resumed question entirely — the user already had 66 when they paused, no need to ask them anything before celebrating)
- "Continue training" deliberately does NOT reset the ref — once the user has acknowledged the celebration and chosen to continue, they've accepted the maintenance-and-risk trade-off. Books briefly re-reaching 66 during maintenance should not re-fire the celebration in the same session.

## Alternatives Considered

### Option A1 — Immediate session-complete (CHOSEN)

The minimum-friction fix that preserves the 66/66 moment as a discrete achievement before the user has any opportunity to lose it.

### Option B — Warning banner in maintenance mode

Show a visible "⚠️ Maintenance mode — a slow answer can cost your 66 status" banner once the user reaches 66 and continues into maintenance. **Rejected**: visually noisy, doesn't actually solve the fragility — it just informs the user that the system is fragile. The user reported finding the current behaviour "storing" (disturbing), not "informational gap" — telling them louder doesn't fix it.

### Option C — Freeze ring buffer updates during maintenance

In maintenance branch, do not call `updateConfidentBuffer` regardless of answer correctness/speed. **Rejected** despite initial user preference because:

- Creates conceptual inconsistency: the ring buffer is defined as "the user's last 3 attempts" (ADR 0001), so suspending it in one branch makes the rule context-dependent and harder to explain
- Removes useful signal: a user practising for genuine reinforcement benefits from buffers updating even in maintenance — they may want to see which books are weakening
- Doesn't address the underlying issue (silent transition into maintenance with no celebration trigger)

### Option D — Manual maintenance opt-in

After reaching 66, show a prompt with three options: End, Continue (resume normal flow), Maintenance (explicit). **Rejected** as overkill for a solo learning app. Two options (End/Continue) is sufficient — the user understands "Continue" carries implicit risk per the celebration moment.

## Consequences

### Positive

- **66 is a stable wins-moment**: once reached, it cannot be silently lost
- **Share button behaviour is predictable**: what you see at end-of-quiz matches what you see on home
- **Mental model is simple**: reaching 66 = explicit choice point (End / Continue)
- **Minimal code change**: one ref, one early-return in `pickNextBook`, one post-restore check; ~25 lines of code total
- **ADR 0001 untouched**: the ring buffer's "reflects recent performance" semantic is preserved — buffers still update normally in maintenance when the user chooses Continue

### Negative

- **One extra acknowledgment step**: a user who would have happily kept training through the maintenance round must now actively choose Continue. Mitigated: this is the explicit-choice tradeoff and the user reported it as desirable, not as friction.
- **FSRS-due books at 66 are deferred**: if the user reaches 66 confident but also has FSRS-due books (rare — typically retention drops on previously-confident books takes weeks of inactivity), the session-complete fires before those due books are asked. The user can choose Continue to address them. Acceptable: the 66 confident milestone is a stronger UX signal than mid-stream FSRS due-card servicing.
- **Continue-training during maintenance carries asymmetric risk**: once celebrated, the user can drop to 65 in maintenance and the next time they reach 66 in the same session, no re-celebration. By design — but worth flagging to future contributors that this asymmetry exists.

## Review Trigger

Reopen this decision if:

- Users report frustration with the explicit-choice prompt (e.g. "I just wanted to keep going")
- Telemetry (if added) shows users tap Continue >> End by a wide margin, suggesting the prompt adds friction without value
- The maintenance-branch logic is removed entirely (e.g. switching to a strict "quiz ends on 66" model), at which point this ADR would be superseded

## Related

- v6 commit 37: implements the immediate session-complete trigger
- v6 commit 22: streak FAQ rewrite documenting the per-session-not-daily streak model
- ADR 0001: gold line philosophy (no daily streak, no time-decay, no refresher indicator) — explains why the ring buffer and FSRS tier are decoupled signals
- ADR 0002: time-up flow (related pattern of "preserve a user-facing moment for legibility before allowing dismissal")
- Initial pre-37 v4.3 maintenance branch design: see `QuizGrid.jsx` `pickNextBook` comments

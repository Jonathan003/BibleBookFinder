# ADR 0008 — Speedrun-only Quiz Mode model

**Status:** Accepted

**Date:** 2026-05-15

## Context

ADR 0005 introduced the soft-reset for "Start a new run" and removed the home-screen dueNow chrome ("X books need attention today"). The intent was to collapse the user-facing model toward a speedrun shape: race to 66 / 66 confident, soft-reset, race again. The FSRS engine continued to do the long-term scheduling underneath.

However, ADR 0005 stopped halfway. The in-quiz session-complete screen at 66 / 66 kept two buttons — `Continue training` and `End session` — preserving an implicit "maintenance mode" where the user could keep answering after reaching 66 (gold lines would drift off and back on as FSRS reviews surfaced books). The Settings page also gained a separate `Reset confident progress` entry point for the soft reset. The result was three semantically overlapping operations:

1. `Discard paused session` on the home screen — drops the in-session bookmark only, preserves confident progress
2. `Reset confident progress` in Settings — drops confident progress, preserves FSRS / best times / history
3. `Start a new run →` on the celebration card — soft-reset and immediately re-enter Quiz Mode

Plus a fourth path inside the active session — `Continue training` — that kept the user training after 66 without resetting anything, with gold lines mutating over the continued session.

User testing surfaced that this multi-path model created confusion rather than choice:
- The realistic reason a user discards a paused session is "this run went badly, I want to start over." There is no real-world use case for "drop the bookmark but keep partial gold lines." The current behavior bundles a small action with surprising preservation semantics.
- A button with only one viable choice ("Done" / "End session" when only `End session` makes sense) is friction, not affordance. Anki community feedback on AnkiDroid (Github #15349) explicitly identifies the equivalent "Congratulations" screen as breaking rhythm: users want any gesture to dismiss, not a button to find.
- "Continue training" after 66 is a maintenance affordance the speedrun framing doesn't need. The speedrun loop *is* the maintenance loop — each new run biases the picker toward weak books via FSRS, so re-racing accomplishes the same long-term retention with a cleaner mental model.

## Decision

Commit fully to the speedrun-only model for Quiz Mode. One goal (66 / 66 confident), one loop (race → celebrate → start over → race), one path for each user intent.

Concretely:

1. **In-quiz celebration screen** at 66 / 66 contains the trophy, "All 66 books confident!" title, total time, and the Share button. No bottom action buttons. The standard back-arrow header is the sole exit (it absorbs the prior `End session` button's bookkeeping: save the segment, clear any stale paused-session snapshot, then navigate home).
2. **`Continue training` button removed.** The maintenance-mode Branch 4 picker path and `handleContinueTraining` callback are eliminated as dead code under the new model.
3. **`Discard paused session` button → `Start over` / `Opnieuw beginnen`.** Tapping it now performs the full soft reset (clears `confidentBuffers`, `totalQuizMs`, `pausedQuizSession`, re-snapshots `masteryMsAtStart`) — the same payload as `doStartNewRun`. The label is honest about the broader semantics.
4. **`Reset confident progress` Settings entry removed.** Soft reset is now reachable via two paths only: the `Start over` button (when a paused session exists) and the `Start a new run →` launcher on the celebration card (at 66 / 66).
5. **`Today: X books · Y sessions · Z trained` daily-stats line removed** from the celebration screen. In a speedrun model the run time is the meaningful number; daily aggregates are noise that compete with the milestone.
6. **Non-`isAll66` branch of the session-complete screen removed.** Under the new model `sessionComplete` only fires at 66 / 66 (the maintenance-Branch-4 path that produced the "Session complete" < 66 variant is gone).

## Alternatives considered

**Alternative A: Keep all three entry points.** The original state after commit `5c69e27`. Maximum flexibility, but the dual semantics of `Discard paused session` ("bookmark only" vs "soft reset") are an ongoing source of confusion. Rejected: the flexibility serves no real user — the bookmark-only discard has no genuine use case.

**Alternative B: Bundle Discard with soft reset (this ADR), keep the Settings entry as a safety net.** Solves the discard-semantics problem but maintains three paths for one operation. The Settings entry would cover the user at 30 / 66 with no paused session who wants to wipe — a narrow case. Rejected: the speedrun model says runs end at 66 and loop; mid-run wipes are outside the model and the workaround (start a session, pause immediately, Start over) is acceptable for that edge case.

**Alternative C: Auto-advance from celebration after N seconds.** Considered for the no-button celebration screen but rejected. Users want to dwell on a milestone; auto-advance is patronizing. Premium-game research (Celeste, Hollow Knight) favors player-controlled exit; the AnkiDroid community echoes this.

**Alternative D: Single `Continue` / `Done` button on celebration (Duolingo pattern).** Duolingo justifies a single button because its lessons are transient steps along a path. BBF's 66 / 66 is a *milestone*, not a step. A single-action button on a milestone reads as friction (Github #15349). Rejected.

**Alternative E: Tap-anywhere-to-dismiss.** Considered as an additional low-friction exit layered on top of the back arrow. Deferred — implementation complexity (event handling around the Share button) outweighs benefit when the back arrow is already familiar chrome.

## Consequences

**For users:**
- A single coherent loop: race → celebrate → Start over → race. No "what does this button do" ambiguity.
- No way to "keep training" after 66 within the same session; the user must Start over for further training. This is intentional — the loop is the maintenance.
- Mid-run wipes (e.g., at 30 / 66 with no pause) require the pause-then-Start-over workaround. Acceptable for the edge case the model doesn't directly support.

**For FSRS:**
- No change. FSRS state (stability, difficulty, due dates) is independent of the confident buffer and the session lifecycle. Soft-resetting between runs is mathematically safe — runs become natural "practice cycles" and inter-run calendar time advances FSRS due-dates normally. See ADR 0005 for the per-field rationale.

**For code:**
- Removes `handleContinueTraining`, `handleEndSession`, `finishSession` callbacks and the maintenance-mode Branch 4 of `pickNextBook`. Removes the soft-reset entry from Settings + the `onStartNewRun` prop wiring. Cleans up unused strings (`sessionCompleteContinue`, `sessionCompleteFinish`, `sessionCompleteTitle`, `sessionCompleteTodayLabel`, `sessionCompleteBooks`, `sessionCompleteSessions`, `sessionCompleteSessionSingle`, `sessionCompleteMinutes`, `sessionCompleteTrainedLabel`, `sessionCompleteRestTitle`, `sessionCompleteRestBody`, `resetConfidentProgress`, `confirmResetConfidentProgressMsg`). Net delta: deletion-heavy, no new abstractions.

**For Help documentation:**
- The previous "DO NOT reset via Settings → Data — just keep training" guidance is now wrong on two counts (the Settings reset path is gone for confident-only resets; "keep training" via Continue training is gone). Help.jsx Q&As around "what happens at 66" and "what does the Share button do" need rewriting to point at the new flow. Q&A around pause/discard needs rewriting to reflect Start over's broader semantics. Tracked in the Help restructure commit accompanying this ADR.

## Relation to prior ADRs

- **Supersedes part of ADR 0005**: ADR 0005's framing of `Continue training` as the post-66 maintenance path is replaced by the speedrun-only loop. ADR 0005's soft-reset definition itself (`doStartNewRun` payload, FSRS preservation, three reset semantics layered above) remains in force — this ADR just narrows the entry points.
- Consistent with **ADR 0006** (hint usage doesn't penalize rating) and **ADR 0007** (time-up matches wrong-answer flow): all three are simplifications driven by the same principle — collapse to one coherent model, eliminate decision-points the user doesn't benefit from making.

# ADR 0005: Soft-reset semantics for "Start a new run"

## Status

Accepted

Date: 2026-05-15

## Context

`doResetQuizProgress` historically performed a single destructive operation: wipe all Quiz Mode user data (FSRS cards, confident buffers, paused session, best times, training time, history). Two UI entry points called it:

1. **Settings → Reset Quiz progress** — intentional "I'm starting completely over" action with explicit confirmation panel.
2. **Celebration screen "Start a new run"** — sporting "race the clock again" action with two-tap confirmation on the same button.

Both paths landed at the same `doResetQuizProgress()` implementation, so they produced identical effects despite their different framing and intent.

Two problems emerged from this:

1. Users running BBF as a speedrun loop (race to 66, race again) were throwing away long-term FSRS scheduling on every replay. The Anki community considers full SRS reset an explicit anti-pattern — quoting an ex-Anki support engineer at controlaltbackspace.org: *"Resetting history is the spaced-repetition equivalent of burning your house down and rebuilding it because it needs a few thousand dollars in repairs."* BBF was forcing exactly that pattern on every celebration replay.

2. The home screen at 66/66 confident showed two visually similar "start" actions ("Start a new run" inside the celebration card, "Start Quiz Mode →" as the bottom launcher) plus a duplicate Share button. Users couldn't tell which start button did what — a Hick's-law violation that the always-speedrun model resolves at the source by collapsing to one launcher.

Research surveyed during the discussion (2026-05-15):

- **Skritter** has a "Time Attack" mode that doesn't touch SRS scheduling at all — a separate speedrun-style activity with its own leaderboard, demonstrating the pattern works in a production SRS app.
- **Anki Filtered Decks** offer an explicit "Reschedule cards based on my answers" toggle for ad-hoc study sessions, exposing the soft-vs-hard distinction as a user setting.
- **Game design "New Game Plus"** (coined by Chrono Trigger 1995) is the established 30-year-old pattern: keep stats/skills, reset world state. BBF's soft reset maps onto NG+ semantics exactly — FSRS as "stats," gold lines as "world state."
- **Lords of the Fallen** (patch 1.1.224) added a "same-difficulty replay" option specifically because users wanted a lighter-weight retry distinct from full NG+, confirming the appetite for graduated reset semantics.

## Decision

Split `doResetQuizProgress` into two named functions with distinct semantics, and rewire the home-screen launcher so the 66/66 celebration screen no longer contains a separate reset button.

1. **`doResetQuizProgress()` — hard reset.** Called by Settings → Reset Quiz progress. Wipes everything Quiz-related. Behavior unchanged.

    Fields cleared: `bestStreak`, `quizHistory`, `fsrsCards`, `confidentBuffers`, `pausedQuizSession`, `bestTimes`, `masteryMsAtStart` (re-snapshot from current `targetSpeedMs`), `totalQuizMs`.

2. **`doStartNewRun()` — soft reset.** Called by the home-screen launcher when `confidentCount === 66`. Clears only the in-run metrics that need to reset for a new race, preserving long-term scheduling and lifetime per-book bests.

    Fields cleared: `confidentBuffers`, `pausedQuizSession`, `masteryMsAtStart` (re-snapshot), `totalQuizMs`.

    Fields preserved: `fsrsCards` (long-term FSRS scheduling), `bestTimes` (per-book personal bests), `bestStreak` (lifetime longest correct-and-fast streak), `quizHistory` (audit trail).

3. **Home-screen launcher relabels at 66/66.** The bottom Start button reads "Start Quiz Mode →" below 66 and "Start a new run →" at 66. The 66 label calls `doStartNewRun()` before launching. The inline "Start a new run" button inside the celebration card is removed entirely; the celebration card now contains only the Share action.

4. **Removed UI affordances.** The corner share icon (`share-icon-btn-panel`) is hidden at 66/66 — its intent comment already documented this but the conditional only wrapped the panel header. The dueNow-flavored hint variants ("X books could use attention today") are removed; only the first-time onboarding hint remains.

Per-field rationale for the soft reset:

- **`fsrsCards`** — keep. The whole point of the split. FSRS scheduling represents months of calibration; throwing it away on every replay is the Anki-community-flagged anti-pattern.
- **`confidentBuffers`** — clear. Need 66 books without gold lines for a race-to-66 to be meaningful.
- **`totalQuizMs`** — clear. Represents *this run's* training time; the metric to beat on the next run.
- **`pausedQuizSession`** — clear. A new run shouldn't resume an old session mid-stream.
- **`masteryMsAtStart`** — re-snapshot from current `config.targetSpeedMs`. Records the speed target THIS run was run against, in case the user changed `targetSpeedMs` between runs.
- **`bestTimes`** — keep. Per-book best response times accumulate as a lifetime improvement axis orthogonal to the speedrun goal. Losing them to a soft reset would discard hard-won per-book speed gains.
- **`bestStreak`** — keep. Same family as `bestTimes`: a lifetime metric, not a per-run metric.
- **`quizHistory`** — keep. Used for in-session "today" stats and as an audit trail. Wiping it has no upside.

## Alternatives Considered

- **A flag parameter** (`doResetQuizProgress({ keepFsrs: true })`). Rejected: less self-documenting at call sites, easier to pass the wrong flag from the wrong button. Two named functions match the project's existing pattern (`doResetBoxProgress`, `addTrainingTime`).
- **Keep "Start a new run" as a hard reset, add a third "Soft restart" option.** Rejected: fragments rather than clarifies. The celebration screen needs one replay path, not two.
- **Relabel the buttons but keep both visible** ("Start a new run" inside celebration + "Maintain →" as bottom launcher when `dueNow > 0`). Rejected after considering Hick's law: even with distinct labels, two visually similar "Start" actions on one screen create decision friction. The always-speedrun model removes the maintenance path from the home screen entirely (FSRS still drives book selection within a run, just not as a separate user-facing mode).
- **Skritter's pure-preview model** (speedrun doesn't update FSRS at all). Rejected: Skritter has thousands of cards and isolates Time Attack from scheduling for that reason. BBF has 66 cards, so every answer is valuable FSRS calibration data — the speedrun should keep feeding the scheduler.

## Consequences

### Positive

- Long-term FSRS scheduling survives speedrun replays. After multiple runs the picker is increasingly biased toward weak books (FSRS knows where the user struggles), making each new race genuinely targeted training rather than a fresh-start exercise.
- Home screen at 66/66 has exactly one quiz action (the bottom launcher) instead of three (corner share + celebration share + celebration reset + bottom launcher). Matches the tab-selector + unified-launcher pattern used elsewhere.
- Settings → Reset Quiz progress and the home-screen launcher's 66/66 behaviour become semantically distinct rather than redundant.
- Aligns BBF with established SRS and game-design patterns (Anki Filtered Decks, Skritter Time Attack, NG+).

### Negative

- The picker behavior on a soft-reset run is implicitly harder than on a fresh hard-reset run (FSRS biases toward weakest books rather than randomly serving unseen ones). Users may notice that "subsequent runs feel tougher" — but this is correct, and arguably the point.
- Existing strings `celebration66Reset` and `celebration66ResetConfirm` become unused. Left in `data.js` for now to keep the diff focused; can be removed in a follow-up cleanup.
- One more function to keep in sync if the user-data shape ever changes. Mitigated by per-field rationale documented above — adding a new field requires deciding which bucket it lives in.

## Review Trigger

Reopen if:

- Users report confusion about why the run feels different from the first time
- A user-data field's semantics change such that "preserved across soft reset" needs reconsideration (e.g., adding a per-run timestamp field, or a lifetime training counter separate from `totalQuizMs`)
- The Quiz Mode user-data model adds new fields and the per-field triage above isn't updated to cover them
- A run-history feature (last N completed runs with timestamps) is added — at that point the relationship between `totalQuizMs` and run history needs spelling out

## Related

- ADR 0001 — Gold-line philosophy (defines confident buffer semantics)
- ADR 0003 — Immediate session-complete on 66 confident (defines the celebration trigger)
- ADR 0006 — Hint usage does not affect FSRS rating or gold-line credit (parallel decision about what counts as confident)
- Code: `doResetQuizProgress` and `doStartNewRun` in `src/App.jsx`
- Research:
  - controlaltbackspace.org — "Catching Up On Your Anki Reviews" (the Anki-reset-as-house-burning quote)
  - docs.ankiweb.net/filtered-decks.html — Anki's Reschedule-cards-based-on-my-answers toggle
  - docs.skritter.com — Time Attack mode description
  - en.wikipedia.org/wiki/New_Game_Plus — NG+ pattern history
  - thelordsofthefallen.wiki.fextralife.com/New+Game+Plus — patch 1.1.224 graduated-reset rationale

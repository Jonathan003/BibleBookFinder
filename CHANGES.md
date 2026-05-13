# v6 commit 29 — Catch up CHANGES.md (entries for commits 11 through 28)

## What changed

This commit adds CHANGES.md entries for the 18 commits since commit 10. Same pattern as v6 commit 11's earlier catch-up of 6.3 through 10. Entries here are listed newest-first, matching the rest of this file.

## Why this matters

A CHANGES.md that lags behind the actual commit log is worse than a sparse one — it suggests the project froze somewhere it didn't. Future-Jonathan reading this in six months would otherwise have to read 18 git commit messages and guess at the rationale. The entries below capture the *why* behind each change, which is what survives best in long-term documentation.

# v6 commit 28 — Dead code cleanup (streak, CSS, translation keys, README)

## What changed

Five categories of dead code found during the post-commit-25 audit:

1. **`computeStreakInfo()` in `src/streak.js`** — a 60-line implementation of a per-day streak with "yesterday grace" rule (Duolingo style). Implemented but never wired to the UI. The home screen never showed a day-streak; the `streak-card` CSS class on the home screen displays `formatDuration(totalQuizMs)` with a ⏱ icon (total training time), not a flame/days. After commit 22 explicitly documented "BBF deliberately has no daily-streak pressure" via the streak FAQ rewrite, keeping the unused implementation around suggested a phantom feature.

2. **Dead CSS class `boxmode-best-mistakes`** in `App.jsx` — referenced on a `<span>` in the box-mode best-times row but had no matching CSS rule anywhere. Removed the className; the `<span>` itself stays as visual container.

3. **Dead CSS class `prev-best-value`** in `BoxMode.jsx` — referenced on a `<span>` in the previous-best line of the box-mode completion screen but had no matching CSS rule. Same fix.

4. **README line "Replaces the day-streak card"** — referred to a UI element that doesn't exist (and never did in v4+). Rewrote the bullet to describe what total training time actually does without invoking a non-existent predecessor.

5. **Five dead translation keys in `data.js`** (NL + EN = 10 lines total):
   - `dayStreak`, `dayStreakSingle` — labels for the never-wired day-streak feature
   - `boxBestTimesHeader`, `boxNotYetPlayed` — leftover from an older Box Mode UI layout
   - `boxModeInProgress` — same era as above

   Comments were placed where the keys were so future audits know to look in git history rather than wondering whether a feature got dropped.

## Files changed

- **`src/streak.js`** — `computeStreakInfo()` removed, opening comment rewritten to describe what the file actually does now
- **`src/App.jsx`** — one className removed
- **`src/components/BoxMode.jsx`** — one className removed
- **`README.md`** — one bullet rewritten
- **`src/data.js`** — 10 lines removed across NL and EN sections

## Why this matters

Dead code is worse than missing code on three axes: (a) it bloats files and slows search, (b) it suggests features that don't exist (the `computeStreakInfo` case actively contradicted the streak FAQ — anyone reading the source could reasonably believe a day-streak was about to ship), and (c) it makes legitimate refactors harder because grep yields false positives.

# v6 commit 27 — Include paused sessions in backup (schema v4 → v5)

## The gap

`pausedQuizSession` and `pausedBoxSession` are stored on the user record (per `currentUser.pausedQuizSession`) so they survive a page refresh. But `Settings.jsx handleExport` did not include them in the backup shape, and `App.jsx handleRestore` did not restore them. A backup taken mid-session, restored on another device, would lose the paused session — the gold lines, FSRS data, and other learning progress would round-trip cleanly, but the in-progress session would be silently dropped.

## The design question

Whether paused sessions belong in backup is a real design call, not an obvious bug. After researching how other modern apps treat ephemeral session state (Anki, Netflix Continue Watching, Steam Cloud save-state, Google Play Saves), the conclusion was clear: modern user expectation in 2026 is that session state IS part of save-state — backup/restore should round-trip the "where you left off" position the same way it round-trips the FSRS-Rooted count.

BBF's paused session is "user-invested progress" (5-15 minutes of attention, a score, a streak), not "transient UI state" (which tab is open). Form drafts, game saves, and streaming positions are all in the same category — they belong in save-state. The earlier-omitted behavior was inconsistent with this.

## The fix

**`src/components/Settings.jsx`** — schema version bumped from 4 to 5. Two new fields in the exported user object:
- `pausedQuizSession: currentUser.pausedQuizSession || null`
- `pausedBoxSession: currentUser.pausedBoxSession || null`

The schema comment block was extended to document v5's rationale so a future maintainer doesn't have to dig through chat logs to find the design reasoning.

**`src/App.jsx`** — `handleRestore` now reads both paused fields with `?? null` fallback. Pre-v5 backups (no field) restore to `null` (no paused session on the receiving device); v5 backups round-trip cleanly. Inline comment explains why pre-v5 restore wipes any existing paused session on the current device: a backup-restore is an explicit "load this snapshot" signal, so carrying over the current device's mismatched paused session (which doesn't align with the just-restored FSRS state) would be misleading.

## Compatibility

| Backup version | Restore behavior |
|---|---|
| v5 (new) | Paused sessions round-trip cleanly. |
| v4 or earlier | Paused fields absent → `?? null` → no paused session restored. |

## Why this matters

A cross-device restore (e.g., new phone after losing the old one) was the most common scenario where the gap showed up. The user would expect "everything came over" but find their mid-session work gone. The fix aligns BBF with modern user expectations and removes a subtle data-loss path.

# v6 commit 26 — Box Mode FAQ: remove the non-existent daily-streak claim

## What changed

A consistency fix following commit 22's FAQ cleanup batch. That earlier batch correctly rewrote the "vlammetje" streak FAQ to clarify that BBF has **no daily streak** ("BBF heeft bewust geen daily-streak druk"). But the same commit did not touch the Box Mode FAQ, which still claimed:

- NL: "Je dagelijkse streak telt alleen Quiz Modus-sessies, dus een Doos Modus-sessie alleen verdedigt je streak niet."
- EN: "Your daily streak only counts Quiz Mode sessions, so a Box Mode session alone won't defend your streak."

Two FAQ entries contradicted each other: the streak FAQ said no daily streak, the Box Mode FAQ said there was one. A user reading both ended up confused about which is true.

Both NL and EN versions now read essentially: "Your mastery status and Quiz Mode best-streak stay the same" — the *Quiz Mode best-streak* is a real persisted value (longest in-session combo ever in Quiz Mode), so the claim is now both true and meaningful.

## Files changed

- **`src/components/Help.jsx`** — one rewritten sentence in the Box Mode FAQ, NL and EN versions

## Why this matters

Two FAQ entries contradicting each other is worse than one wrong FAQ entry — it forces the user to decide which to trust, which they shouldn't have to do. Same principle as commit 22's batch: outdated/wrong help is actively harmful, not just unhelpful.

# v6 commit 25 — Discard styling: add explicit border/background (global button reset stripped defaults)

## The bug

Commit 24 added a `.home-launcher-discard` CSS rule meant to make the previously-unstyled Discard button compact and visually secondary. But the rule only set min-height, padding, opacity, and font-weight — no background, no border. The global rule `button { background: none; border: none }` in `src/index.css` strips browser-default button styling, so without an explicit background/border the Discard button rendered as plain text on desktop. On mobile, iOS/Chrome native button hints provided a subtle visual container that masked the issue.

## The fix

Added three properties to `.home-launcher-discard`:
- `background: var(--bg-secondary)` — light fill matching the Resume button's container
- `border: 1px solid var(--border)` — subtle outline for definition
- `border-radius: 12px` — matches the rest of the launcher styling

Plus a hover/focus state that schedules opacity → 1 and background → `--bg-tile-hover` for a clear affordance.

## Files changed

- **`src/App.css`** — extended `.home-launcher-discard` rule (~15 lines added, 3 modified)

## Why this matters

A button that doesn't look like a button is a real UX problem — users either don't realize it's clickable, or they treat it as a label and panic when nothing happens on tap. Modern web apps need explicit button containers because every framework strips browser defaults for predictability. This commit closes that gap.

# v6 commit 24 — Home-screen fixes: tier-bar min-width, Discard styling start, soft 0/66 hint

## What changed

Three issues caught from a real-app screenshot:

1. **Tier-bar Learning segment invisible**: `.tier-segment` had `min-width: 0`, so a 1-out-of-66 segment (~1.5%) rendered as ~3px on a typical mobile bar — visually invisible despite showing up in the legend below. The bar and the legend were out of sync. Bumped `min-width` to 6px so every active tier gets at least a thin visible sliver.

2. **Discard button visually weak**: The `home-launcher-discard` className was referenced in App.jsx but had no CSS rule. Added a partial styling (min-height 44px, opacity 0.75, font-weight 500) to make Discard compact and visually subordinate to Resume. *(Note: commit 25 finished this by adding the missing background/border — without those the styling alone still rendered as plain text on desktop.)*

3. **"0 / 66 CONFIDENT" reads alarming during early use**: A user with 9 books in Learning/Familiar tiers but 0 confident sees "0 / 66" in giant purple letters and may think their effort isn't counted. Added a soft on-boarding hint under the hero card that only appears when `confidentCount === 0 && tierStats.unseen < 66` (count is zero but there IS activity): "Beantwoord een boek 3 keer correct binnen je doeltijd om je eerste gouden lijn te verdienen" / "Answer a book 3 times correctly within your target time to earn your first gold line". Disappears as soon as the first gold line is earned.

## Files changed

- **`src/App.css`** — `.tier-segment` min-width changed, two new rules added (`.home-launcher-discard` and `.hero-hint`)
- **`src/App.jsx`** — conditional hint render under hero card
- **`src/data.js`** — `confidentHintFirst` translation key in NL + EN

## Why this matters

Each of the three was a real inconsistency between what the legend/page promised and what the user saw. (1) bar didn't match its own legend. (2) UI class existed but did nothing. (3) accurate counter felt like an error message because there was no context. All three were caught by viewing the actual app, not by reading the code — a useful reminder that visual QA catches things code review doesn't.

# v6 commit 23 — Resume CTA shows time-since-pause (Intl.RelativeTimeFormat)

## What changed

The Resume session button on the home screen previously had a static subtitle "Pick up where you left off". A user returning days after pausing had no idea whether their paused session was from 5 minutes ago or 2 weeks ago — relevant context for deciding between Resume and Discard.

Now the subtitle shows the actual time-since-pause: "Onderbroken 3 uur geleden" / "Paused 3 hours ago", "Onderbroken gisteren" / "Paused yesterday", "Onderbroken 5 dagen geleden" / "Paused 5 days ago". Edge case: sub-minute returns "zojuist" / "just now" because Intl's "binnen een minuut" output reads awkwardly with the "Onderbroken" prefix.

## How

New helper `formatTimeAgo(timestampMs, lang)` in `src/timeFormat.js` wrapping `Intl.RelativeTimeFormat` (built-in since 2018, locale-aware out of the box — no per-tier translation strings needed). Returns `null` on bad input so the caller can fall back to the static description. Includes a fallback path for ancient browsers that lack Intl.RelativeTimeFormat.

Two new translation keys (`resumePausedAt`) with `{when}` placeholder: NL "Onderbroken {when}", EN "Paused {when}". Both Resume CTAs (Quiz Mode + Box Mode) updated; fall back to old "Pick up where you left off" when `pausedAt` is missing (pre-v23 paused sessions).

## Files changed

- **`src/timeFormat.js`** — `formatTimeAgo` helper added
- **`src/data.js`** — `resumePausedAt` translation key NL + EN
- **`src/App.jsx`** — both Resume CTA buttons updated, `formatTimeAgo` imported

## Why this matters

Time-since context shifts the decision: a session paused 5 minutes ago is worth resuming; one paused 2 weeks ago probably isn't. Without the timestamp, the user had to guess (or open the session, realize it was stale, and back out). Modern UX in 2026 expects relative-time labels everywhere.

# v6 commit 22 — FAQ cleanup batch: remove 3 outdated entries, add 3 new entries

## What changed

Three categories of FAQ work in one batch:

### Deleted (was misinformation)

1. **"Wat zijn Snel, Normaal en Volledig op het startscherm?" / "What are Quick, Standard, and Full…"** — described the three session-size launchers that were dropped in v4.11. The FAQ entry described UI that hadn't existed in months.

### Rewritten (was misinformation)

2. **"Wat is de 'dagen op rij' met het vlammetje?" / "What is the 'day streak' with the flame?"** — described a Duolingo-style consecutive-days counter with a flame icon. BBF has neither: the home `streak-card` CSS class displays `formatDuration(totalQuizMs)` with a ⏱ stopwatch icon. The FAQ described a phantom feature. Rewrote both as **"Wat is de Streak in de Quiz?" / "What is the Streak in the Quiz?"**, correctly describing the per-session combo counter and explicitly noting "BBF deliberately has no daily-streak pressure".

3. **"Kan ik een quiz pauzeren?" / "Can I pause a quiz session?"** — started with "Eigenlijk niet — maar dat is geen probleem" / "Not really — but that's fine". But pause/resume IS fully implemented since v4 (snapshot, Resume CTA, Discard button). Rewrote to describe the actual behavior, and combined with the Discard semantics (only session bookkeeping lost, not learning progress) into one comprehensive entry.

### Added (real new entries)

4. **"Wat gebeurt er als alle 66 boeken een gouden lijn hebben?"** — prevents users from resetting via Settings → Data thinking it's needed to "do the race again". Explains FSRS continues scheduling behind the scenes; gold lines can drop and be re-earned naturally.

5. **"Werken mijn records nog als ik de doeltijd wijzig?"** — clarifies records are historical (measured against the target time at the moment they were set), but the "within target time" check uses the CURRENTLY configured target.

6. **"Begint Doos Modus elke keer opnieuw?"** — clarifies Box Mode fresh-start behavior (all books start in box 1 every session), in contrast to Quiz Mode where learning progress persists. Notes the only persistent Box data is per-scope personal bests.

## Files changed

- **`src/components/Help.jsx`** — 12 string edits total (3 deletes/rewrites/adds × 2 languages)

## Why this matters

Outdated FAQ is **actively harmful** — worse than missing FAQ. A user who reads an entry that promises a feature that doesn't exist (or doesn't promise a feature that does) loses trust in the docs and starts second-guessing the rest. This batch swept up the three known-stale entries and added three that addressed real recurring questions (the all-66 reset trap, the records-after-target-change confusion, the Box-Mode-doesn't-persist surprise).

# v6 commit 21 — Friendly first-time hint when all books still unseen (new user / post-reset)

## What changed

Commit 20 added a soft FSRS guidance line under the Start Quiz Mode launcher: "X boeken kunnen vandaag aandacht gebruiken" / "X books could use attention today". For a brand-new user (or one who just reset) with `stats.unseen === stats.total`, this read as "66 books could use attention today" — accurate but cold for someone who hasn't started yet.

Added a friendly first-time variant: "Start je eerste sessie wanneer je wil — de app leert vanzelf wat lastig is" / "Start your first session whenever you like — the app will learn what's tricky for you". Triggers only when `stats.unseen === stats.total` (everything still unseen). The dynamic `stats.total` makes this future-proof — if BBF ever adds new books, no hardcoded 66 to update.

## Files changed

- **`src/App.jsx`** — extended the hint logic with the first-time branch
- **`src/data.js`** — new `quizHintFirstTime` translation key (NL + EN)

## Why this matters

The first impression for a new user is loaded. "66 books could use attention today" sounds like a homework load; "Start your first session whenever you like" sounds like an invitation. Same data underneath, very different emotional read.

# v6 commit 20 — Soft FSRS guidance line under Start Quiz Mode launcher

## What changed

The Quiz Mode launcher button had no contextual hint — users opening the app on a given day had no signal about what FSRS thought was "due". Added a small text line below the button (`.home-launcher-hint` CSS class, secondary color, smaller font) showing how many books are currently due-or-unseen:

- 0 due: "Geen boeken hebben vandaag aandacht nodig" / "No books need attention today"
- 1 due: "1 boek kan vandaag aandacht gebruiken" / "1 book could use attention today"
- N due: "X boeken kunnen vandaag aandacht gebruiken" / "X books could use attention today"

Soft language ("kan/could", "aandacht gebruiken/could use attention") deliberately matches BBF's no-pressure philosophy. Box Mode launcher intentionally bare — Box Mode is score-attack, not FSRS-driven, so a leidraad would mislead.

## Files changed

- **`src/App.jsx`** — conditional hint render under Quiz launcher
- **`src/App.css`** — new `.home-launcher-hint` class
- **`src/data.js`** — three translation keys per language (`quizHintNone`, `quizHintOne`, `quizHintMany`)

## Why this matters

Without context, the launcher is a leap of faith: tap and see what happens. With the hint, the user knows whether opening the app today is worth their 5 minutes. Particularly useful for the "should I bother today?" decision — if the hint says 0, they know they can skip without losing learning.

# v6 commit 19 — Refresh Reset Quiz Progress confirm: drop 'Mastery' term, add advisory

## What changed

The confirmation dialog text for Reset Quiz Progress (Settings → Data) had two problems:

1. **Outdated terminology**: still said "Mastery" / "Beheersing" — that term was renamed to "Confident / Vertrouwd" back in commit 8.1, but the confirm copy hadn't been swept up.
2. **No advisory against the common misuse**: users hitting "all 66 gold" sometimes assume they need to reset to "do the race again". They don't — FSRS continues scheduling and gold lines naturally drop and re-appear. The original confirm text didn't warn against this.

Rewrote the confirmation to:
- Use current "Vertrouwd / Confident" terminology
- List explicitly what gets deleted: gouden lijnen, niveaus, persoonlijke records, streak, sessie-geschiedenis
- Add advisory: "Doe dit alleen als je echt vanaf nul wilt beginnen, niet om opnieuw de race naar 66 gouden lijnen te kunnen doen."

## Files changed

- **`src/data.js`** — `resetQuizConfirm` / `resetQuizConfirmTitle` rewritten in NL + EN

## Why this matters

A reset confirmation is the last line of defense against accidental data loss. A confirm that uses out-of-date terminology and doesn't warn against the common misuse fails twice: it doesn't communicate what's about to happen, and it doesn't redirect users away from the wrong action.

# v6 commit 18 — First-solve shows '✓ Correct', not '⚡ New best' — semantic correctness

## What changed

Previously, the very first correct-and-within-target answer on a book triggered the "⚡ Nieuw record / New best" celebration. Semantically this is wrong: a record requires a previous benchmark to compare against. The first attempt is a baseline, not a record.

Research confirmed this convention (Speedrun.com, Strava, Anki, Duolingo): first attempts establish baselines, only subsequent strictly-better attempts are records. BBF should match.

Split the logic in `App.jsx`:

```js
const isFirstSolve = !prevBest;
const isNewBest = !isFirstSolve && timeTaken < prevBest;
if (isFirstSolve || isNewBest) updateBestTime(...);  // always record baseline
if (isNewBest) { ... celebration ... }  // only celebrate genuine improvement
```

Baselines still get persisted (so the *second* correct attempt can be a real record), but the celebration only fires on a legitimate improvement.

## Files changed

- **`src/App.jsx`** — `handleAnswer` correct-branch logic split

## Why this matters

Semantic correctness matters for trust. A user who sees "New best!" on their first attempt to a book may briefly think the celebration is wrong, then ignore future celebrations because they're not sure when "New best" actually means new. Restoring the meaning restores the signal.

# v6 commit 17 — Uniform advance delay for correct + new-best (both use autoPickDelayMs)

## What changed

Pre-fix: after a correct answer, the next book was picked after `autoPickDelayMs` (typically ~800ms). After a new-best, the "⚡ Nieuw record" prompt was dismissed at a separate `1500ms`. Inconsistent — two different durations for what felt like the same action.

Jonathan's request: "Time always the same both for correct or for new record. I want the shortest, so it is this that is for correct."

Changed `setShowNewBest(false)` dismiss timer from a hard-coded 1500ms to `autoPickDelayMs(config.targetSpeedMs)`. `pickNextBook` advance restored to unconditional `autoPickDelayMs`. The `isNewBest` flag refactored back to a const inside the if-block (no longer needs to be hoisted for the dismiss-timer comparison).

Box Mode unchanged — it has no new-best celebration mechanism, no analogous duration mismatch.

## Files changed

- **`src/App.jsx`** — `handleAnswer` correct-branch timer logic

## Why this matters

Inconsistent timing across two visually similar states (correct vs new-best) read as a UI bug even though both were "intentional" — the eye notices the discrepancy. Unifying them makes the celebration feel like a state-change of the correct-flow, not a parallel flow.

# v6 commit 16 — Apply key-remount to Box Mode timer bar (v14 fix gap)

## What changed

Commit 14's fix for the timer-bar fill-up animation was applied to QuizGrid.jsx but not to BoxMode.jsx, despite both modes using the same CSS transition pattern. Box Mode therefore still showed the visible 0→1 scaleX animation at the start of each question.

One-line fix: added `key={timerStart || 'idle'}` to the `.boxmode-timer-bar-fill` div, mirroring exactly what commit 14 did for the Quiz timer bar. The key change forces React to remount the element on each new question, so the transition resets cleanly instead of animating from a stale state.

## Files changed

- **`src/components/BoxMode.jsx`** — one prop added to the timer-bar fill div

## Why this matters

A fix that only addresses half its surface area is a slow-burning regression: users in Box Mode kept seeing the bug while QA testing focused on Quiz Mode. Both modes use the same visual pattern (timer countdown bar at top), so the same fix applies. This commit closes the gap.

# v6 commit 15 — Defer pickNextBook past showNewBest display (timer/prompt/clock align on new-best)

## The bug

After a new-best answer, two independent timers ran:
- `pickNextBook` fired at ~800ms (autoPickDelayMs)
- `setShowNewBest(false)` fired at 1500ms

In the window [800, 1500ms]: the feedback was cleared but `showNewBest` was still true. The "⚡ Nieuw record" prompt overlay was still visible while the timer bar for the next book had already started counting down, AND the start-time clock for that next answer had already begun running against the user.

Three things visually misaligned: the new-best celebration was still on screen, the timer was already eating into the user's response window, and any answer in that window was timed against a clock that started before the user could even see the question.

## The fix

Hoisted the `isNewBest` flag out of the if-block so the advance-delay branch could use it. When `isNewBest`, the pickNextBook delay is set to match the showNewBest dismiss timer (1500ms in this commit; commit 17 later unified both to autoPickDelayMs). Result: prompt clears, timer starts, and clock starts all simultaneously.

## Files changed

- **`src/App.jsx`** — `handleAnswer` correct-branch race fix

## Why this matters

The user's perception of "I clicked the right book and got a new best" should be a clean, satisfying micro-moment. Three timing mismatches happening inside that 700ms window broke the feel — the celebration looked weird because everything else was already moving. Synchronizing them restored the moment.

# v6 commit 14 — Fix Settings prop loss (targetSpeedMs/boxMode revert) + timer-bar fill-up on new question

## The bug (Settings prop loss)

`App.jsx` was passing config to Settings via a handpicked spread: `{grid, quiz, display, study, t}`. Two fields missing: `targetSpeedMs` and `boxMode`. When Settings opened it fell back to default values (10000 for targetSpeedMs, defaults for boxMode), and then on **any** subsequent setting change wrote the whole settings object back — silently overwriting the user's saved 4000ms `targetSpeedMs` and any non-default Box Mode config with the fallbacks.

The user saw their target time and Box Mode preferences quietly revert every time they touched Settings for any reason. Silent data loss.

Fix: pass `config={{ ...config, t }}` — spread everything, future-compatible. Any field added to config from this point automatically reaches Settings.

## The bug (timer-bar fill-up)

The Quiz timer-bar `.quiz-timer-bar-fill` div had `transition: transform 0.1s linear`. When a new question started, the element was reused (same DOM node) and the CSS transition animated from the previous scaleX(0) up to scaleX(1) before the new countdown started. Visible 100ms "fill-up" flash at the start of each new question.

Fix: added `key={timerStart || 'idle'}` to the fill div. The key changes per question, so React remounts the element. A fresh element starts at scaleX(1) without animating from anywhere.

## Files changed

- **`src/App.jsx`** — Settings props spread
- **`src/components/QuizGrid.jsx`** — `key` on timer-bar fill (Box Mode equivalent added in commit 16)

## Why this matters

Both were data-loss / visual-glitch bugs that had been latent for a long time, found through routine use rather than feature work. The Settings prop loss in particular is a subtle one — the cause was a spread that *looked* explicit and complete but wasn't.

# v6 commit 13 — Dead-code cleanup: remove 5 unused translation keys + update internal comments

## What changed

Smaller cleanup pass: five translation keys in `data.js` that were no longer referenced in any JSX (verified via grep across the full codebase). Also tightened a few internal `// v6 commit X` comments that referred to features in their final state rather than their original intent.

The five keys removed (NL + EN = 10 lines):
- `masterySpeed` / `masterySpeedDesc` — replaced by `targetSpeedLabel` / `targetSpeedDesc` in v6.3
- `boxModeSlowPenalty` / `boxModeSlowPenaltyDesc` — leftover from the pre-6.3 three-way time-pressure toggle
- `mastered` — the legacy stat label, replaced by `confident` in 8.1 and `restoreMastered` in 8.2

## Files changed

- **`src/data.js`** — 10 lines removed, comments added explaining what each key used to do

## Why this matters

Same rationale as commit 28's broader cleanup: dead translation keys are silent rot. Future maintainers grep for the key, find it in `data.js` only, and waste time figuring out whether it's still wired up. Removing them cleanly with a tombstone comment makes the grep-then-read-history workflow fast.

# v6 commit 12 — Help: snelheidslimiet → doeltijd / speed limit → target time

## What changed

Terminology sweep through `Help.jsx`. The "speed limit" / "snelheidslimiet" wording had been renamed to "target time" / "doeltijd" in commit 6.3, but the Help screen text wasn't fully updated. Six in-place text edits to match the new term throughout the "How it works" section and FAQ entries.

## Files changed

- **`src/components/Help.jsx`** — six terminology fixes (NL + EN)

## Why this matters

Inconsistent terminology between the Settings UI ("Doeltijd per boek") and the Help text ("snelheidslimiet") forces the user to mentally translate. Same fix-shape as several earlier commits: keep the user-facing vocabulary aligned everywhere.

# v6 commit 11 — Catch up CHANGES.md (entries for 6.3 through 10)

## What changed

Documentation catch-up. Added CHANGES.md entries for commits 6.3 through 10, which had been shipped without changelog updates during a stretch of fast iteration. Same shape as the current commit 29 catch-up: reverse-chronological entries appended to the top, with rationale rather than just diff summaries.

## Files changed

- **`CHANGES.md`** — multiple entries prepended

## Why this matters

A periodic catch-up is acceptable; a permanent gap isn't. This commit established the pattern that any commit-stretch longer than ~10 commits without changelog updates gets caught up before the next batch starts. (Commit 29 follows the same rhythm.)

# v6 commit 10 — README — bring outdated sections in line with current app state

## What changed

Seven specific text edits in `README.md` to bring the documentation in sync with the current app state. No structural rewrite; only the parts that contradicted reality.

## Edits

- **Quiz Mode description** — removed mention of three session-size launchers ("Quick (5 books) / Standard (10 books) / Full"), which were dropped in v4.11. Replaced with current single "Start Quiz Mode" button + tier-breakdown-bar wording.
- **Confident gold line** — "speed limit" → "target time" (terminology renamed in v6.3).
- **Session-complete screen** — "One action: end the session" → "Two actions: Continue training or End session" (Continue training was added in v6.2).
- **Learning pace path** — `Settings → Advanced` → `Settings → Training → Quiz Mode → Advanced` (the actual nested location).
- **Training-time tracking section** — share-message example "X books mastered in Y time" → "I'm confident on X out of 66 Bible books in Y time" (concept renamed in 8.1; wording updated in app in 8.2). Also `_schemaVersion: 3` → `4` after commit 9.
- **Design-philosophy paragraph** — removed mention of "a flat 'Done for now' appears when nothing is currently due" (removed in commit 7); added current "single 'X / 66 Confident' stat shows where you stand toward the goal" wording. Also removed the false "three-tier rest celebration" claim.
- **Box Mode / Continue training paragraph** — rewrote to mention the v6.2 Continue training button. Deleted the standalone paragraph about Quick/Standard launchers (removed in v4.11).

## Why this matters

README is the entry point for anyone landing on the GitHub repo from search or shared link. A README that promises features that no longer exist (or describes a UX that's been replaced) is worse than a sparse README — it actively misleads. This commit removes the misleading parts without expanding the doc.

# v6 commit 9 — Fix data loss in backup/restore: preserve confidentBuffers (schema v4)

## The bug

The export shape in `src/components/Settings.jsx` (`handleExport`) and the restore shape in `src/App.jsx` (`handleRestore`) silently omitted `confidentBuffers` — the per-book ring buffers that drive the gold-line / confident signal. After a backup/restore round-trip the user's exact gold-line state was lost; only books that happened to be FSRS-Rooted got their gold lines back via the existing `migrateConfidentBuffers()` fallback. Books that were confident-but-not-yet-Rooted lost their status on every round-trip, which made the "X / 66 Vertrouwd" home hero stat drop after each restore.

The migration useEffect at `App.jsx` ~line 330 had been silently masking the severity — it ran on every user-id change and filled gold lines for FSRS-Rooted books, so legacy users still saw _some_ gold lines after a restore. But the v4-and-later normal case (gold lines earned via the 3-correct-fast confident path, not via FSRS-Rooted) lost progress every restore.

## The fix

**`src/components/Settings.jsx`** — added `confidentBuffers: currentUser.confidentBuffers || {}` to the exported user object. Bumped `_schemaVersion` from 3 to 4. Documented the omission in the schema-version comment block so future maintainers see the rationale.

**`src/App.jsx`** — added `confidentBuffers: userData.confidentBuffers ?? migrateConfidentBuffers(userData.fsrsCards || {}, bibleBooks, {})` to the `updateUserData` call inside `handleRestore`. Critical subtlety: the standalone migration `useEffect` only fires when `currentUser?.id` changes — which doesn't happen on restore — so the migration fallback had to be inlined here. Without inline migration, a pre-v4 backup would restore with empty buffers and zero gold lines until the user trained something new.

## Compatibility matrix

- v4+ backup with populated buffers → exact buffer state preserved
- v4+ backup with empty buffers (fresh profile) → empty buffers; migration produces nothing because FSRS is also empty
- v3 (pre-fix) or older → migration fills gold lines for FSRS-Rooted books (same behavior as the previous code path; no regression)
- Unknown future versions → graceful via `?? fallback` on all fields

## Why this matters

The home hero card (`X / 66 Vertrouwd`), the milestone celebration banners (10/20/33/50/66 confident, OT/NT-complete), the share message (`Ik ben vertrouwd met X...`), and the all-66 celebration screen all derive from `confidentCount`, which is computed from `confidentBuffers`. Losing the buffer state on restore directly degraded the user's main progress metric without any visible error.

# v6 commit 8.3 — Help settings paths + outdated Box Mode FAQ rewrite

## What changed

Two categories of error in the Help screen text, caught by Jonathan after deploying 8.2:

1. **Wrong settings paths.** The toggle "Vertrouwde boeken" lives in Settings → **Training → Algemeen** (three levels deep), not "Grid" or "Gedeeld" alone or just "Training". Four references corrected (NL + EN, in the "How it works" speed-bar section and the FAQ about the gold line).

2. **FAQ entry about Doos Mode time pressure described removed functionality.** The "Soft/Hard/Off" three-way toggle was collapsed into one unified timer in v6.3, but the FAQ still described all three modes and pointed at a non-existent "Settings → Training → Doos Modus" section. Rewrote both NL and EN versions to describe the current flow (timer expiry → blue reveal → tap-to-continue, demotion in Box, FSRS-Hard rating in Quiz) and the actual setting at Settings → Training → Algemeen → "Doeltijd per boek" (2-30s slider).

Plus one terminology fix: EN FAQ at line 433 mentioned "mastery speed", which was renamed to "target time" in v6.3. Updated to use the current term plus the specific full path.

## Files changed

- **`src/components/Help.jsx`** — six text edits:
  - NL: "Hoe werkt het" → De snelheidsbalk path: `Gedeeld` → `Training → Algemeen`
  - EN: "How it works" → The speed bar path: `Shared` → `Training → Shared`
  - NL FAQ "Wat is de gouden lijn..." full path now `Training → Algemeen → "Vertrouwde boeken"`
  - EN FAQ equivalent now `Training → Shared → "Confident books"`
  - NL/EN "Hoe werkt de tijd in Doos Modus" — full rewrite reflecting unified timer
  - NL/EN "Ik ben sneller/trager" — points to specific "Doeltijd per boek" / "Target time per book"

## Why this matters

A Help text that names a setting at the wrong path is worse than no Help — the user goes hunting and concludes either the setting was removed or they're misreading the docs. Same with describing features that don't exist anymore: the user toggles around looking for "Soft/Hard mode" and finds nothing, which erodes trust in the docs. Both of these were latent inconsistencies from v6.3's refactor that hadn't been swept up.

# v6 commit 8.2 — Settings label + milestones + restore dialog: align with Confident/Vertrouwd

## What changed

Three groups of user-facing strings still used the old "Mastered/Beheerst" terminology after 8.1 renamed the home stat label. This commit finishes the rename across the remaining surfaces:

1. **Settings toggle label** in the Training → Algemeen subsection. Old: "Mastered books" / "Beheerste boeken". New: **"Confident books" / "Vertrouwde boeken"**. Description got more informative too: "(show gold line under confident books)" / "(toon gouden lijn onder vertrouwde boeken)" — tells the user what the toggle visually does instead of just repeating the label.

2. **Milestone celebration banners** that fire when the user crosses 10, 20, 33, 50, OT-complete, NT-complete, or 66 confident books. The old wording was a double error: wrong word ("mastered/beheerst") AND wrong concept (milestones fire on `getConfidentCount`, not on the FSRS-Mastered count). All seven banners × two languages now say "books confident! 🎉" / "boeken vertrouwd! 🎉".

3. **Restore-dialog comparison label** ("X/66 mastered" / "X/66 beheerst"). The accompanying number is `getBookStats(...).mastered`, which counts the FSRS-Rooted tier (stability > 7d + reps), not Confident. Renamed the displayed value from "mastered/beheerst" to **"rooted/geworteld"** to match what it actually counts. The translation key name `restoreMastered` is kept to avoid cascading code changes; only the value moved.

Also updated four FAQ entries in Help.jsx that referenced the renamed strings (gold-line setting reference, share-button example message, backup-restore "mastered-book highlight", re-drilling paragraph).

## Files changed

- **`src/data.js`** — `highlightFound` (NL + EN), `highlightFoundDesc` (NL + EN), seven milestone keys × 2 languages, `restoreMastered` (NL + EN). Added comment blocks documenting the rename rationale.
- **`src/components/Settings.jsx`** — `SettingRow` fallback strings for `highlightFound` / `highlightFoundDesc`.
- **`src/components/Help.jsx`** — gold-line FAQ setting reference (NL + EN), share-FAQ example text (NL + EN), backup FAQ "mastered-book highlight" → "confident-book highlight" (NL + EN), re-drilling FAQ "beheerst boek" → "stabiel boek" / "Mastered book" → "stable book" (NL + EN).

## Dead translation keys noted (no action taken)

After this commit, three translation keys in `data.js` are no longer used in active code: `mastered` (superseded by `confident` and `restoreMastered`), `masterySpeed`/`masterySpeedDesc` (replaced by `targetSpeedLabel`/`targetSpeedDesc` in v6.3). Kept as dead code rather than deleted — translation-key deletion risks breaking obscure references and is a separate future cleanup.

# v6 commit 8.1 — NL terminology rename: Zeker → Vertrouwd, Familiar → Bekend

## What changed

Two coupled NL-only renames triggered by user feedback that "Zeker" reads awkwardly as a stat label ("12 zeker van 66" feels adverb-shaped rather than noun-shaped). EN unchanged — "Confident" / "Familiar" both still read fine.

1. **Gold-line / confident concept label**: NL `confident: 'Zeker'` → **`confident: 'Vertrouwd'`**. "Vertrouwd" is the natural Dutch translation of *confident-with-a-thing* and reads cleanly as a stat label ("12 Vertrouwd van 66") and in flowing prose ("ik ben vertrouwd met dit boek").

2. **FSRS Familiar tier name**: NL `tierFamiliar: 'Vertrouwd'` → **`tierFamiliar: 'Bekend'`**. Required because "Vertrouwd" was previously the Familiar-tier label; using it for the new confident concept would create a same-word collision on the home screen ("12 Vertrouwd" hero stat right above a "Vertrouwd: 8" tier-chip in the legend — two different numbers under the same word). "Bekend" forms a clean "Onbekend → Bekend" early-stage progression and avoids any clash.

New NL ladder: **Onbekend → Geleerd → Bekend → Geworteld → Verankerd → Permanent**.

## Files changed

- **`src/data.js`** — `confident`, `tierFamiliar`, `celebration66Title` ("Alle 66 boeken zeker!" → "Alle 66 boeken vertrouwd!"). Comment blocks updated to document the rename chain (v4: beheerst→geworteld; 8.1: zeker→vertrouwd plus vertrouwd→bekend).
- **`src/App.jsx`** — NL share message "Ik ben zeker van X..." → "Ik ben vertrouwd met X..."
- **`src/components/Help.jsx`** — 5 places: Approach item 3 tier-ladder, "How it works" section 1 (gold-line marker phrasing), "How it works" section 2 (tier bullet), FAQ "Wat zijn de zes niveaus" question + answer, FAQ "Wat is de gouden lijn" answer.

## Things deliberately kept

- Normal Dutch "zeker" in confirmation dialogs ("Weet je zeker dat je je voortgang wilt wissen?") — that's not the concept, just regular Dutch usage.
- EN labels — no equivalent collision in English, no user complaint, no need to change.
- The translation key `confident` itself — only the displayed value changed, the key stays.

# v6 commit 8 — "How it works" explainer content + stale tier name fixes

## What changed

Added a new **"How it works"** section to the Help screen, sitting between the existing Approach and FAQ sections. Five short subsections covering the algorithm and visual model that users were previously left to figure out from in-context UI alone:

1. **Two signals working together** — the gold line (in-session, last-3 attempts) vs the tier (FSRS stability, long-term). Parallel signals, both useful.
2. **The six tiers** — the full ladder (Unseen → Learning → Familiar → Rooted → Anchored → Permanent) with concrete stability thresholds (>7d, >30d, >180d) and rough timelines.
3. **How your answers drive the schedule** — outcomes table (fast correct → Good, slow correct → Hard, wrong → Again, time-up → Hard) with what each does to FSRS scheduling and scoring. Box Mode mentioned briefly.
4. **The speed bar** — what the timer does, what happens on expiry in each mode, how the 2-30s slider feels at each end.
5. **Why breaks are fine** — the spaced-repetition principle, no daily-quota pressure.

Each subsection is one heading + ~3 short paragraphs (or a paragraph + bullet list). Rendered as plain text, not accordion — the whole point is that it gets read, not hidden behind a tap. Total reading time ~2-3 minutes.

Also fixed two stale tier names in the existing Approach item 3:
- EN: "Mastered" → "Rooted"
- NL: "Beheerst" → "Geworteld"

The Rooted tier was renamed from "Mastered" back in v4 (to free the word "Mastered" for the new gold-line / Confident signal), but the Approach text had never been updated.

## Files changed

- **`src/components/Help.jsx`** — added `howItWorksTitle` + `howItWorks: [...]` to both `nl` and `en` content blocks, plus a render block between `<section>{content.approachTitle}</section>` and `<section>{content.faqTitle}</section>`. Body strings use `\n\n` as paragraph separator and lines starting with `• ` get rendered as `<ul>` bullets.
- **`src/components/Help.css`** — new `.how-it-works` style group following the existing `.approach` rhythm (heading, body paragraph, bullet list). No new colors or layout patterns.

## Scope: Layer 1 only

Originally sketched three layers of transparency:
- Layer 1: static explainer content (this commit)
- Layer 2: per-book stats modal (tap a cell on home → see tier, last seen, attempts-to-next-tier)
- Layer 3: inline milestone hints under grid cells ("3 more to Rooted")

After discussion: Layer 3 dropped (visual noise on every cell forever, marginal value). Layer 2 deferred (high value, low frequency — and the case for it weakens once Layer 1 is in, since the explainer answers most of the curiosity it would address). This commit ships Layer 1 only.

# v6 commit 7 — Drop home "Ready to practice" stat (obligation → confidence framing)

## What changed

The home Quiz panel previously showed a two-card stats grid:
- Left: `[Confident X of 66]`
- Right (when `dueNow > 0`): `[Ready to practice X]` (the FSRS-due count)
- Right (when `dueNow == 0`): `[X to gold]` (66 − confident)

Replaced both branches with a single centered hero card: `[X / 66 Confident]` with the count as a large hero number and the denominator in reduced visual weight. Tier bar (with chip legend) stays below.

## Why

The "Ready to practice" framing presented progress as a to-do count — "here's your obligation today" — which fights the rest-of-the-app message that breaks are fine and the schedule is self-driving. Even when the number was small, it felt like pressure. And the number wasn't actionable: the launcher button works the same whether `dueNow` is 0, 5, or 66, so the user doesn't need to know the count to start a session.

The "to gold" alternative (shown when `dueNow == 0`) was less obligation-shaped but still represented "work remaining" — also slightly nag-shaped.

Removing both leaves the home screen as pure "here's where you stand toward the all-66-confident goal." The tier bar underneath provides the same kind of breakdown a power user would want, without the daily-quota framing.

## Files changed

- **`src/App.jsx`** — collapsed the three-branch ternary (`confidentCount === 66 ? celebration : stats.dueNow > 0 ? statsWithDue : statsWithToGold`) into a two-branch (`confidentCount === 66 ? celebration : singleConfidentCard`). Old `<div className="stats">` with two children replaced by `<div className="stats stats-single">` with one `<div className="stat-card stat-card-hero">`.
- **`src/App.css`** — new `.stats.stats-single` rule (1-column grid, 320px max-width, centered) and `.stat-card.stat-card-hero` variant (larger padding, 3rem hero number, uppercase letter-spaced label, smaller-weight `.stat-denom` for the "/66" suffix). Plain `.stat-card` sizing untouched so any other multi-card layouts are unaffected.
- **`src/components/Help.jsx`** — updated FAQ entries that referenced the now-removed home-screen label: deleted 2 entries entirely ("What's the difference between Ready to practice and Due?" and "What does Ready to practice mean on the home screen?"); merged the "Why can't I keep training when Ready to practice reads 0?" entry into a new "Do I need to train every day?" entry (same advice, no obligation framing); updated incidental references in 3 other entries (approach item 4, pause FAQ, "what if I don't use the app for a while"). Also incidentally fixed an outdated mention of the v4.11-removed Quick/Standard/Full launchers in the pause FAQ.

## What does NOT change

- In-quiz "DUE" stat in `QuizGrid.jsx` — still shows `stats.dueNow`. Inside a session that number is a real session countdown, not an obligation. Stays.
- All FSRS engine behavior — no scheduling changes.
- The launcher button on home (already simplified to single "Start Quiz Mode" in v4.11).
- All-66 celebration screen.
- Translation keys `readyToPractice` and `toGold` — left in `data.js` as harmless dead code; deletion is a future cleanup.

# v6 commit 6.3.4 — Quiz Mode time-up = Box Mode time-up; slow-correct cell → blue

## What changed

Final convergence step in the Quiz-vs-Box uniformity arc (started in v6.3, continued through 6.3.1+6.3.2 and 6.3.3). On Quiz Mode timer expiry the behavior used to be:
- Bar fills with amber tint
- Prompt label changes to "Too slow!"
- All cells stay tappable; the user must still find the right one
- FSRS rating defers until the user taps

After this commit, Quiz Mode timer expiry mirrors Box Mode's expiry exactly:
- The asked book cell lights up **blue** (was: amber)
- Prompt changes to "Time's up — look for the blue cell!"
- All other cells become non-tappable
- The user must tap the blue cell to continue
- FSRS rating commits at expiry as Hard (no longer waits for tap)

And the slow-but-correct cell color changes from amber to blue too, eliminating the last amber/orange cell-color ambiguity for deutans. "Slow" as a state now lives only in the prompt label ("⏱ Too slow — Xs") and the post-answer feedback message, not in cell decoration.

## Why

The earlier model had three distinct cell-reveal colors (blue = wrong-tap reveal in Quiz, amber = time-up reveal in Quiz, blue = both in Box) — which is two too many for a deutan-friendly design and three too many for a user who just wants consistency between modes. The new model has one cell-reveal color (blue) used uniformly for any "the right answer is here" hint, in either mode, regardless of cause.

Also fixes a subtle behavior asymmetry: previously Quiz Mode users could "outwait" the timer (let it expire, then keep searching as if nothing happened); Box Mode users couldn't. Mode-uniform behavior matches the design intent that the timer is meaningful in both modes.

## Files changed

- **`src/components/QuizGrid.jsx`** — added `targetBookRef` and `expiryFiredRef` for the new expiry flow. On timer expiry: reveal `targetBook` in blue, lock other cells, force tap-blue to continue, commit FSRS Hard rating immediately. Retired the `isOvertime` flag and the deferred-rating path. Slow-but-correct cell color in `renderBookCell` changed from `.slow` (amber-toned) to use the same blue feedback styling as `correct`.

# v6 commit 6.3.3 — Visible overtime + paused-session resume auto-scroll

## What changed

Two small followups to 6.3.1+6.3.2:

1. **Quiz Mode bar expiry was invisible.** At 0% the orange bar collapses to `width: 0`, which means a user staring at the screen could miss the moment the timer ran out — until they tried tapping a cell and got "too slow" feedback. Added explicit visible state: bar gets an amber `.prompt-slow` tint when at 0%, with a small ⏱ icon prepended to the prompt. The cell is still tappable at this stage (the harder time-up flow lands in 6.3.4).

2. **Paused-session resume didn't auto-scroll.** When a user paused a Quiz session mid-OT and resumed it, the grid would stay at whatever scroll position it was at on resume — even though `pickNextBook` always auto-scrolls. Bug: the auto-scroll only happened in `pickNextBook`, not in the paused-restore code path. Added an explicit auto-scroll call to the paused-restore handler so resume feels identical to a fresh session start.

## Files changed

- **`src/components/QuizGrid.jsx`** — visible-overtime state additions to the bar render (three places), auto-scroll trigger added to paused-restore path.

# v6 commit 6.3.1+6.3.2 — Uniform blue reveal + batch timer reset

## What changed (two related fixes shipped together)

1. **Wrong-tap reveal color unified to blue (across both modes).** Previously time-up cell reveals used amber in Quiz Mode and blue in Box Mode — same cell semantics, two colors. The deutan-friendly palette also avoids amber/orange adjacency where possible, and amber for a "look here" hint is too close to the orange used for wrong-tap cells. Switched both modes to use blue for the reveal, leaving orange exclusively for wrong-tap. One purpose per color.

2. **Eliminated a one-frame bar fill-up race.** Setting `setTimerStart(Date.now())` and `setTimerProgress(1)` in sequence (the timer reset on each new book) used to update `timerProgress` via a `useEffect`, which meant for one frame the user would see the OLD progress bar before the new one rendered. Batched the two state updates into the same call site as `advanceToNextBook` / `pickNextBook` / session-start / paused-restore, so the bar visibly fills from 100% on each new book with no jitter.

## Files changed

- **`src/components/QuizGrid.jsx`** — color class swaps in the reveal feedback paths (Quiz and Box modes), `setTimerStart` / `setTimerProgress` batched at four call sites.
- **`src/components/QuizGrid.css`** — `.book-cell.slow` no longer needed the amber color path (moved to the same blue styling as `.correct`).
- **`src/components/BoxMode.css`** — equivalent cleanup.

# v6 commit 6.3 — Time pressure unification: single targetSpeedMs across both modes

## What changed

Quiz Mode and Box Mode previously had separate time-pressure settings:
- Quiz Mode: `config.quiz.masteryMs` (2-10s slider, the gold-line speed threshold)
- Box Mode: `config.boxMode.timePressure` (3-position toggle: "off" / "soft-Xs" / "hard-Xs")

Conceptually these measured the same thing — "how fast you expect to recall a book" — but split into two unrelated settings with different ranges and shapes. Users had to discover this and tune both for a consistent feel, and the Box Mode three-way toggle was an extra knob that didn't deliver value commensurate with its surface area.

Unified them into one top-level **`config.targetSpeedMs`** (slider, 2000-30000 ms, step 250 ms) shown in Settings → Training → Algemeen/Shared. Both modes read this value:
- **Box Mode**: timer always-on; expiry triggers an auto-wrong flow (demotes the book one box, reveals the asked book in blue, requires tap-to-continue). The "soft mode" of the old setting (slow-correct still counts as correct) was removed entirely — it added complexity without clear value, and the "Hard" semantics are now universal.
- **Quiz Mode**: timer is now visibly displayed (parallels Box Mode's bar). The legacy "speed limit threshold for gold-line credit" semantics are preserved — slow-correct still loses a streak point, FSRS gets a Hard rating. Time-up behavior (full reveal + tap-to-continue) lands in 6.3.4.

Setting `targetSpeedMs` to 30000 (max) makes the timer effectively invisible in practice. Setting it to 2000 makes it a serious challenge. The full slider lets the user dial in their personal feel.

## Schema migration

The config shape changed, so `mergeConfig` got a new migration step. Bumped `CURRENT_CONFIG_VERSION` from 1 to 2. The migration in `mergeConfig`:
1. Reads the old `quiz.masteryMs` and old `boxMode.timePressure` from the incoming config.
2. Converts `timePressure: 'off'` → 30000 ms; `'soft-Xs'` or `'hard-Xs'` → X * 1000 ms.
3. Takes the **higher** of the two values (a user with a 10s Quiz limit and a 6s Box limit gets unified to 10s, on the principle that the gentler setting is the safer migration choice).
4. Clamps to the slider range [2000, 30000].
5. Sets `config.targetSpeedMs` to the result.
6. Leaves the old fields in place but unused (gracefully ignored by all current code paths).

Backup imports go through the same `mergeConfig`, so pre-6.3 backups migrate transparently.

## Files changed (9 files, +459 −211)

- **`src/appConfig.js`** — schema definition: added `targetSpeedMs` to top level of config, bumped `CURRENT_CONFIG_VERSION` to 2, added migration logic to `mergeConfig`.
- **`src/boxMode.js`** — removed `slowOnCurrent` state and `markSlow()` function; timer expiry now fires the auto-wrong flow unconditionally.
- **`src/components/BoxMode.jsx`** — refactored to read `targetSpeedMs` instead of `boxMode.timePressure`. Always-on timer.
- **`src/components/BoxMode.css`** — removed soft-mode classes.
- **`src/components/QuizGrid.jsx`** — added the visible timer bar in Quiz Mode (parallels Box Mode visual). Reads `targetSpeedMs`. Slow-detection unchanged in this commit (still applies the existing "lost streak, FSRS Hard" semantics).
- **`src/components/QuizGrid.css`** — added Quiz-side timer bar styles.
- **`src/components/Settings.jsx`** — new `targetSpeedMs` slider in the Algemeen/Shared subsection; removed the old Quiz speed dropdown and the Box time-pressure 3-way toggle.
- **`src/App.jsx`** — share message and various derived computations now read `config.targetSpeedMs`. The user-level `masteryMsAtStart` field name is preserved (it's a historical record on the user object, not refactored as part of 6.3).
- **`src/data.js`** — new translation keys: `targetSpeedLabel`, `targetSpeedDesc`. Several prompt and celebration strings touched to match the new setting name.

## What does NOT change

- FSRS engine — no scheduling changes.
- The gold-line confident-buffer logic — still records "fast" attempts based on the threshold (just reading from a different field).
- The user-level `masteryMsAtStart` field — kept as a historical marker for the share-message "speed unchanged since start" check. Internal name not refactored to avoid unnecessary churn.
- Confidence semantics — gold line still requires 3 in-time-correct in a row, where "in time" means within `targetSpeedMs`.

# v6 commit 6.2 — "Continue training" button on session-complete

## What changed

Adds a primary **Continue training** button alongside the existing **End session** button on the in-session celebration screen. Lets the user keep training without round-tripping back to the home screen first.

## Why

After v4.11 made Quiz Mode sessions unbounded, `sessionComplete = true` only fires when the maintenance-mode picker has cycled through all 66 confident books once. The celebration screen previously offered only one action — End session — even though many users will want to keep going. The new dual-button pattern makes the choice explicit and matches the research-validated approach from Quizlet Learn (between-rounds "Continue Learning" button).

## Files changed

- **`src/components/QuizGrid.jsx`** — `roundSeenBooksRef` (new per-round picker filter) replaces the previous `sessionSeenBooksRef`. The session-level `sessionSeenBooks` state continues to accumulate across rounds so saved `seenBookIds` reflect everything seen in the whole session. New `handleContinueTraining` callback resets only the round filter and re-picks. Paused-session restoration seeds the round ref from the snapshot.
- **`src/components/QuizGrid.css`** — Primary purple-gradient styling moves from `.session-complete-finish` to `.session-complete-continue`. End session falls back to the neutral `.btn` default (outlined, secondary).
- **`src/data.js`** — New translation key `sessionCompleteContinue` (NL: "Verder trainen", EN: "Continue training").

## Behavior

- Continue training → resets the per-round seen filter only, then picks the next book. Score, streak, sessionMs, mastered/hinted/wrong tallies, and the session-level seen set keep accumulating across rounds.
- End session → unchanged from before. Saves the segment and returns to home.
- When the user finally ends a multi-round session, the saved entry's `seenBookIds` correctly captures every book seen across all rounds (not just the last one).
# v6 commit 6.1 — Fix in-session celebration time + unify "Today" rounding

Two related fixes for time display, surfaced when Jonathan completed
his first all-66 session and noticed three different time numbers
that should have agreed:
- In-session celebration: **19m**
- "Today" line: **10 minutes trained**
- Share message: **9m**

## Fix 1 — In-session celebration double-counted the current session

`src/components/QuizGrid.jsx` line 802 was:
```js
{formatDuration(totalQuizMs + sessionMs)}
```

This double-counted because `addTrainingTime(cappedMs)` is called
**per question** (correct-answer handler ~line 536, wrong-answer
handler ~line 655). Both call sites increment the user's
`totalQuizMs` by the same `cappedMs` that's being added to the
local `sessionMs` state. So by the time the celebration renders at
session-complete, `totalQuizMs` already contains every per-question
contribution from this session — adding `sessionMs` on top doubles it.

Jonathan's case made the bug obvious: his first ever session, ~9.5m
of play, both `totalQuizMs` and `sessionMs` ≈ 9.5m, and the formula
produced ~19m. The home-screen celebration in `App.jsx` line 707
has always used the simpler `formatDuration(currentUser.totalQuizMs)`
and was correct.

**Change:** drop the `+ sessionMs` term. Now matches home-screen
formula and share message source. All three places read from the
same fact.

## Fix 2 — "Today" line used a different rounding than everything else

`src/components/QuizGrid.jsx` ~line 789 was:
```js
const todayMinutes = Math.max(0, Math.round(todayMs / 60000));
// ...
{todayMs > 0 && (<>{' · '}{todayMinutes} {t.sessionCompleteMinutes}</>)}
```

This rendered as "X minutes trained" with `X = Math.round(ms/60000)`.
But everywhere else in the app (share message, home-screen
celebration, Settings → Data, all `formatDuration` call sites) uses
`Math.floor(ms/60000)` because `formatDuration` floors. So:

- 9.5m wall-clock → "**10 minutes trained**" here, "**9m**" everywhere else.
- 65m wall-clock → "**65 minutes trained**" here, "**1h 5m**" everywhere else
  (formatDuration switches to hours at the 60-minute boundary).

The second case is worse — the unit changes between displays, not
just the rounding direction.

**Change:** use `formatDuration(todayMs)` here too, with a new label
`t.sessionCompleteTrainedLabel` (just "trained" / "getraind" — the
unit is now baked into formatDuration's output). Now reads
"X minutes trained" → "Xm trained" or "Xh Ym trained".

Removed the now-unused `todayMinutes` variable. The old
`sessionCompleteMinutes` translation keys are kept in `data.js` as
dormant (no longer referenced) so any old exports/imports that
might still carry them through don't crash. Their values are
unchanged.

## Outcome

After this commit, Jonathan's three numbers all agree (within
`formatDuration`'s floor rounding):

| Display | Before | After |
|---|---|---|
| In-session celebration | 19m | **9m** |
| "Today" line | 10 minutes trained | **9m trained** |
| Share message | 9m | **9m** |
| Home-screen celebration | (already 9m) | 9m |

## Files touched

- `src/components/QuizGrid.jsx` — two lines: celebration formula
  (one line), Today line render (one line). Plus the `todayMinutes`
  variable definition removed (replaced by a comment explaining why).
- `src/data.js` — added `sessionCompleteTrainedLabel` (NL + EN).

## Smoke test

1. **Reset progress, play one full session to 66 confident.**
   In-session celebration → trophy + total time. Total time should
   roughly equal your session duration (~`formatDuration(sessionMs)`),
   not double.
2. **"Today" line** in the same session-complete view should
   read "X books · 1 session · Ym trained" where Y matches the
   celebration's number.
3. **Tap End session → home screen.** Home celebration trophy
   shows the same total. Share message text matches.
4. **Start another session** (say, after another day's play).
   In-session celebration should show cumulative total
   (yesterday + today), not double either day.
5. **Play long enough to exceed 60 minutes** total: "Today" line
   should switch to "1h Xm trained" format, not "65m trained".

---

# v6 commit 6 — Quiz panel title (balance the share icon)

After v5.1, Jonathan reviewed the home dashboard on mobile and
flagged that the share icon looked strange in the Quiz Mode tab.
Compared the two screenshots:

- **Box Mode tab:** "📦 Box Mode" header on the left, share icon
  on the right. Header row balanced.
- **Quiz Mode tab:** no header at all. Share icon floats in the
  top-right with nothing to anchor it. It visually attaches to
  the right-hand stat card ("66 Ready to practice") and the
  panel looks unbalanced.

We considered moving the share button to the global header bar
(next to ? ⚙ EN). Jonathan reminded me that placement had been
tried in an earlier iteration and rejected — so that option's
off the table.

**Change:** add a section header to the Quiz panel matching the
Box panel pattern. `<h2 className="dashboard-panel-title">🎯 {t.quizMode}</h2>`
in the same position the Box panel uses. Both panels now have
the same structural shape:

```
[icon mode-name]         [share-icon]
[panel content]
```

No new translation key — reused the existing `t.quizMode`
("Quiz Mode" / "Quiz Modus") that's already in data.js for
other surfaces (Settings, Help).

**Hidden in the all-66 celebration state.** When the user has all
66 books confident, the Quiz panel renders the celebration card
(trophy + title + total time + Share/Start-new buttons). A
section header above the celebration would compete with the
trophy and the orange "All 66 books confident!" title for
visual hierarchy, so we suppress the header in that state:

```jsx
{confidentCount !== 66 && (
  <h2 className="dashboard-panel-title">🎯 {t.quizMode}</h2>
)}
```

The share icon stays where it was (top-right of the panel) and
keeps working identically.

## CSS class rename

The Box dashboard title's CSS rule was previously named
`.boxmode-dashboard-title`. Since both panels now use the same
visual treatment, renamed it to `.dashboard-panel-title` and
applied to both. The Box panel JSX was updated to use the new
class name. Old class name is gone — no remaining references.

The rule also gained `padding-right: 44px` to reserve clearance
for the absolutely-positioned share icon button (36px wide + 8px
gap). Without this, longer translated titles ("Quiz Modus") could
overlap the icon on narrow viewports.

## Files touched

- `src/App.jsx` — added Quiz panel title, switched Box panel
  title class name.
- `src/App.css` — renamed `.boxmode-dashboard-title` to
  `.dashboard-panel-title`, added `padding-right`.

No data.js, no other files.

## Smoke test

1. **Mobile (412px) Quiz Mode tab:** "🎯 Quiz Mode" header on
   the left, share icon on the right. Balanced. Stat cards (0/66)
   sit below the header, not above.
2. **Mobile Box Mode tab:** "📦 Box Mode" header still there
   (unchanged), share icon balanced. Identical to before.
3. **Mobile Quiz Mode + all-66 confident:** celebration card
   renders without the section header — trophy stays the
   dominant focal point.
4. **Desktop (≥1024px) both tabs:** headers render at the wider
   width without visual issues.
5. **Switch between Quiz and Box tabs quickly:** mode-cards row
   stays anchored vertically (grid overlay still doing its job).
6. **Dutch language toggle:** "🎯 Quiz Modus" / "📦 Doos Modus"
   both render correctly, share icon doesn't overlap title.
7. **Tap share icon in either tab:** opens share flow as
   before. No behavior change.

---

# v5 commit 5.1 — Scope picker: long-press → filter-chip tap-to-toggle

After v5 shipped, Jonathan asked how multi-select is handled in
modern software. Honest answer: filter-chip tap-to-toggle is the
standard pattern for small fixed-list selections (Material 3 filter
chips, Google Photos filter row, Spotify genre selection, Airbnb
amenity filters). Long-press was the wrong tool for this surface:

- **Discoverability:** users won't find a long-press gesture without
  reading hint text — and we had to add hint text precisely because
  of that. Filter chips don't need explanation.
- **Timing risk:** accidental holds during a mobile scroll could
  trigger an unintended toggle. Releasing just before the 500ms fire
  point would trigger an unintended replace. Both failure modes
  vanish with tap-to-toggle.
- **Pattern mismatch:** long-press conventionally means "I want to
  do something OTHER than open this." Scope chips aren't openable —
  they're filters. So there's no second action to disambiguate from.

Jonathan's stated goal — "I want it to work good on all devices" —
favors tap-to-toggle: works identically on touch, mouse, and
keyboard, no platform-specific timing windows, no special gestures
to learn.

## Behavioral spec (unchanged from v5)

The toggle logic is exactly the same as v5's long-press handler.
Only the input is simplified:

- **Tap 'All 66 books'** → replace selection with just `['all']`.
  ('all' is the catch-all reset; mutually exclusive with groups.)
- **Tap a group while 'all' is selected** → drop 'all', select just
  that group. Starts a fresh multi-selection.
- **Tap a group while other groups are selected:**
  - already in selection → remove it (toggle off)
  - not in selection → add it
  - removing leaves empty → fall back to `['all']`
  - adding reaches all 9 → collapse to `['all']` (canonical form)

Canonical scope keys (`'all'` / `'group:xxx'` / `'multi:gospels+law'`
with sorted IDs), the personal-best storage path, the in-session
pill summary, and the end-screen scope label all stay identical to
v5. Only the input gesture changes.

## Code removed

- `holdingScopeId` state + `pressTimerRef` + `pressFiredRef` refs
- `LONG_PRESS_MS` constant
- `cancelHoldTimer`, `handleScopeLongPress`, `handleScopePointerDown`
  callbacks
- `handleScopeClick` (the old short-tap "replace" handler — the new
  `handleScopeTap` does toggle for all chips, which is what the user
  actually wants every time)
- `.boxmode-scope-option.holding` CSS rule + `.holding::before`
  pseudo-element + `@keyframes boxmode-hold-fill`
- Pointer event props on chips (`onPointerDown`, `onPointerUp`,
  `onPointerLeave`, `onPointerCancel`)
- v5's hint text "Tap to choose · long-press to combine" — no
  longer relevant
- `boxModeScopeMultiHint` translation key in both languages
  (Dutch + English entries removed)

## Code added

- `handleScopeTap(scopeId)` — one unified handler doing the toggle
  logic for all chips. Replaces both `handleScopeClick` and
  `handleScopeLongPress`.

## Selection summary line

The summary line below the picker (e.g. "Pentateuch · Gospels — 9
books") is kept — still useful for confirming what the multi-scope
combination will train. But it now appears ONLY when 2+ chips are
selected. For single-scope selections, the picker's own
selected-chip highlight is sufficient — no extra text below.

`.boxmode-multi-hint` CSS class name kept (less churn than renaming
to `.boxmode-selection-summary`), styling unchanged. The class is
now only ever applied to the summary line, never to a hint.

## Files touched

- `src/components/BoxMode.jsx` — state, removed handlers, added
  handleScopeTap, simplified chip JSX, simplified summary line.
- `src/components/BoxMode.css` — removed holding rules + keyframes,
  kept .boxmode-multi-hint (now repurposed for summary only).
- `src/data.js` — removed `boxModeScopeMultiHint` from both
  languages.

## Smoke test

1. **Picker initial state:** 'All 66 books' selected, no summary
   line below.
2. **Tap Pentateuch:** 'All' deselects, Pentateuch selected. Still
   no summary line (only 1 chip selected).
3. **Tap Gospels:** both Pentateuch and Gospels highlighted.
   Summary line appears: **"Pentateuch · Gospels — 9 books"**.
4. **Tap Pentateuch again:** it deselects. Only Gospels remains.
   Summary line disappears.
5. **Tap Gospels again:** would leave empty → falls back to 'All
   66 books' (auto-recovery).
6. **Tap each of 9 groups in turn:** when the 9th is tapped, all
   collapse to 'All 66 books' (canonical form).
7. **Tap 'All 66 books' while groups are selected:** acts as
   reset — replaces selection with just 'all'.
8. **Mobile:** every tap toggles. No scroll-vs-tap conflict, no
   timing window. Same behavior as desktop.
9. **Keyboard:** focus a chip with Tab, press Enter/Space to
   toggle. Works as a regular button.
10. **Tap Start session with multi-scope:** session starts with
    the union of selected books. In-session pill shows
    "📦 Pentateuch · Gospels". End screen shows
    "Pentateuch · Gospels cleared!".

## Why not show a "Clear" or "Reset" button?

Spotify and other filter-chip UIs sometimes have a separate "Clear
filters" link. Not needed here — tapping 'All 66 books' is already
the reset (it's a chip in the picker itself, mutually exclusive
with groups). One chip serves the catch-all + reset role.

---

# v5 commit 5 — Box Mode scope picker UX

Three related changes to Box Mode that were queued at the start of
the v4 work but pushed back repeatedly while we cleaned up the
home dashboard. Now shipped as a single commit since they all touch
the same files and the same UX surface.

## 1. Remove the grey-out of out-of-scope books in the in-session grid

Pre-v5: while playing a scope-restricted session (e.g. Pentateuch
only), all 66 books rendered in the grid, but the 61 out-of-scope
books were `opacity: 0.4` and `disabled` — a visual grey wash. The
intent was to communicate "you can't tap these," but Jonathan
flagged that the wash also tells the user where the answer pool is,
which defeats part of the test. The grid is supposed to feel like
"find Leviticus among all the books," not "find Leviticus among
these 5 highlighted slots."

**Change:** dropped `.book-cell.boxmode-out-of-scope { opacity: 0.4;
cursor: not-allowed; }` from BoxMode.css, and removed the
`boxmode-out-of-scope` class from the className string in
BoxMode.jsx (line 796 of the pre-v5 file). Also dropped `!isInScope`
from the `disabled` attribute so out-of-scope cells stay tab-
focusable — but the existing `onClick={() => isInScope &&
handleBookClick(book)}` guard already no-ops out-of-scope taps,
so behavior is preserved.

Added `aria-disabled={!isInScope ...}` so assistive tech still
announces the out-of-scope state without the visual grey-out
giving the answer away.

## 2. Long-press multi-select on the scope picker

Pre-v5: scope was a single string in component state, and tapping
a scope chip replaced the selection wholesale. There was no way to
say "Pentateuch + Gospels" without playing each separately.

**Design:**
- **Short tap** on a scope chip → replace selection with just that
  scope. Identical to old behavior.
- **Long-press** (held 500ms) on a group chip → toggle that group
  in/out of a multi-selection. Visual feedback during the hold is
  an amber wash that fills the chip from left to right over the
  500ms (CSS `@keyframes boxmode-hold-fill`). If released early,
  the wash snaps off and it counts as a short tap.
- **Long-press on 'All 66 books'** → treated as a short tap (the
  catch-all isn't multi-selectable; replaces selection with just
  'all').
- **Auto-normalize:** if the user selects all 9 groups via
  multi-select, the canonical key collapses to `'all'` (so personal-
  best storage doesn't fragment into a redundant 9-group multi
  entry). If they deselect everything, fall back to `['all']`.

**Implementation:**
- Replaced `const [scope, setScope] = useState('all')` with
  `const [selectedScopes, setSelectedScopes] = useState(['all'])`.
- Added `pressTimerRef` for the 500ms timer and `pressFiredRef` for
  the "long-press already fired this interaction" flag that
  prevents the click event following pointerup from re-firing the
  short-tap.
- Pointer events: `onPointerDown` starts the timer, `onPointerUp` /
  `onPointerLeave` / `onPointerCancel` all cancel it. Click handler
  reads `pressFiredRef` and bails out if a long-press already
  fired during the same interaction.
- New `holdingScopeId` state drives a `.holding` CSS class on the
  chip currently being held, which triggers the fill animation.

## 3. Canonical scope keys + multi-scope storage

A multi-scope session needs a canonical storage key so the same
combination (e.g. Pentateuch + Gospels) always compares against the
same personal best across sessions. Without a canonical form,
selecting `['group:law', 'group:gospels']` and
`['group:gospels', 'group:law']` would store under two different
keys despite being the same set.

**Key format (canonical, sorted alphabetically):**
- `'all'` — the catch-all (66 books).
- `'group:law'` / `'group:gospels'` / etc. — single group, unchanged
  from v4.
- `'multi:gospels+law'` — 2-8 groups, IDs sorted alphabetically and
  joined with `+`. The sort is the canonicalization step.

**`computeScopeKey(selectedScopes)`** (module-level helper) does the
sort + format. **`filterBooksByScope`** in boxMode.js was extended
to recognize the `'multi:'` prefix and filter accordingly. Both
single-scope formats keep working — fully backward-compatible.

**`scopeDisplayName(scopeKey, lang, t)`** (module-level helper)
formats any canonical key for display:
- `'all'` → "All 66 books" / "Alle 66 boeken"
- `'group:law'` → "Pentateuch"
- `'multi:gospels+law'` → "Pentateuch · Gospels"
  (group order preserved from the canonical sort; middle dot
  separator).

Used in three places:
- Selection screen: when multi-select is active, a `<strong>` line
  beneath the multi-hint shows the current selection summary
  ("Pentateuch · Gospels — 9 books"). Updates live as the user
  toggles groups.
- Playing-screen pill: replaces the previous generic
  `t.boxModeInProgress` ("Box Mode") text with the scope summary.
  E.g. "📦 Pentateuch · Gospels" while you're mid-session. Keeps
  the user oriented and serves as a sanity check for multi-scope
  selections.
- End screen: scope label uses the helper, so completion titles
  like "Pentateuch · Gospels cleared!" work without crashing the
  old `.split('—')` path.

## Multi-scope personal-bests behaviour

`boxModeStorage.js` was not modified. The existing
`recordCompletion(userId, scope, sessionData)` already keys on
whatever scope string the caller passes — so multi-scope sessions
DO get their own personal-best entries automatically, e.g.
`user.boxModeBests['multi:gospels+law']`.

App.jsx's home dashboard records list (the `BOX_SCOPE_KEYS` array
at line ~841) only lists the canonical 9 single-scope keys, so
multi-scope entries are stored but NOT shown in the home
dashboard records list. They DO appear in the end-screen
"previous best" comparison after completing the same multi-scope
combination twice. This is intentional: the home dashboard is the
single-scope leaderboard, and the user-driven combinations stay
in the per-session feedback loop without cluttering the
canonical list.

(If you decide later you DO want multi-scope bests visible on
home, the smallest change would be appending a `'multi:*'` filter
to the App.jsx mapping that pulls multi entries below the 9
canonical ones. Deferred — let's see if the multi-select feature
even gets daily use first.)

## Pause / resume

Pause snapshot (`onPause({ scope, state, pausedAt })`) now reads
the scope string from `stateRef.current.scope` rather than from
component state. `state.scope` is set by `createInitialState` from
the canonical key, and is the source of truth during a running
session. This is functionally equivalent to the v4 behavior for
single-scope sessions and correct-by-construction for multi-scope.

On resume, the resume effect populates `selectedScopes` from the
paused canonical key so that if the user backs out via "Another
selection" on the end screen, they see their previous multi
already highlighted in the picker. Pure cosmetic — not required
for the resumed session itself to work.

## Files touched

- `src/boxMode.js` — `filterBooksByScope` extended for `'multi:'`.
- `src/components/BoxMode.jsx` — state, helpers, long-press
  handlers, picker JSX, pill text, end-screen label, book-cell
  className + disabled.
- `src/components/BoxMode.css` — removed grey-out, added
  `.boxmode-scope-option.holding` + keyframes, added
  `.boxmode-multi-hint` styles.
- `src/data.js` — added `boxModeScopeMultiHint` (both languages)
  and `book` singular key (both languages).
- `src/App.jsx` — not modified. The home dashboard's
  `BOX_SCOPE_KEYS` filter naturally excludes multi entries.

## Smoke test

1. **Box Mode → scope picker:** all 10 chips render (1 catch-all
   + 9 groups), 'All 66 books' is selected by default.
2. **Short-tap a group:** selection replaces with that group only,
   amber border highlights it.
3. **Long-press a group (hold 500ms):** chip fills with amber wash
   over 500ms. On fire, 'all' chip deselects (mutually exclusive),
   pressed group becomes selected. Multi-hint line appears below
   the picker with selection summary.
4. **Long-press a second group:** both stay selected. Summary
   updates: "Pentateuch · Gospels — 9 books".
5. **Long-press one of the selected groups:** that group toggles
   off. If only one remains, it stays as single-scope.
6. **Long-press 'All 66 books':** treated as short-tap, replaces
   selection with just 'all'. (Catch-all isn't multi-selectable.)
7. **Tap Start session with multi-scope:** session starts with
   exactly the union of selected books in the pool. In-session
   pill shows "📦 Pentateuch · Gospels".
8. **In-session grid:** all 66 books rendered with normal colors,
   no grey wash. Tapping an out-of-scope book does nothing (no
   click, no error) — silently no-ops.
9. **Complete the multi-scope session:** end screen shows
   "Pentateuch · Gospels cleared!" title. First completion: "new
   personal best!" indicator. Second completion of same
   combination: comparison vs previous time.
10. **Pause + resume:** during a multi-scope session, tap Back →
    Resume on home screen → re-enters with the same multi-scope
    state. End the session via "Another selection" → scope picker
    shows the previous multi-selection highlighted.
11. **Scroll the picker on mobile:** long-press accidentally
    triggered during a scroll should NOT toggle — `onPointerLeave`
    / `onPointerCancel` cancel the timer when the pointer moves
    off the chip during a scroll gesture.

## Decisions deliberately deferred

- Multi-scope entries in the home dashboard records list — needs
  UX thinking about whether to show them and how (alphabetical?
  grouped? capped at most-recent-3?). Deferred until daily-use
  feedback.
- Long-press discoverability on desktop without touch — the hint
  text says "long-press to combine" regardless of pointer type.
  Mouse-down-and-hold works identically to touch-and-hold, so the
  feature is usable, but desktop users may not find it without
  reading the hint. Acceptable trade for v5.

---

# v4 commit 4.12 — Remove dashboard-panel min-height floor

After 4.10 (compact celebration) and 4.11 (single Start button)
shipped together, Jonathan reported the empty space in the Box
panel was still bothering him. The 4.10 compaction did its job
visually (celebration shrunk by ~110px), but when the celebration
isn't currently rendering — e.g., after a reset, when confidentCount
is 0 — the compaction has nothing to do. In that state, the
empty Box panel comes from `.dashboard-panel { min-height: 360px }`,
which was introduced in v4.1 as a tab anchor.

**Why min-height was there:** in 4.1, when only one of the two
panels was rendered at a time (not both in a grid overlay), the
panel collapse on mode switch made the mode-cards row beneath it
jump vertically. min-height: 360px fixed the floor so the
collapse couldn't happen. That worked for what 4.1 needed.

**Why it's no longer needed:** in 4.2 we introduced the grid
overlay — both panels live in the same grid cell
(`.dashboard-area`: 1 col, both panels at `grid-row: 1`,
`grid-column: 1`). The grid cell sizes to the **taller of the
two** panels' natural content. Switching modes flips visibility
but doesn't change the grid cell's height, so the mode-cards row
beneath stays anchored. min-height became dead weight from that
moment on — it only contributed by adding extra empty space when
the natural max-content height was below 360px (which is the
typical case after a reset).

**Change:** removed `min-height: 360px` from both rules:
- `.dashboard-panel` base rule
- `.dashboard-area > .dashboard-panel` grid-cell rule

**Expected effect on Box panel empty space:**

Before 4.12:
- Quiz no-celebration (0 confident, post-reset): panel was
  `max(stats+tier-bar ~280px, min-height 360px) = 360px`.
  Box content ~80px, empty ~280px.
- Quiz celebration: panel was `max(380px after 4.10 compaction,
  min-height 360px) = 380px`. Box content ~80px, empty ~300px.

After 4.12:
- Quiz no-celebration: panel = ~280px (natural). Box empty
  ~200px (was 280).
- Quiz celebration: panel = ~380px (4.10-compacted natural).
  Box empty ~300px (unchanged — celebration was already taller
  than min-height).

So the win is specifically in the non-celebration state, which is
what Jonathan's screenshots showed. Celebration state is already
where 4.10 wanted it.

**Files touched:** `src/App.css` only. No JSX, no i18n.

## Smoke test

1. **Quiz Mode, post-reset (0 confident):** stats + tier-bar tightly
   packed at top of dashboard area. Mode-cards row should sit
   noticeably closer than before — gap drops by ~80px.
2. **Switch to Box Mode:** white card height matches the new Quiz
   panel height. Empty space below "Pentateuch (5 books)" should
   visibly shrink.
3. **Quiz Mode, all-66 celebration:** layout unchanged from 4.11
   (celebration was already the binding constraint).
4. **Switch between Box and Quiz tabs rapidly:** mode-cards row
   should NOT jump vertically. Both panels' natural height is the
   same (grid overlay matched), so tabs stay anchored.
5. **Mobile 412px:** same effects, proportionally.

If after 4.12 there's STILL too much empty space and Jonathan
wants to attack the issue further, the next lever would be
dropping the grid overlay entirely (tabs would jump when
switching modes, but Box panel would collapse to its natural
~80px height when Box is selected). That's a UX trade — we'd
need to decide if the jump is worth the visual cleanliness.

---

# v4 commit 4.11 — Single "Start Quiz Mode" button (drop Quick/Standard/Full)

Jonathan flagged that the three-tier Quick / Standard / Full
launcher chips were:
- Visual clutter (three stacked options where one would do)
- Specifically broken on mobile (412px portrait): the 66-books
  Full chip got pushed below the fold and required scrolling
- Inconsistent with the Box Mode pattern, which is one button

His reasoning, which is correct: the user can stop a Quiz session
at any time via the back arrow — the pre-committed session size of
5 / 10 / unbounded was never actually enforced. It was purely
informational, and on reflection, not informational enough to earn
its vertical real estate.

**Change:** replaced the entire `.home-quiz-launchers` block (paused
+ non-paused branches) with a structure that mirrors the Box Mode
pattern exactly:

```
selectedMode === 'boxMode' ? (
  pausedBoxSession ? <Resume+Discard> : <Start Box Mode button>
) : (
  pausedQuizSession ? <Resume+Discard> : <Start Quiz Mode button>
)
```

The new Start Quiz Mode button uses `setQuizSessionLimit(null)` —
identical to the old "Full" option's behavior. Session is
unbounded; user stops by tapping the back arrow when done.

The paused-Quiz Resume/Discard buttons keep their previous shape
and onClick handlers; only the wrapping `.home-quiz-launchers` div
is removed, so they now sit as direct children of
`.home-launcher-area` (which already has `width: 100%` from
Commit 4.9, so they fill the area naturally).

**Files touched:** `src/App.jsx` only (one block replacement).

**Removed in this commit (dead code):**
- The `trainingPool` / `nonConfidentCount` calculation in the
  launchers block — only used to gate which chips to render.
- The launchers `.map` rendering 3 buttons.

**Kept as dormant (no longer referenced anywhere):**
- Translation keys: `sessionSizeQuick`, `sessionSizeStandard`,
  `sessionSizeFull`, `sessionSizeBooks`, `sessionSizeBookSingle`.
  Left in `data.js` because removing them is touchy if any other
  surface (Settings? Help page?) ends up referencing them
  elsewhere. They're harmless if unused.
- CSS class `.home-quiz-launchers` and its associated rules in
  `App.css`. No element now has this class. Cleanup deferred to a
  later commit if no regression appears.

**Maintenance-mode fallback (from Commit 4.3) still applies.** When
the user has all 66 confident AND nothing FSRS-due, the start
button still works — `pickNextBook`'s maintenance branch picks
from the lowest-stability books to keep the user busy. The
trainingPool=0 → 66 fallback isn't needed here because there are
no longer any chips to gate.

## Smoke test

1. **Desktop, Quiz Mode + no paused session:** single "Start Quiz
   Mode →" button (mirrors Start Box Mode shape, same `.home-start-btn`
   styling). Tap → enters session.
2. **Desktop, Quiz Mode + paused session:** Resume + Discard
   buttons, identical to before (just no longer wrapped in
   `.home-quiz-launchers`).
3. **Mobile 412px portrait:** no scrolling needed below the mode-
   cards row to see the action. The single Start button sits
   directly under the Box/Quiz tab row.
4. **Reset progress, Quiz Mode + 0 confident + 66 unseen:** the
   Start button works. No "Full · 0" edge case can appear.
5. **All-66 confident + nothing FSRS-due:** Start button still
   works, session enters maintenance mode (pickNextBook lowest-
   stability branch).

---

# v4 commit 4.10 — Compact celebration card

v4.9 fixed the alignment so the dashboard panel, mode-cards row, and
launchers all line up edge-to-edge. But the screenshot revealed a
secondary issue: the Quiz Mode all-66 celebration card was tall
(~500px) and the grid overlay was matching the Box panel height to
it. So when Jonathan switched to Box Mode he saw a panel that was
~80px of content sitting in ~500px of card — visually broken-looking
even though structurally correct.

Two options were on the table:
- A. Drop the grid overlay — Box panel takes its natural ~120px
     height, tabs jump by ~380px when switching to Quiz with the
     celebration.
- B. Compact the celebration card so the grid match target shrinks.

Picked B. The celebration's "achievement" feel is carried mostly by
the orange title text, gradient background, and bouncing trophy
animation — not the absolute size of any single element. Reducing
the dimensions while preserving the elements keeps the celebration
recognizable but stops it from inflating the panel height.

**Changes (all CSS-only, App.css):**

- `.celebration-66` padding `1.4 1.2 1.6` → `1.1 1.2 1.2`, gap
  `0.9rem` → `0.7rem`.
- `.celebration-trophy` font-size `3.2rem` → `2.6rem`. Bounce
  animation preserved.
- `.celebration-time` padding `0.6 1.4` → `0.5 1.4`, gap `0.2rem`
  → `0.15rem`, min-width `60%` → `50%`.
- `.celebration-time-label` font-size `0.75rem` → `0.7rem`.
- `.celebration-time-value` font-size `1.4rem` → `1.25rem`.
- `.celebration-actions` — new desktop media query at min-width
  480px: `flex-direction: row`, `max-width: 480px`. Each child gets
  `flex: 1; min-width: 0`. Mobile (<480px) keeps the existing
  stacked column layout because side-by-side at narrow viewports
  would cramp each button.

**Expected height reduction:**
- Trophy: ~10px
- Padding (top+bottom): ~11px
- Gap × 5: ~16px
- Stacked buttons → side-by-side: ~60px
- Time card tightening: ~10px

Total: ~100-110px. Celebration goes from ~500px to ~390-400px.
After grid-overlay matching, Box panel sits at the new ~390px
instead of the previous ~500px. Empty space inside Box dashboard
drops by ~110px.

No JSX or i18n changes — the celebration's content and elements
are unchanged, only their dimensions.

## Smoke test

1. Desktop, Quiz Mode home with all-66 confident: celebration
   card visibly more compact. Share + Start a new run buttons
   side-by-side. Trophy still bouncing, title still orange.
2. Switch to Box Mode (with or without paused session): empty
   space below Pentateuch row noticeably smaller.
3. Mobile ~412px viewport: celebration buttons still STACKED
   (column) — the side-by-side rule only kicks in ≥480px.
4. Achievement feel: still feels celebratory, not deflated.

## Decisions deliberately deferred

- Box dashboard's structural empty space (when user has 1-8 of 9
  scope records done) — not addressed. The complaint earlier was
  "don't show information just to show information"; placeholder
  rows for unplayed scopes would violate that. After 4.10 the
  empty area is acceptable.
- Box Mode scope picker UX (long-press multi-select, no grey-out
  of unselected books, selection summary above grid) — queued
  for Commit 5.

---

# v4 commit 4.9 — Fix: width: 100% missing on flex children

v4.8 introduced the responsive `--content-max-width` token and removed
the individual max-widths on `.mode-cards`, `.dashboard-panel`,
`.home-quiz-launchers`, and `.home-start-btn`. The intent was that
each would fill 100% of `.menu`'s width. But the testing screenshot
showed the dashboard panel and the Resume/Discard button cluster
sitting visibly narrower than the mode-cards row above them.

**Root cause:** `.menu` is `display: flex; flex-direction: column;
align-items: center`. Under `align-items: center`, flex children
WITHOUT an explicit `width` shrink to their content's natural width
instead of stretching. `.mode-cards` and `.home-quiz-launchers` and
`.home-start-btn` had `width: 100%` directly in their base rules so
they worked. But `.dashboard-area` (added in v4.2 as the grid
wrapper for tab anchoring) and `.home-launcher-area` (the wrapper
around the Box Mode Start button / Quiz mode launchers / paused-
session Resume button) both lacked `width: 100%` — they were just
positioned containers with grid/flex/min-height set, no explicit
width. So both shrank to content size, and their children inherited
the constraint.

Same issue affected `.home-launcher-btn` when rendered as a
standalone button (the Resume + Discard pair in Box Mode + paused
state). Inside `.home-quiz-launchers` (flex row at desktop) the
`flex: 1` rule sized them; standalone in `.home-launcher-area` they
had no flex parent forcing a width and shrank to content.

**Fix:** added `width: 100%` to three rules:
- `.dashboard-area`
- `.home-launcher-area`
- `.home-launcher-btn`

The `.home-launcher-btn` addition is safe inside the desktop row
layout — `flex: 1` shorthand means `flex-basis: 0`, which takes
priority over `width` in flex sizing calculations. Items still
share the row evenly.

## Why I missed this in v4.8

Removed the wrong half of the equation. I removed the per-element
`max-width: 520px` rules thinking the token-driven `.menu` width
would cascade through naturally. It does cascade for elements that
already had `width: 100%` set (mode-cards, launchers, start-btn).
But for `.dashboard-area` and `.home-launcher-area` — which were
internal layout wrappers, not directly user-visible — neither had
`width: 100%`, and the issue went unnoticed because the previous
per-element max-widths were the same as the menu width, so the
shrunk-to-content behavior happened to land at the same visible
width.

## Smoke test

1. Desktop: open Box Mode dashboard with paused session. The
   dashboard panel, mode-cards row, AND Resume/Discard buttons
   should all be the same width (~800px), edge-to-edge aligned.
2. Open Quiz Mode launchers state: Quick/Standard/Full chips
   should span the same width as the row above.
3. Mobile portrait (~412px): no regression. All elements at 100%
   of viewport minus padding.

---

# v4 commit 4.8 — Responsive content-max-width system

After several commits cycling between "too narrow" and "too wide" and
"mismatched," the user's final request: "I want it to look good on
all devices. Think hard about this. Do research."

Did the research (Baymard, MediaWiki 2023 redesign, Material Design 3
window size classes, MDN responsive design guidance). Settled on a
proper responsive system with ONE max-width token controlling the
whole "page chrome" — applied consistently to home, settings, and
help — letting the in-session training grid escape the cap for
maximum book visibility.

## The token: --content-max-width

```css
:root                       { --content-max-width: 100%; }   /* mobile compact */
@media (min-width: 480px)   { :root { --content-max-width: 460px; } }
@media (min-width: 768px)   { :root { --content-max-width: 640px; } }
@media (min-width: 1024px)  { :root { --content-max-width: 800px; } }
```

No further bump at ≥1280px. Research consensus: lines longer than
~80 characters reduce reading comprehension (Baymard, WCAG 1.4.8).
At our typography, 800px caps line length around 65-70ch — the sweet
spot. Letting the container grow on 1440px+ monitors would just
make Help text harder to read.

## Where it's applied

- `.menu` (home screen)
- `.settings-page` (Settings page wrapper)
- `.help-page` (Help page wrapper)

NOT applied to:
- The in-session book grid — needs maximum book visibility, that's
  the functional exception the user explicitly wanted.
- Box Mode scope picker — bypasses for similar reasons.

## Interior elements fill 100% of the container

`.mode-cards`, `.dashboard-panel`, `.home-quiz-launchers`,
`.home-start-btn` all had their own `max-width: 520px` rules that
were independent of the menu width. Removed those. Each now fills
100% of `.menu` width, scaling naturally with the responsive token.
No per-element overrides to keep in sync; no cascade source-order
traps (the v4.4 → v4.6 saga).

The v4.6 desktop-only override block at the end of App.css is gone —
redundant under the new system.

## Mode-cards get descriptive subtitles

The cause of the "hollow cards" problem in earlier commits was sparse
content (just an emoji + a word) inside a wide container. At 800px
content width, each mode-card is ~395px wide. With only an icon and
a label, that's a lot of empty rectangle. Fixed at the source by
adding a one-line subtitle under each label:

- **Box Mode** / "Speed-sort against the clock" / "Snel sorteren tegen de klok"
- **Quiz Mode** / "Long-term spaced review" / "Lange-termijn herhaling"

Two wins: (1) the cards now have content that justifies the wider
container, and (2) newcomers can tell the two modes apart without
having to play each. Smaller + muted vs the main label so visual
hierarchy stays clear (icon → name → description).

New translation keys: `boxModeSubtitle` (NL + EN), `quizModeSubtitle`
(NL + EN).

New CSS class: `.mode-card-subtitle`.

## Why this works on every device

- **Mobile compact (320-479px):** menu fills viewport minus padding.
  Mode-cards stack as a 2-column grid; subtitles wrap to 2 lines on
  the narrowest devices, no truncation (readability > brevity).
- **Mobile landscape / small phones (480-767px):** 460px content
  width. Comfortable focus column.
- **Tablet (768-1023px, Material "Medium" class):** 640px content.
  Mode cards have room for the subtitle on one line.
- **Desktop (1024px+, Material "Expanded"+):** 800px content. Single
  consistent width across home, settings, help. Matches what the
  user pointed at as their target ("the same as when clicking help
  or settings").
- **Ultra-wide (1920px+, 2K+):** stops growing at 800px. Never looks
  edge-to-edge or "lost in space" on a wide monitor.

## What didn't change

- The grid overlay for tab anchoring (v4.2) stays. Quiz panel with
  celebration is still taller than Box panel; switching tabs doesn't
  jump them.
- The Box dashboard layout from v4.5 (title + records + empty state
  hint) stays. The empty space below the Box panel when Quiz panel
  is in celebration state is still present — that's the grid-overlay
  trade-off, and addressing it is a separate concern (would mean
  compacting the celebration, which is its own decision).
- Settings.css and Help.css internals weren't touched. The new
  `.settings-page` / `.help-page` max-width rules in App.css only
  constrain the outer wrapper; any inner styles in their respective
  CSS files keep working.

## Smoke test (run on multiple viewports)

1. **Desktop (1820px wide):** Home dashboard panel, mode-cards,
   launchers all the same width (~800px), aligned edge-to-edge.
   Navigate to Settings: same width. Navigate to Help: same width.
2. **Mode-card content:** each mode-card shows emoji + label +
   subtitle. Box Mode subtitle visible. Quiz Mode subtitle visible.
   No empty space inside the cards.
3. **Tablet (~768-1023px):** content caps at 640px, still consistent
   across pages, mode-card subtitles fit on one line.
4. **Mobile portrait (~412px):** content fills viewport minus padding.
   Mode-cards stack in 2 columns, subtitles wrap to 2 lines if needed.
5. **In-session grid:** start a Quiz or Box session, the book grid
   ignores the content cap and uses full viewport width (functional
   exception preserved).
6. **No cascade conflicts:** all per-element max-widths are removed,
   so DevTools "Computed" should show clean values driven by the
   --content-max-width token at each breakpoint.

---

# v4 commit 4.6 — Fix: desktop max-width overrides weren't being applied

User asked why the dashboard panel was narrower than the Box Mode /
Quiz Mode tab row sitting below it on desktop. Inspected: my v4.4
desktop max-width overrides (`.mode-cards`, `.dashboard-panel`,
`.home-quiz-launchers`, `.home-start-btn` → 640px) were not taking
effect at all. They appeared in DevTools as crossed-out rules.

**Root cause:** the media query I added in v4.4 lived near the TOP
of App.css (line ~167), but each of the four selectors has a base
rule with `max-width: 520px` further DOWN the file (lines 683, 810,
964, 1007). When two rules have equal specificity, CSS cascade
prefers the rule that comes later in source order. The base 520px
rules came later, so they won — my 640px overrides were dead code.

**Fix:** moved the media query to the very end of App.css. Now it
comes after every base rule, wins the cascade, and the four
elements actually scale to 640px on desktop. Mode cards, dashboard
panel, launchers, and start button now all share the same 640px
cap and align edge-to-edge horizontally on desktop. The user no
longer sees the dashboard panel floating narrower than the row
below it.

I'd assumed v4.4's media query was working because the menu
container `max-width: 720px` rule WAS taking effect — that rule
also lived in the top media query but `.menu` has no later base
rule overriding it (the original `.menu` rule is at line ~152,
BEFORE the media query at 167). So one part of v4.4 worked and
the other didn't, masking the bug. Lesson: when adding CSS
overrides, check that no later base rule will clobber them.

## Smoke test

1. Open on a wide desktop viewport (≥768px). Box Mode dashboard
   panel and the mode-cards row below it should now be the same
   visible width (~640px each), aligned edge-to-edge.
2. Same check on Quiz Mode: the celebration card spans the same
   width as the mode-cards below.
3. Launcher chips (Quick / Standard / Full) span the same width.
4. Mobile (≤767px viewport) unchanged — all four still at 520px
   max-width, no regression.

---



Tester feedback after 4.4: "it is like to show information just to
show information... not interesting... useless information." Three
specific complaints, all valid.

## What was wrong

The 4.1–4.4 evolution tried to mirror Quiz Mode's "stats + bar +
list" pattern onto Box Mode out of design symmetry. That was the
wrong instinct: the two modes have fundamentally different
information shapes.

Quiz Mode is a long-running progression — there's a gold-line goal,
daily training metrics, tier transitions. Stats and bars genuinely
help you read where you are in that arc.

Box Mode is episodic — each scope is a one-off completion challenge
with a best time to beat. There's no "progression" to summarise.
The stats and bar were filling slots in a template, not
communicating anything.

## What was cut

- **Stats row** ("X of 9 played" / "Y left to play"). Clear after
  v4.4's label fix, but as the tester said: "now I understand what
  1 of 9 played means. But it is not interesting." The user can
  count the rows below for themselves. Removed.
- **9-segment scope bar.** Visually pretty but said nothing the
  records list below didn't say. Tester's actual reaction:
  "And what does this mean? Is it because only the second of 9 is
  done? Complete useless information." Removed.
- **All-9 list with placeholder rows.** Eight rows of "Not yet
  played" alongside one row of a real record was filler. The user
  knows there are multiple scopes; the picker inside Box Mode is
  where they'll discover them. Removed.
- **"Best Times" subtitle.** Overkill when there's only 1 record.
  Removed.

## What stays

- Title (`📦 Box Mode`).
- Share icon (top-right).
- Records the user has actually earned — only cleared scopes, sorted
  in canonical scope order (All 66 → Pentateuch → ... → Revelation)
  so the list is stable across visits. Without sorting, completing
  a new scope reshuffles the order, which is disorienting.
- All-cleared celebration card (trophy + title + body) when all 9
  scopes have been completed at least once.
- An empty-state hint when there are no records yet: a single
  centered line of text saying to tap Start Box Mode.

## Layout consequence

The Box panel is now naturally shorter than Quiz panel — especially
shorter than Quiz at the all-66-celebration state. The 4.2 grid
overlay still sizes both panels to the max of either, so when Box
is selected with few records, there's some empty space below the
content. That empty space is honest — it's not filler pretending
to be data — and is the right tradeoff vs the alternatives:

- Filler content: what the user complained about.
- Tabs jumping when switching modes: what the user complained about
  earlier (4.2 commit fixed it via the grid overlay).
- Compacting the Quiz celebration to match Box's height: that would
  diminish the celebration moment for users who hit 66. Deferred.

## CSS cleanup

Removed `.boxmode-scope-bar`, `.boxmode-scope-segment`,
`.boxmode-scope-segment.cleared`, `.boxmode-best-row-empty`,
`.boxmode-best-stats-empty`. Added `.boxmode-empty-hint` for the
empty-state line.

Translation keys `scopesPlayedOf`, `scopesLeftToPlay`,
`boxBestTimesHeader`, `boxNotYetPlayed`, `scopesCleared`, `scopesToGo`
are kept in data.js — they're no longer referenced, but cheap to
preserve in case a future iteration wants them. Future cleanup can
remove them.

## Smoke test

1. Open Box Mode dashboard with 1 cleared scope. You should see:
   title, the 1 record row, nothing else above it (no stats, no
   bar), empty space below.
2. Complete a second scope, return home. The list shows 2 rows in
   canonical order (the new completion appears in its scope-order
   position, not at the top).
3. Open Box Mode dashboard with 0 cleared scopes (fresh account):
   you should see title + a single line "Tap Start Box Mode below
   to begin your first session." No bar, no stats, no empty rows.
4. Complete all 9 scopes (or simulate via localStorage edit): the
   celebration card appears above the records list.
5. Box ↔ Quiz tab switching: tabs stay anchored (the 4.2 grid
   overlay is preserved).

---



Three issues from the same testing session, all rooted in the Box
Mode dashboard feeling cramped/confusing on a wide desktop monitor.

## 1. Desktop content area was phone-sized

`.menu` capped at `max-width: 600px` on desktop, and the four interior
elements (mode cards, dashboard panel, home-quiz-launchers,
home-start-btn) all capped at `520px`. On a 1820px monitor that meant
the entire app ran in a ~520px column with hundreds of pixels of
whitespace flanking it. Looked like a mobile app embedded in a
desktop browser.

**Fix:** bump `.menu` to `720px` on `min-width: 768px`, and bump the
four interiors to `640px` on the same breakpoint. Mobile sizing
(`480px` menu, `520px` interiors) unchanged — only desktop benefits.

Picked 720 over going wider because the app's content (book grid,
celebration card, stats) is genuinely focused — edge-to-edge on a
2K monitor would look like a misuse of space. 720 is the sweet
spot: clearly larger than mobile, still recognisably "a focused
app" not "a website."

## 2. Box panel had a huge empty patch

The 4.2 grid-overlay anchors mode tabs at a stable position by
making both Quiz and Box panels the same height (max of either's
content). Quiz with the all-66 celebration card is ~600px tall;
Box with 1 cleared scope was ~280px tall, leaving ~320px of dead
whitespace at the bottom of the Box panel.

**Fix:** the bests list now renders all 9 scope rows, not just the
cleared ones. Cleared scopes show name + best time + fewest mistakes
as before. Uncleared scopes show name + a muted, italicized "Not yet
played" hint. The full 9-row list naturally fills the panel to a
height close to Quiz's celebration card, plus the user now sees at a
glance which groups they still owe.

New CSS classes `.boxmode-best-row-empty` and
`.boxmode-best-stats-empty` apply the muted/italic styling to
uncleared rows.

## 3. "1 cleared of 9, 8 to go" was unclear, "Personal Bests" was misleading

User asked literally "what does '1 cleared of 9, 8 to go' mean?"
which is the strongest signal possible that the labels weren't
self-explanatory. "Cleared" reads as gaming jargon; "to go" doesn't
state what's being gone to. And "Personal Bests" was misleading
after the 4.4 list change because the list now includes "Not yet
played" rows that aren't bests at all.

**Fixes:**
- Stat 1: `"X cleared of 9"` → `"X of 9 played"`. Reads as a sentence.
- Stat 2: `"Y to go"` → `"Y left to play"`. Explicit about what's left.
- Section header: `"Personal Bests"` → `"Best times"`. Honest about
  what the cleared rows are (best times); the placeholder rows sit
  alongside without claiming to be bests.
- Row placeholder: `"Not yet completed"` → `"Not yet played"`. Aligns
  with the new "played" verb in the stats.

NL parallels: `voltooid/nog te doen` → `van 9 gespeeld/nog te spelen`;
`Persoonlijke records` → `Beste tijden`; `Nog niet voltooid` → `Nog
niet gespeeld`.

New translation keys (NL + EN): `scopesPlayedOf` (with `{total}`
token), `scopesLeftToPlay`, `boxBestTimesHeader`, `boxNotYetPlayed`.
The old `scopesCleared` and `scopesToGo` keys are preserved as
fallbacks — nothing else references them but they'd be cheap to
keep around for any future label experiments.

## 4. Launcher buttons were too small under the mode cards

Quick/Standard/Full at `min-height: 56px` looked disproportionately
small under the ~120px tall Box/Quiz mode cards above them. Looked
like a footer not a primary launch action.

**Fix:** bumped to `min-height: 80px`, `padding: 1rem 1.25rem`,
slightly bigger label and count text. Still clearly smaller than
the mode cards (preserving hierarchy: mode-cards = pictorial tabs,
launchers = text-only sub-actions) but now read as tappable
primary actions, not a forgotten footer.

## Smoke test

1. Open on desktop. Whole layout feels appropriately sized — no
   tiny column floating in the middle.
2. Box Mode dashboard: shows all 9 scope rows, cleared ones with
   time + mistakes, uncleared ones with muted "Not yet played".
3. Stat labels read "X of 9 played" / "Y left to play".
4. List header reads "Best times" (or "Beste tijden" in NL).
5. Quiz Mode launchers (Quick/Standard/Full) feel proportional to
   the mode cards above — comparable visual weight, not footer-like.
6. Mobile sizing unchanged — re-test on a phone viewport.
7. Toggle Box ↔ Quiz mode: tabs still anchored (4.2 fix preserved).

---



Quiz Mode launchers disappeared completely when all 66 books were
confident AND nothing was FSRS-due — the celebration card sat there
as the only thing on the home screen, and the only way to keep
training was "Start a new run" (which resets everything). This was
the wrong default. People who hit 66 gold should be able to keep
their hand in without sacrificing progress.

## Two-part fix

**1. Launcher arithmetic in App.jsx.** Switched from
`stats.dueNow > 0 ? stats.dueNow : nonConfidentCount` to
`Math.max(stats.dueNow, nonConfidentCount)`, with a fallback to 66
when both are zero. The Math.max change was a deferred optimisation
from earlier — the all-66 case forced it. Concretely:

```js
let trainingPool = Math.max(stats.dueNow, nonConfidentCount);
if (trainingPool === 0) trainingPool = 66;
```

In the all-66-confident + nothing-due state, `trainingPool` is now 66,
so Quick (5), Standard (10), and Full (66) all appear as launchers.

**2. `pickNextBook` maintenance branch in QuizGrid.jsx.** When there
is no FSRS-due book, no unseen book, AND no non-confident book to
pick (the "everything is gold" state), the picker previously fired
`setSessionComplete(true)` immediately and the user couldn't proceed.
Now it picks from the books with the lowest FSRS stability — those
are the "weakest" gold-lined books, most likely to drift off the
gold line first if not refreshed. Top 8 by stability ascending,
then random within the pool. Same shape as the existing due-pool
and non-confident-fallback branches.

Filtered by a new `sessionSeenBooksRef` so a Full maintenance
session (`limit: null`, count: 66) terminates naturally when every
book has been touched once. Without the filter the same
lowest-stability 8 would dominate every pick and the session would
loop forever. Quick (limit=5) and Standard (limit=10) end via
sessionLimit either way; only Full needed the filter to terminate.

`sessionSeenBooksRef` follows the existing `confidentBuffersRef`
pattern — a ref mirror of state, synced via useEffect — to avoid
forcing `pickNextBook`'s useCallback to rebuild on every pick.

## What this means for the user

- All 66 confident + nothing due → Quick/Standard/Full all appear.
- A Full maintenance session walks through every book in lowest-to-
  highest stability order (weakest first), in groups of 8 with
  randomisation within each group.
- A Quick maintenance session picks 5 of the weakest 8.
- Standard maintenance: 10 of the weakest 8-ish (the pool refreshes
  between picks as stability changes mid-session).
- The "Start a new run" button stays available for users who want
  to reset and chase a faster Total Time.
- FSRS continues to run underneath; if a maintenance answer is
  wrong, the book drops to non-confident and rejoins the regular
  pool on the next session.

The launcher arithmetic also has a secondary effect for users who
aren't at 66 yet: `Math.max(dueNow, nonConfidentCount)` shows a
bigger pool when non-confident exceeds due. Previously a user with
3 due and 30 non-confident saw Full as "3 books" (the
non-confident books were invisible until the due pool drained).
Now they see "Full · 30 books" — accurate to what a Full run
actually accomplishes.

## Smoke test

1. With all 66 confident AND nothing FSRS-due, the Quiz Mode panel
   shows Quick / Standard / Full launchers below the celebration.
2. Start a Quick session in this state: 5 picks happen, weakest
   books are surfaced more often, session ends.
3. Start a Full session in this state: session iterates through
   all 66 books exactly once, then ends. No infinite loop.
4. With confident < 66 and some due, the Full count equals the
   larger of `dueNow` and `nonConfidentCount`. (Previously it
   was `dueNow` when due > 0.)
5. Existing pause/resume still works in maintenance Full — the
   session-seen Set is part of the pause snapshot, so resume
   continues from where the user paused.

---



Two narrow bug fixes surfaced when smoke-testing Commit 4.1 on a wide
viewport.

## Fix A — Desktop dashboard panel still resized when switching modes

Commit 4.1's `min-height: 360px` on `.dashboard-panel` anchored the
mode tabs on mobile but didn't help on desktop, because the natural
content height of both panels (Quiz with celebration, Box with
multiple bests) exceeds 360px there. With different actual heights
between modes, switching tabs still moved them vertically — the
floor wasn't doing anything.

**Fix:** put both panels in a single-cell CSS grid (`.dashboard-area`,
`grid-template-columns: 1fr`; both children at `grid-row: 1; grid-column: 1`).
The grid cell sizes to the taller of the two. Whichever panel is
inactive gets `visibility: hidden` + `pointer-events: none` — it still
occupies layout space so the cell's max-height calculation is correct,
but it's invisible and untappable. The active panel renders normally
on top. Mode tabs sit below the grid at a stable position regardless
of selection.

`aria-hidden` is set on the hidden panel so screen readers don't
announce its content.

The `min-height: 360px` is preserved as a floor — for fresh accounts
with very short content in both panels, this keeps the layout from
collapsing.

JSX change: the previous `{selectedMode === 'X' && (...)}` conditionals
become unconditional renders with a `dashboard-panel-hidden` class
toggling visibility. No data-model changes; both panels mount, both
compute their views, only one is visible.

## Fix B — Scope label showed raw group id ("law") instead of name

In the Box Mode dashboard's Personal Bests list, the "Pentateuch"
completion was rendering as "law" — its internal group id. Root cause
was a wrong import path in the `scopeDisplayName` helper:

```js
// Before (broken)
const fullDesc = translations[lang]?.groupNames?.[groupId] || groupId;
```

`groupNames` is a *separate* top-level export from `data.js`, not
nested inside `translations`. So the chain was always undefined, and
the `|| groupId` fallback rendered the raw key. This bug actually
existed in the original Box dashboard code before 4.1; the 4.1
redesign just surfaced it more prominently by displaying the scope
name in the bests list.

**Fix:** import `groupNames` from `data.js` and reference it directly:

```js
const fullDesc = groupNames[lang]?.[groupId] || groupId;
```

The `.split('—')[0].trim()` afterward keeps trimming the long
description down to just the canonical name ("Pentateuch", "Historical
books", etc.).

## What didn't change

- No new mechanics, no new translations, no state model changes.
- Box Mode scope picker UX (grey-out, multi-select) still queued for
  Commit 5.
- README + FAQ unchanged.

## Smoke test

1. Toggle Box Mode ↔ Quiz Mode tabs on the home screen at a desktop
   viewport. The tabs themselves should stay at exactly the same
   vertical position. (Re-test on mobile: should still work as 4.1.)
2. Open Box Mode dashboard with at least one completed scope. The
   Personal Bests list shows the friendly name ("Pentateuch") instead
   of the raw group id ("law").
3. Open the scope-completion bar: hover any segment, the tooltip shows
   the friendly name too.

---



Eight focused fixes surfaced during smoke-testing Commit 4. All small
or contained; no new mechanics, just consistency cleanup.

## Bug fixes

**1. "Full · 0 books" on the all-66 home screen.**
When `confidentCount === 66` AND `stats.dueNow === 0`, the launcher
logic computed `trainingPool = 0` and still pushed a Full button with
that count. Now the Full button is only pushed when `trainingPool > 0`.
With `confidentCount === 66` and nothing FSRS-due, the celebration
card on the hero is the only thing on the home screen — as intended.

**2. Pause + resume counted as 2 sessions in today's stats.**
The autosave-on-unmount effect in QuizGrid writes a `quizHistory`
entry whenever the component unmounts unless `sessionDataRef.current.saved`
is true. `handleBack`'s pause path wasn't setting that flag, so each
pause wrote one entry, and the subsequent natural finish wrote a
second entry — same run reported as 2 sessions. Fixed by setting
`sessionDataRef.current.saved = true` immediately after `onPause(snapshot)`.
The pause-side data isn't lost — it lives in `pausedQuizSession` and
gets folded into the consolidated entry written by `saveCurrentSegment`
on natural finish.

**7. Box Mode "Personal Bests" stale after a completion.**
The home Box dashboard kept showing "Complete a session to record your
first time" even after a session naturally completed. Root cause was
a stale-React-state issue: `recordCompletion` in `boxModeStorage.js`
writes the new best to localStorage via `updateUser`, but unlike
`addQuizSession` it doesn't mirror the write to App.jsx's
`currentUserState`. The `boxBests` `useMemo` is keyed on
`currentUser?.boxModeBests`, which stayed empty in React state.
Fixed in `App.jsx` by re-reading the user from localStorage in
BoxMode's `onBack` handler before switching back to the menu view.
One-line surface change; no edits to `boxModeStorage.js`.

## Session-complete screen redesign

**3. All-66 celebration on the session-complete screen.**
When `sessionComplete` fires and `getConfidentCount() === 66`, the
session-complete screen now renders the same trophy/title/body/total-time
celebration as the home-screen all-66 card (reuses
`celebration66Title`, `celebration66Body`, `celebrationTimeLabel`
keys). End session button stays. The celebration moment surfaces at
the right time — at session end, not just after navigating home.

**4. Neutral framing when `confident < 66`.**
Dropped the "Stopping strengthens your memory more than pushing
through. The wait is not a pause — it's when your memory does the
work." rest message. That framing was schedule-shaped — same reason
we removed the "no schedule" home-screen rest message in Commit 4.
The session-complete screen now shows just: "Session complete" title +
today's stats line + End session button. Honest, no opinion on
whether to stop.

## Settings hygiene

**5. Mastery Speed moved from SHARED to QUIZ MODE.**
The "Shared" label was aspirational comment-cruft. Only Quiz Mode
reads `config.quiz.masteryMs`; Box Mode has its own Time Pressure
mechanism. Moved the slider into the Quiz Mode subsection where it
actually belongs.

## Visual stability

**6. `.dashboard-panel` min-height stabilises mode-tab position.**
Quiz Mode and Box Mode panels have different natural heights (stats +
tier bar vs scope bar + bests list, plus the all-66 celebration vs
regular hero card). Tapping between mode tabs caused the tabs
themselves to jump vertically because the panel above them resized.
Added `min-height: 360px` so whichever panel is shorter top-aligns
within the reserved space. Tabs stay anchored.

## Box Mode dashboard uniformity (item 8)

The Box Mode dashboard now mirrors the Quiz Mode pattern element-for-element:

- **Title** at top (was already there).
- **Hero row** — either celebration or a two-card stats row:
  - When all 9 scopes have at least one completion → celebration card
    (trophy + "All scopes cleared!" + body), inline variant of the
    home-screen all-66 celebration.
  - Otherwise → "X cleared of 9" + "Y to go" stat cards, parallel to
    Quiz Mode's "X confident of 66" + "Y to gold".
- **Scope-completion bar** — 9 segments, one per scope, filled blue
  when that scope has been cleared. Parallels Quiz Mode's tier bar.
  Same colors (`--tier-unseen`, `--tier-rooted`).
- **Personal bests list** — compact, top 4 by most-recent completion.
  Empty state is implicit: when no scopes are cleared, the bests
  section just doesn't render (the hero stats already communicate
  "0 cleared / 9 to go").

The 9 scopes are: All 66 books, Pentateuch, Historical, Poetic,
Prophetic, Gospels, Acts, Letters, Revelation. Hard-coded in App.jsx
as `BOX_SCOPE_KEYS`. If a future revision adds custom scopes, this
constant becomes the single point of update.

New translation keys in NL and EN: `scopesCleared`, `scopesToGo`,
`boxAllScopesClearedTitle`, `boxAllScopesClearedBody`.

New CSS:
- `.dashboard-panel { min-height: 360px }`
- `.boxmode-scope-bar` + `.boxmode-scope-segment` (+ `.cleared` modifier)
- `.celebration-66-inline` — smaller-padded variant of the home-screen
  celebration, used in both the Box dashboard and the all-66
  session-complete screen.

## Smoke test (run in this order)

1. **Full launcher hidden at all-66**: confirm the home screen shows
   no "Full · 0 books" when `confidentCount === 66`.
2. **Sessions count**: start a Quick session, answer 2 books, tap
   Back. Resume. Finish. Today's stats should read "1 sessions" not
   "2 sessions".
3. **All-66 celebration at session-complete**: with all 66 confident,
   start a session, finish it. The session-complete screen shows
   trophy + celebration content instead of the generic "stopping"
   rest message.
4. **Neutral framing at confident < 66**: with `confidentCount < 66`,
   finish a session. The session-complete screen shows "Session
   complete" + today's stats + End session, no "stopping" message.
5. **Mastery Speed location**: open Settings → scroll → the Mastery
   Speed slider should be under QUIZ MODE, not SHARED.
6. **Tab anchoring**: toggle between Quiz Mode and Box Mode tabs.
   The tabs themselves stay at the same vertical position.
7. **Box Mode best stickiness**: complete a Box Mode session (any
   scope), return to home. The new completion appears in the
   "Personal bests" list immediately and the scope-completion bar
   gains a blue segment.
8. **Box Mode uniformity**: visually compare the Box and Quiz Mode
   dashboard panels. Same outer frame, same hero-card-then-bar
   pattern, same compact list below.

---



Three user-visible fixes that addressed concrete complaints surfaced
during smoke-testing:

1. **"Full · 0 books" on the home screen** when FSRS thinks nothing is
   due but the user still has books without gold lines. The launchers
   were FSRS-gated even though the v4 gold-line signal had been
   decoupled from FSRS — internal inconsistency.

2. **Back button silently ended the session**, losing in-quiz streak
   and progress. Doubly painful in Box Mode where it reset the whole
   in-progress cram session back to the scope picker.

3. **"There is no schedule" rest message** appeared on the home screen
   when due-count was 0 — telling the user to stop, which IS a schedule
   shape. Contradicted the user's expressed goal of continuous training
   toward all-66 gold.

## Training-pool fallback

`getNonConfidentBooks(confidentBuffers, fsrsCards, allBooks)` added to
`src/fsrs.js`. Returns non-confident books ordered by closeness to gold:

- buffer with 2 trues (one good hit from gold) — priority 3
- buffer with 1 true                          — priority 2
- unseen (never answered)                     — priority 1
- buffer with 0 trues (lost confidence)       — priority 0

Within each band, FSRS-stability ascending — less stable books benefit
more from a rep. The "unseen above 0-trues" ordering is deliberate:
unseen feels like new ground, 0-trues feels like regression, so we
spare the user the latter when possible.

### Where it's used

**Home-screen launcher counts** (`App.jsx`): when `stats.dueNow === 0`,
the launcher pool size becomes `66 - confidentCount`. Quick stays
capped at 5, Standard at 10, Full uses the full pool. The
**"Full · 0 books"** state can no longer appear when `confident < 66`.
When `confident === 66`, the celebration screen takes over the
dashboard panel and the launchers don't render at all.

**`pickNextBook` mid-session fallback** (`QuizGrid.jsx`): after the
existing due-pool and unseen branches, when both are empty the
previous code triggered session-complete. Now it picks from the top-8
non-confident books (random within the pool, same shape as the existing
due-pool branch — preserves variety, prefers progressability).
`confidentBuffersRef` was added so the closure sees the live buffers
across many answers in a row, not the mount-time value.

## Pause / resume

### Snapshot shape

**Quiz** (`pausedQuizSession` on user):
- `targetBook` — the book that was waiting
- `streak`, `score`, `responseTimes`
- `sessionMasteredBooks`, `sessionHintedBooks`, `sessionWrongBooks`,
  `sessionSeenBooks` — all serialised as arrays (revived as `Set` on
  resume)
- `sessionNewBests`, `sessionMs`, `sessionPickCount`
- `sessionLimit` — so the same Quick/Standard/Full cap continues
- `pausedAt` — timestamp, for diagnostics

**Box** (`pausedBoxSession` on user):
- `scope` — the group selection
- `state` — the full Box Mode game state (bookBoxes, currentBookId,
  mistakes, longestStreak, hintUsedOnCurrent, internal timers). Already
  plain-object-shaped from `createInitialState` + `applyAnswer`, so
  JSON-safe without extra work.
- `pausedAt`

### Lifecycle

- **Back mid-session** → `onPause(snapshot)` → `App.jsx`
  `handleQuizPause` / `handleBoxPause` writes to user object → home
  screen sees `pausedQuizSession` / `pausedBoxSession` non-null.
- **Resume CTA on home** → mode launcher region replaced by
  "▶ Resume session" primary button + "Discard paused session"
  secondary. Tap Resume → App mounts the mode component with
  `initialPausedSession={snapshot}` → mode component's mount effect
  restores every piece of state. Per-question timer (`startTime`)
  re-anchors to "now" so paused-time isn't counted against the speed
  threshold.
- **Discard paused** → `onPause(null)` clears the snapshot without
  starting a session.
- **Natural session end** (Quiz session-complete → End session, or Box
  all-boxes-cleared → recordCompletion) calls `onPause(null)` from
  within the mode component, so the user doesn't see a stale Resume
  CTA pointing at the run that just ended.
- **Reset Quiz progress** / **Reset Box progress** in Settings → Data
  also clear the corresponding `pausedXSession` field.

### Resume vs fresh launch

When `pausedQuizSession` exists, the Quick/Standard/Full launchers are
**replaced** (not augmented) by Resume + Discard. This is intentional:
tapping a launcher in the pre-v4-commit-4 model would have created
ambiguity ("does it discard the paused one or run alongside?"). With
the launchers hidden behind a Discard tap, the user's intent is
unambiguous — Resume means resume, Discard means start over.

## "No schedule" removed

The `all-caught-up` rest message branch on the home screen Quiz
dashboard is gone, along with the translation keys `allCaughtUpTitle`,
`allCaughtUpBody`, `nothingScheduled`, `extraPracticeHint` in both NL
and EN. Their old text — "Come back when you have time — there is no
schedule" — was schedule-shaped despite the disclaimer ("there is no
schedule" is itself a statement about a schedule).

The branch is replaced by a stat-card pair: "X confident of 66" +
"Y to gold" (Y = 66 - confidentCount). The headline number now
matches the user's actual long-term goal and is visible whether due
is 0 or non-zero.

New translation keys added in both NL and EN:
- `resumeSession` ("Sessie hervatten" / "Resume session")
- `resumeSessionDesc` ("Ga verder waar je gebleven was" / "Pick up
  where you left off")
- `discardPausedSession` ("Onderbroken sessie weggooien" / "Discard
  paused session")
- `toGold` ("naar goud" / "to gold")

## What didn't change

- FSRS scheduler itself untouched. Books still progress through
  Familiar → Rooted → Anchored → Permanent based on stability. The
  scheduler just isn't the gate on whether the user is allowed to
  train. Every answer (paused-then-resumed or fresh) still commits to
  FSRS the same way.
- Box Mode UX deferred to Commit 5: short-press / long-press multi-
  group selection, removal of the grey-out on non-selected books.
  Those are independent of session lifecycle and easier to roll back
  separately if needed.
- README and FAQ entries not updated yet. They still refer to the
  pre-commit-4 launcher model. Will sweep these in Commit 5 alongside
  the Box Mode UI changes.

## Smoke test (run in this order)

1. **Pause / resume Quiz**: start a Quick session, answer 2-3 books
   correctly to build a streak, tap "← Back". Home screen shows
   "▶ Resume session" button. Tap it. You're back on the same target
   book with the same streak and score.
2. **Discard paused**: same as above, but tap "Discard paused session"
   on home. Launchers return. Start fresh.
3. **Pause / resume Box**: start a Box Mode session in some scope.
   Answer a few books to populate Box 2/3. Tap Back. Home shows
   Resume. Tap it. Box state is exactly where you left off.
4. **Training-pool fallback**: with confidentCount < 66 and all books
   currently FSRS-future-due, the home screen shows launchers based on
   `66 - confidentCount` (not zero). Tap any launcher, the mode starts
   normally and picks non-confident books.
5. **No "no schedule" message**: with `dueNow === 0` on the home
   screen, the rest message is gone. You see "X confident · Y to gold"
   instead.

If anything misbehaves, the rollback path is `git revert <commit-4-hash>`
— independent of Commits 1-3 and doesn't depend on Commit 5 existing.

---



Visual + structural polish for the v4 pivot. Three user-visible
improvements plus README cleanup.

**Dark mode** — adds dark CSS-variable values to `src/index.css` via
two paths: `prefers-color-scheme: dark` (auto, default) and
`:root[data-theme="dark"]` (manual override). `App.jsx` applies the
`data-theme` attribute to `<html>` based on `config.display.theme`.
The user picks **Auto / Light / Dark** in Settings → Display. Brand
colors (`--correct`, `--wrong`, `--mastery`, the tier blue gradient)
unchanged — they read fine on either background. Only neutrals
(`--bg-*`, `--text-*`, `--border`, `--tier-unseen`) get dark values.
New keys: `theme`, `themeDesc`, `themeAuto`, `themeLight`, `themeDark`.
New default: `display.theme: 'auto'` in `appConfig.js`.

**All-66 celebration screen** — when `confidentCount === 66` the home
screen Quiz dashboard swaps to a persistent finishing screen with:
animated trophy, "All 66 books confident!" headline, total training
time card, share button (reuses existing `share()`), and a two-tap
"Start a new run" reset that calls `doResetQuizProgress`. Replaces
the 2.5-second `milestone66` overlay banner as the long-term reward
state. The two-tap pattern: first tap arms (button turns orange,
text becomes "Tap again to wipe progress"), auto-disarms after 4s;
second tap fires the reset. New keys: `celebration66Title`,
`celebration66Body`, `celebrationTimeLabel`, `celebration66Reset`,
`celebration66ResetConfirm`. New state: `celebrationResetConfirm` in
`App.jsx`.

**Gold-line sweep animation** — when a book transitions from
not-confident to confident, the cell briefly gets `.just-confident`
(one-shot, 700ms). CSS keyframe `gold-sweep` animates the gold line
in left-to-right rather than snapping it into existence. `QuizGrid.jsx`
tracks `justConfidentBookId`, sets it on the confident transition
inside the milestone block, and clears it after the schedule fires.
Animation duration 600ms with 100ms safety margin before the class
clears.

**README rewrite** — removed remaining v3 chrome from the Features
list:
- "Quiz Mode — FSRS spaced repetition, **streaks**" → reworded to
  reference the schedule-hidden picker
- "Six-tier ladder" line updated: `Rooted` instead of `Mastered`,
  framed as parallel to the gold line
- "Day streak" bullet → "Total training time" bullet
- New "Confident gold line" bullet at the top of Progress tracking
- New "All-66 celebration" bullet
- New "Theme" bullet under Display
- "Mastered books" / "Reset Quiz progress" wording updated for the
  v4 confident-buffer model

**No state model changes in this commit.** `confidentBuffers`,
`fsrsCards`, and `boxModeBests` shape unchanged. Migration is still a
no-op for already-v4 users; v3 users upgrading directly to v4
end-state will run the Commit 2 migration on first load.

**Smoke test:**
1. Settings → Display → Theme: cycle Auto/Light/Dark, verify the home
   screen background and text colors change immediately.
2. With OS in dark mode and Theme = Auto: app renders dark.
3. Settings → Display → Theme = Light overrides the dark OS preference.
4. Reset progress, then answer 3 correct-fast on any book: the gold
   line sweeps in (left-to-right) instead of just appearing.
5. (Hard to test without manual data) confidentCount === 66: the home
   screen Quiz dashboard shows the trophy + total time + share +
   reset. Tap reset once → button turns orange and says "Tap again to
   wipe progress". Tap again → progress wipes, screen returns to the
   normal empty-state dashboard.

**Deferred to a future polish commit:** Quiz/Box uniformity audit
(prompt header padding, session-end screen frame parity, share
button positioning); typography pair selection (font choice would be
guessing your aesthetic preference without input).

---



The core mechanic change of the v4 pivot. The gold line under a book
cell no longer means "FSRS-mastered" (stability >7d, takes 3-4 reps
spread over multiple days — fundamentally unachievable in a single
session). It now means "you answered correctly and fast on the last 3
attempts" — a signal you can earn in 30 minutes if you already know the
book layout. FSRS still runs as a smart picker, but the gold line is
decoupled from its calendar.

**New mechanics:**
- `isConfident(buffer)` in `src/fsrs.js`: takes a per-book ring buffer
  (length up to `CONFIDENT_BUFFER_SIZE = 3`). Returns `true` iff the
  buffer is full and every entry is a good hit (correct AND within
  `masteryMs`). One wrong answer or one slow answer pushes `false` and
  removes the gold line; three more correct-and-fast answers re-earn
  it.
- `recordConfidentAttempt(buffer, isGoodHit)`: FIFO push, capped at 3.
- `getConfidentCount(confidentBuffers, allBooks)`: how many books are
  currently confident — drives the home-screen headline and share
  message.
- Per-user `confidentBuffers` field on the user object (parallel to
  `fsrsCards`), seeded by `migrateConfidentBuffers` for upgrading users.

**Migration v3 → v4** (in `App.jsx`, `useEffect` keyed on
`currentUser?.id`): for any existing user whose `fsrsCards` is non-empty
but `confidentBuffers` is empty, books that currently satisfy `isMastered`
get a pre-filled buffer of three `true` entries. Result: existing users
do NOT see their gold lines disappear on first load after the upgrade.
Books that were not yet FSRS-mastered start with an empty buffer and
have to earn gold the new way (3 correct-fast).

**FSRS tier renamed: `mastered` → `rooted`.** The word "mastered" is
now too overloaded — the gold-line UX uses "confident," and the FSRS
tier needed its own name. Affected: `TIERS` array, `getTier()` return
value, `getTierStats()` shape, the `.tier-mastered` CSS class (now
`.tier-rooted`), the `--tier-mastered` CSS variable (now `--tier-rooted`),
the `tierMastered` translation key (now `tierRooted`, displayed as
"Geworteld" in Dutch / "Rooted" in English). The threshold itself is
unchanged: `stability > 7 && reps >= MASTERY_MIN_REPS` (which is still
3). `isMastered()` the function is kept in `fsrs.js` and used only by
the migration helper.

**Home-screen surface:**
- Dashboard stat-card: "X mastered of 66" → "X confident of 66" (driven
  by `getConfidentCount`, not by `tierStats.mastered + anchored +
  permanent`).
- Streak card replaced with a total-training-time card. The flame
  becomes a stopwatch (⏱), the number becomes formatted duration
  ("4u 12m" / "4h 12m"), the label becomes `totalTrainingTime`.
  Reasoning: a day-streak punishes irregular practice, which contradicts
  the v4 "open the app when you have time" model. Total time only goes
  up — same dopamine, no punishment for gaps.
- "X books close to Mastered" indicator and `countCloseToMastery` helper
  removed. The new model has no analogous mid-state ("2 of 3 buffer
  entries are true" isn't worth surfacing — the user sees their book
  light up immediately on the third correct-fast answer).
- The bottom always-visible streak footer also removed.
- `computeStreakInfo` import removed (file remains in src/ but is
  unused — Commit 3 may revisit).

**In-quiz:**
- Gold-line driver in `renderBookCell`: `isConfident(confidentBuffers[book.id])`
  instead of `isMastered(cardData)`.
- Every answer commit now records an attempt onto the buffer:
  correct-AND-fast → `true`; slow correct → `false`; wrong → `false`.
- Milestone trigger (10 / 20 / 33 / 50 / OT-complete / NT-complete / 66)
  now fires on `was-not-confident → is-now-confident` transitions, not
  on FSRS mastery transitions. So milestones surface during the
  race-to-66 marathon rather than weeks later.

**Share message** (`App.jsx#share`):
- NL: "Ik heb X van 66 bijbelboeken beheerst..." → "Ik ben zeker van X
  van 66 bijbelboeken..."
- EN: "I mastered X out of 66 Bible books..." → "I'm confident on X out
  of 66 Bible books..."
- `stats.mastered` replaced with `confidentCount`.

**Reset Quiz progress** (Settings → Data): now also clears
`confidentBuffers` alongside `fsrsCards`. Without this, a reset would
wipe FSRS state but leave gold lines hanging from the old session.

**Translations** (`src/data.js`, both NL and EN):
- Added: `confident` ("Zeker" / "Confident"), used by the dashboard
  stat-card label.
- Renamed: `tierMastered` → `tierRooted` ("Geworteld" / "Rooted").
- Removed: `closeToMasterySingle`, `closeToMastery`.
- Kept (unchanged): `mastered`, `restoreMastered`, all `milestoneN`
  strings. Re-wording these from "beheerst/mastered" to "zeker/confident"
  is a copywriting pass that belongs in Commit 3.

**FAQ** (`Help.jsx`, both NL and EN): the gold-line entry rewritten to
describe the confident signal ("appears when your last 3 answers were
correct AND fast"). The tier-list entry rewritten to call out that the
six tiers are now a separate long-term progression alongside the
gold-line signal, with "Mastered" → "Rooted" / "Beheerst" → "Geworteld"
throughout.

**Schema note:** No `_schemaVersion` bump because the migration is
purely additive (writes `confidentBuffers` if missing). Existing
backups continue to import. The next backup export will include
`confidentBuffers` automatically since it's part of the user object.

**Smoke test** (run `npm run dev` and verify):
1. Existing user with FSRS-mastered books: their gold lines are still
   present on first load (migration ran).
2. Answer a confident book wrong: gold line disappears. Answer 3
   correct-and-fast in a row: gold line returns.
3. New book, never answered: 3 correct-fast in a row lights it gold.
4. Dashboard headline reads "X confident of 66" (instead of "mastered").
5. Streak card replaced with "Total training time" showing duration.
6. Share message uses "I'm confident on" wording.
7. Settings → Data → Reset Quiz progress: gold lines all disappear
   along with FSRS data.
8. Tier-bar legend shows "Rooted" tile (or "Geworteld" in Dutch)
   instead of "Mastered" / "Beheerst".

---



The app's identity is shifting from "follow your FSRS schedule" to "open
practice when you have time." 66 books is a small dataset and many users
already know much of the answer space on day 1, so Anki-style calendar
projection is misapplied. FSRS still runs underneath as a smart picker
(deciding which book to ask next based on stability, difficulty, and
elapsed time), but the calendar chrome around it is removed.

This commit is the deletion pass — pure removals, no new mechanics.
Commits 2 and 3 will add the new gold-line = "confident" model, the
all-66 celebration screen, dark mode, and the Quiz/Box uniformity pass.

**Removed:**
- 7-day forecast bar chart on the home screen. Its motivational message
  ("be ready, Tuesday is busy") is exactly the wrong frame for "open the
  app when you feel like it."
- "Next book due: tomorrow at 9 PM" countdown on the all-caught-up
  celebration and the session-complete screen.
- Three-tier rest celebration ("Session complete" / "Done for today" /
  "Done — enjoy the rest"). Replaced with a single flat "Done for now —
  come back when you have time" message. The schedule-aware tiering
  assumed users care when the algorithm thinks they should be back; they
  don't.
- Train Ahead feature in its entirety. The button + submenu on the
  session-complete screen, the in-quiz pill, the four horizon options
  (5 / 10 / week / remaining), the `buildTrainAheadQueue` and
  `getTrainAheadCounts` helpers in `fsrs.js`, the entire Branch 0 in
  `pickNextBook`, the dedicated state/refs/handler. Users who want to
  keep training past their due queue have Box Mode.
- Pace setting moved into a collapsible `<details>` Advanced section in
  Settings → Quiz Mode. Default is Intensive. The four-way Flexible /
  Relaxed / Balanced / Intensive choice is rarely needed in the new
  schedule-free model, and the labels reference scheduling pressure the
  user no longer sees.
- `src/forecast.js` is now fully unused. Delete it manually after
  applying this zip (`computeForecast`, `getNextDueTime`, `formatNextDue`,
  `getCelebrationLevel`, `forecastDayLabel` — all dead).
- Translation keys removed: `forecastTitle`, `nextBookDue`,
  `sessionCompleteNextLabel`, `sessionCompleteTrainAhead`,
  `trainAheadHorizonCount5/10/Week/Remaining`, `trainAheadInProgress`,
  `sessionEndTitle/Body`, `doneForTodayBody`, `doneForDaysTitle/Body`.
- CSS removed: `.forecast-*`, `.all-caught-up-next*`, `.trainahead-*`,
  `.session-complete-trainahead*`, `.session-complete-next*`,
  `.momentum-section`'s flexbox row layout (was sized for streak +
  forecast cards side-by-side; now wraps just the streak card).
- FAQ entries removed from `Help.jsx`: Train Vooruit / Train Ahead
  (nl + en), "What if I do Train Ahead every day until everything is
  Mastered" (nl + en), "Wat toont de Komende 7 dagen-balk" / "What does
  the Next 7 days bar show" (nl + en). FAQ entries describing the
  three-tier rest message and Train Ahead-based "keep practicing"
  advice rewritten to reference Box Mode instead.

**Added:**
- `settingsAdvanced` translation key (nl: "Geavanceerd", en: "Advanced").
- `.advanced-details` and `.advanced-summary` CSS rules in
  `Settings.css` for the new collapsible.

**Unchanged but worth knowing:**
- FSRS itself, including the `isDueNow` Learn-Ahead-Limit logic, the
  six-tier ladder, `MASTERY_MIN_REPS = 3`, and the `stability > 7d`
  mastery threshold — all preserved. The picker is unchanged; only the
  UI surface around it is.
- Quick (5) / Standard (10) / Full launchers — kept; their sizes are
  still computed from `stats.dueNow`.
- Day streak — kept for now. Replacing with cumulative active time vs.
  removing is a Commit 2 design decision.
- Share message, milestones, Box Mode, reset flow — unchanged.

**Manual cleanup after extracting:**
1. Delete `src/forecast.js` (it's no longer imported anywhere).
2. Run `npm run dev` and verify the home screen renders, an empty due
   queue shows "Done for now", and the session-complete screen has
   only the End Session button.
3. Grep the repo for `trainAhead`, `Train Ahead`, `forecast`,
   `nextDue`, `getCelebrationLevel`, `forecastDayLabel`,
   `sessionCompleteNextLabel`, `sessionEndTitle`, `doneForDaysTitle`,
   `nextBookDue` — should all be zero hits.

---



Twee gerelateerde scroll-issues opgelost op telefoons met gesture-
navigation (Samsung S22+ en vergelijkbaar):

- **`.app-main`**: `padding-bottom: env(safe-area-inset-bottom)`
  toegevoegd zodat de laatste rij van het boekenraster (3 Johannes /
  Judas / Openbaring) niet meer achter de gesture-pill verdwijnt.
- **`.settings-page`**: `min-height: calc(100vh - 80px)` veranderd
  naar `100dvh` zodat de versie-info onderaan Instellingen → Data
  weer bereikbaar is. `100vh` is op mobile statisch en houdt geen
  rekening met browser-UI beweging; `100dvh` past zich aan.

Beide gebruiken `env()` / `dvh` CSS-functies die op desktop of
oudere mobiele apparaten gewoon 0 of 100vh teruggeven. Geen impact
voor wie deze problemen niet had.

---

# v3.3 update — Reset Progress gesplitst per modus

Eén "Voortgang wissen" knop in Instellingen → Data is vervangen door
twee knoppen: "Quiz-voortgang wissen" en "Doos-voortgang wissen". Elk
met een eigen bevestigingsdialoog die specifiek vermeldt wat verloren
gaat. Quiz en Box Mode hebben nu volledig onafhankelijke resets.

## Wat zit er in deze zip

### Gedrag voor gebruiker

**Quiz-voortgang wissen** wist:
- FSRS-data: alle kaartstatussen, intervallen, due dates, mastery tiers
- Quiz-historie: alle opgeslagen sessies, daarmee streak en "vandaag X sessies"
- Persoonlijke records per boek (snelste tijden in Quiz Mode)
- Beste streak
- Totale trainingstijd
- masteryMsAtStart baseline voor share-bericht

**Doos-voortgang wissen** wist:
- Alleen `boxModeBests`: alle persoonlijke records per selectie
  (snelste tijd, minste fouten, langste reeks voor "Alle 66",
  Pentateuch, Evangeliën, enz.)

Beide laten persoonlijke voorkeuren (taal, leertempo, snelheidslimiet,
kolommen, oriëntatie, layout) intact. Reset gaat over voortgang, niet
over instellingen.

### Eerdere stilzwijgende discrepantie opgelost

De oude `doResetProgress` raakte `boxModeBests` niet aan — alleen Quiz
Mode data werd gewist. De knop heette "Voortgang wissen" wat suggereert
"alles wissen", maar de daadwerkelijke wipe was Quiz-only. Dit was niet
documenteerd en kon misleidend zijn.

In v3.3 wordt dit gedrag expliciet: de Quiz-knop doet (vrijwel) exact
wat de oude knop deed; de Doos-knop is nieuw en doet de Box-only wipe
die voorheen niet bestond.

### Implementatie

**`src/App.jsx`:**
- `doResetProgress` (één functie) gesplitst in `doResetQuizProgress`
  en `doResetBoxProgress`. Quiz-versie is identiek aan de oude functie;
  Box-versie wist alleen `boxModeBests`.
- Settings component krijgt nu twee props (`onResetQuizProgress` en
  `onResetBoxProgress`) in plaats van één.

**`src/components/Settings.jsx`:**
- `confirmReset` state veranderd van boolean naar string (`'quiz'` |
  `'box'` | `null`). Eén state houdt welke reset mid-confirmation is —
  beide kunnen niet tegelijk open zijn, en dat invariant is nu
  structureel afgedwongen door het type.
- Eén reset-knop is vervangen door twee, elk met een eigen inline
  confirmation panel onderaan de knop.

**`src/data.js`** — translation keys:
- `resetProgress` weggehaald
- `resetQuizProgress` + `resetBoxProgress` toegevoegd (NL+EN)
- `resetSectionDesc` aangepast: niet meer "wis alles", maar "wis per
  modus"
- `confirmResetQuizMsg` + `confirmResetBoxMsg` toegevoegd met
  specifieke uitleg per modus. `confirmResetMsg` blijft als fallback.

**`src/components/Help.jsx`** — twee FAQ-antwoorden bijgewerkt waar
"Reset Progress" / "Voortgang wissen" werd genoemd in de context van
share-bericht. Nu verwijst de tekst naar de specifieke "Quiz-voortgang
wissen" knop.

### Build-verificatie

Clean build slaagt op vite 6 + React 19. Geen functionele wijzigingen
in FSRS, Box Mode logic, of UI gameplay-paden.

---

# v3.2 update — Tussenscherm bij Terug-knop verwijderd

Wanneer je tijdens een actieve Quiz Mode sessie op Terug klikt, verscheen
een tussenscherm met "Stats so far" / "Tussenstand" met twee knoppen:
**Verder oefenen** en **Klaar**. Dit scherm is verwijderd.

## Wat zit er in deze zip

### Terug-knop in Quiz Mode gaat direct naar home

**Probleem:** het tussenscherm dwong een keuze af waar er geen echte
keuze nodig was. De **Klaar**-knop riep `saveCurrentSegment()` aan om de
sessie in `quizHistory` op te slaan. Maar er bestaat al een
*autosave-on-unmount* effect dat exact hetzelfde doet wanneer QuizGrid
unmount — wat sowieso gebeurt zodra je terug bent op het hoofdmenu. De
twee mechanismen deden dubbel werk; het tussenscherm was overbodig.

De **Verder oefenen**-knop dismissten gewoon het scherm zonder iets te
doen. Effectief: een extra klik om "nee toch maar niet" te zeggen tegen
een vraag die je niet had gesteld.

**Oplossing:** Terug-knop tijdens een actieve sessie roept direct
`onBack()` aan → terug naar home. De autosave-on-unmount zorgt
automatisch dat de partiële sessie wordt opgeslagen in `quizHistory`,
zodat streak en "Vandaag X sessies" stats blijven kloppen.

Wat er gebeurt vanuit gebruikersperspectief:
- Tijdens quiz Terug klikken → meteen home, geen tussenscherm
- Streak en vandaag-stats blijven correct werken (autosave)
- Volgende keer Quiz openen → kies opnieuw Quick/Standard/Volledig

Een sessie wordt "officieel afgerond" wanneer alle limiet-boeken
beantwoord zijn (sessie-compleet scherm verschijnt → klik Klaar →
quizHistory entry). Tot dan is elke Terug = "ik ga even weg" en wordt
de sessie als-is opgeslagen.

### Verwijderde code en assets

**`src/components/QuizGrid.jsx`:**
- `handleBack` callback vereenvoudigd: één regel die `onBack()` aanroept
- Hele `if (showSummary) { ... }` rendering blok (~60 regels) verwijderd
- `const [showSummary, setShowSummary] = useState(false)` weggehaald
- `showSummary` uit de phase-tracking `useEffect` weggehaald
- Ongebruikte import `formatDuration` van `../timeFormat` weggehaald

**`src/data.js`:** 10 dode translation keys verwijderd in zowel NL als EN:
`sessionSummaryTitle`, `sessionReviewed`, `sessionMinutes`,
`sessionCorrect`, `sessionNewBests`, `sessionNewlyMastered`,
`sessionTotal`, `sessionPauseHint`, `keepGoing`, `done`. Plus het
bijbehorende uitlegcomment-blok.

**`src/components/QuizGrid.css`:** 13 dode CSS-classes verwijderd
(~120 regels CSS): `.summary-screen`, `.summary-title`, `.summary-stats`,
`.summary-stat`, `.summary-number`, `.summary-label`, `.summary-best`,
`.summary-newly-mastered`, `.summary-delta`, `.summary-total-time`,
`.summary-pause-hint`, `.summary-buttons`, plus de `.quiz-btn` variant
binnen `.summary-buttons`. De gerelateerde stale comment-referentie naar
`.summary-screen` in de session-complete header is bijgewerkt.

### Wat niet gewijzigd is

- `finishSession()` callback **behouden** — wordt nog steeds gebruikt
  door `handleEndSession` op het sessie-compleet scherm. Daar blijft de
  Klaar-knop ("Klaar") werken om een afgeronde sessie expliciet te
  boeken.
- De autosave-on-unmount logica is ongewijzigd. Het was er al; het
  werkte al; het werkt nu nog steeds.
- FSRS scheduling, mastery tiers, persoonlijke records: niets aan
  geraakt. Alle echte leervoortgang werd al per-antwoord direct
  gecommit en is nooit afhankelijk geweest van het tussenscherm.

### Ster-marker bij verankerde boeken in Box Mode verwijderd

Boeken die in Box Mode doos 5 hadden bereikt ("verankerd") kregen twee
visuele markers: een gouden lijn onderaan de cel **én** een vierpuntige
ster (✦) in de hoek rechtsboven. De ster is verwijderd; alleen de gouden
lijn blijft.

Reden: Quiz Modus markeert "Beheerst" boeken met *alleen* een gouden
lijn onderaan. Box Modus had ook al die lijn, maar met daarbovenop nog
de ster. Dubbele visuele signalen zonder extra informatie. De ster is
weggehaald zodat beide modi exact dezelfde "boek-op-niveau" marker
gebruiken.

**Bestand:** `src/components/BoxMode.css` — de `::after` regel onder
`.book-cell.boxmode-rooted` (8 regels CSS) verwijderd. `position:
relative` op de `.book-cell.boxmode-rooted` zelf behouden voor het
geval een toekomstige marker hem nodig heeft.

### Build-verificatie

Clean build slaagt op vite 6 + React 19. Bundle iets kleiner doordat
dode code/strings/CSS verwijderd zijn.

---

# v3.1 update — Flexibel leertempo + sessielengte-keuze

Deze update voegt twee samenhangende verbeteringen toe die Quiz Modus
geschikter maken voor mensen met wisselende vrije tijd. Beide raken het
FSRS-algoritme niet aan — alleen hoe de gebruiker ermee in contact komt.

## Wat zit er in deze zip

### A. Nieuwe "Flexibel" leertempo-instelling

**Probleem:** de drie bestaande tempo's (Ontspannen 0.85, Gebalanceerd
0.90, Intensief 0.95) zijn allemaal geijkt op gebruikers die regelmatig
oefenen. Voor wie wisselende vrije tijd heeft levert zelfs Ontspannen
nog steeds een schema op dat als "achterstand" voelt: 30-50 boeken
klaarstaan na een paar dagen niet kunnen oefenen is normaal voor het
algoritme, maar visueel ontmoedigend.

**Oplossing:** een vierde tempo "Flexibel" met `request_retention=0.80`.
Bij dit niveau worden intervallen ongeveer dubbel zo lang als bij
Gebalanceerd. Concreet: een gebruiker die nu 30 boeken/dag te oefenen
heeft op Gebalanceerd, ziet bij Flexibel ongeveer 12-15 boeken/dag. Alle
66 boeken halen nog steeds Permanent over de tijd; ze hangen alleen
langer in tussenstadia en het schema voelt minder veeleisend.

**Veiligheid bij wisselen:** bestaande FSRS-data blijft onaangetast. De
ts-fsrs scheduler wordt herbouwd zodra `learningPace` verandert (via
`useMemo([learningPace])`), maar alleen toekomstige herhalingen gebruiken
de nieuwe retention. Bestaande due-dates blijven staan. Dit volgt Anki's
default "Reschedule cards on change: NO" — de aanbevolen aanpak.

**Bestanden:** `src/fsrs.js` (`PACE_CONFIG.flexible: { request_retention:
0.80 }` toegevoegd boven `relaxed`), `src/components/Settings.jsx`
(dropdown uitgebreid + hint switch case), `src/data.js` (`paceFlexible`
+ `paceFlexibleHint` translation keys in NL en EN).

**Hintteksten:**
- NL: "Lichtste schema — kom wanneer je tijd hebt, geen dagelijkse druk"
- EN: "Lightest schedule — come when you have time, no daily pressure"

### B. Sessielengte-keuze op het startscherm (Snel / Normaal / Volledig)

**Probleem:** Quiz Modus had één enkele Start-knop, die alle klaarstaande
boeken in één sessie zette. Voor een gebruiker met 12 due en 5 minuten
voelt dat als "ik moet alles doen of niets". Box Modus had dit probleem
al opgelost via zijn scope-keuze; Quiz Modus niet.

**Oplossing:** waar nu één Start-knop staat, verschijnen 1-3 launcher-
knoppen afhankelijk van hoeveel boeken klaarstaan:
- ≤ 5 due: alleen "Volledig (N boeken)" (de andere zouden hetzelfde
  resultaat geven, dus geen redundante keuzes)
- 6-10 due: "Snel (5)" + "Volledig (N)"
- > 10 due: "Snel (5)" + "Normaal (10)" + "Volledig (N)"

Klikt op Snel → quiz start met limiet van 5 boeken. De pickNextBook-
logica blijft identiek (most-overdue eerst, 20% kans op nieuw boek voor
variatie), maar telt af richting de gekozen limiet. Bij 5 antwoorden
verschijnt het bestaande sessie-compleet-scherm, met Train-vooruit
beschikbaar als de gebruiker toch wil doorgaan.

**Algoritme-impact:** geen. FSRS update als gebruikelijk per antwoord.
De 5 die je doet zijn de 5 die je hoe dan ook eerst zou hebben gedaan —
de rest blijft "due" voor de volgende sessie. Een Snelle sessie van 5
boeken is dus geen "halve sessie" maar een echte korte sessie.

**Edge cases:**
- Train Vooruit overrulet de session-limit (eigen queue, eigen lengte).
- Sessionlimit-keuze is per launch, niet persistent over launches.
- Pace-wissel mid-sessie blijft veilig: bestaande sessie blijft draaien
  met de nieuwe scheduler voor toekomstige reviews.
- Box Modus behoudt de enkele Start-knop met scope-picker. De asymmetrie
  is bewust: elke modus surfacet zijn eigen kernkeuze (Box = scope,
  Quiz = lengte).

**Bestanden:** `src/components/QuizGrid.jsx` (`sessionLimit` prop,
`sessionLimitRef` + `sessionPickCountRef`, limit-check in `pickNextBook`
boven de regular flow, increment na succesvolle pick, clear in
`handleStartTrainAhead`), `src/App.jsx` (`quizSessionLimit` state, drie
launcher-knoppen vervangen de Quiz-mode Start-knop, `onBack` reset de
limit, wrapper `.home-launcher-area` voor hoogte-stabiliteit),
`src/App.css` (`.home-quiz-launchers`, `.home-launcher-btn`,
`.home-launcher-primary`, `.home-launcher-area` met responsive collapse
op ≥640px), `src/data.js` (`sessionSizeQuick`/`Standard`/`Full`/`Books`/
`BookSingle`/`Minutes` translation keys in NL en EN).

### C. Help-pagina uitgebreid

**Twee FAQ-aanpassingen** in `src/components/Help.jsx`:
- De bestaande "Wat betekenen Ontspannen, Gebalanceerd en Intensief?"-
  vraag is verbreed naar "Wat betekenen Flexibel, Ontspannen,
  Gebalanceerd en Intensief?" met uitleg per niveau (vergetingsrisico-
  percentages, doelgroep per niveau, en de garantie dat wisselen veilig
  is voor bestaande data).
- Nieuwe vraag "Wat zijn Snel, Normaal en Volledig op het startscherm?"
  legt de drie launcher-knoppen uit en wanneer welke verschijnen.

Beide vragen in NL en EN.

### D. Documentatie

- `BibleBooks-Reference.md` ongewijzigd (eerder deze week gepubliceerd).
- README niet aangepast (de hoofdfunctionaliteit blijft hetzelfde, alleen
  detail-instellingen veranderen).

## Build-verificatie

Clean build slaagt op vite 6 + React 19 (bundle 414.81 KiB, ~2 KiB groei
t.o.v. v3 door extra translation keys en launcher-rendering). Geen
warnings. Logic test voor de launcher-zichtbaarheidsregels (7 scenario's
van dueNow=0 tot 66) past 7/7.

---

# v3 polish update — wijzigingen overzicht

Deze update voltooit de v3-rebuild door de Box/Quiz oefenervaring volledig
gelijk te trekken, een belangrijke export/import-bug te repareren, en de
projectdocumentatie up-to-date te brengen na de Studie Modus-verwijdering.

## Wat zit er in deze zip

### 1. Box Mode wrong-answer flow nu identiek aan Quiz Mode

**Probleem:** in Box Mode advanceerde de app automatisch na een fout
antwoord (1500 ms feedback-window). In Quiz Mode moet de gebruiker eerst
op het blauw oplichtende correcte boek tikken om door te gaan. Dit zorgde
voor inconsistente leerervaring tussen modi en sloeg de pedagogische
versterking ("zie het juiste antwoord, kies het bewust") in Box Mode over.

**Oplossing:** auto-advance verwijderd. Na een fout antwoord (of
hard-mode timeout) blijft het correcte boek blauw oplichten tot de
gebruiker erop tikt. Andere boeken zijn gedisabled tijdens dat venster
(deze guard bestond al in BoxMode.jsx — auto-advance schakelde er gewoon
omheen). De prompt toont al "Fout — kijk naar het blauwe vakje!"
(`wrongShowCorrect` translation key, ongewijzigd).

**Bestanden:** `src/components/BoxMode.jsx` (nieuwe wrong-feedback branch
in `handleBookClick`, twee `setTimeout`-blokken verwijderd, dode
`WRONG_FEEDBACK_MS` constant + comment opgeruimd).

### 2. Start-knop labels gelijkgetrokken

**Probleem:** "Start Box Mode" vs "Start Quiz" — inconsistente naamgeving
tussen modi.

**Oplossing:** beide knoppen gebruiken nu hetzelfde patroon:
- EN: "Start Quiz Mode" / "Start Box Mode"
- NL: "Start Quiz Modus" / "Start Doos Modus"

**Bestanden:** `src/data.js` (oude dode `upNext*` translation keys hernoemd
naar `homeStart*` matching their actual use; `upNextStartStudy` verwijderd),
`src/App.jsx` (start-button gebruikt nu `t.homeStartQuiz` / `t.homeStartBoxMode`).

### 3. Home-screen dashboard hoogte stabiel bij modus-wisseling

**Probleem:** wanneer de gebruiker wisselde tussen Box-kaart en Quiz-kaart
op het startscherm, sprong de layout omdat de Quiz dashboard veel hoger
was (~360 px met mastery cards + tier bar + 7-dagen forecast) dan de
Box dashboard (~140 px met alleen empty state).

**Oplossing:** `.dashboard-panel` heeft nu `min-height: 360 px` en
flex-column display, zodat de Box dashboard zich uitstrekt om dezelfde
ruimte te vullen. De empty-state berichtgeving in Box Mode is ook
vereenvoudigd voor parallelliteit met Quiz Mode: "Personal bests"
subtitle is nu altijd zichtbaar, met een muted hint-regel eronder
wanneer er nog geen records zijn — geen aparte "no sessions yet"
verbose wrapper meer, parallel aan hoe Quiz Mode "show structure with
zeros" doet zonder verklarende tekst.

**Bestanden:** `src/App.css` (`.dashboard-panel` min-height + flex,
`.boxmode-dashboard` flex 1, nieuwe `.boxmode-bests-empty-hint`),
`src/App.jsx` (Box dashboard JSX altijd dezelfde structuur — subtitle
+ content area).

### 4. Backup/restore omvat nu Box Mode data — bug fix

**Probleem:** twee aparte data-paden ontbraken in de export/import:
- `config.boxMode` (failMode, timePressure) was niet in de exported
  settings opgenomen — backup/restore reset deze stilletjes naar default
- `currentUser.boxModeBests` (per-scope persoonlijke records) was niet
  in de exported user-data opgenomen — een geslaagde "alle 66 in 2:30
  met 3 fouten" record overleefde geen backup/restore round-trip
- `handleRestore` in App.jsx restoorde `boxModeBests` evenmin

Aanwezig sinds Box Mode werd toegevoegd; we hebben deze niet veroorzaakt
maar wel ontdekt tijdens de v3 push-voorbereiding.

**Oplossing:** beide velden toegevoegd aan export shape, restore handelt
ze af met `|| {}` fallback voor pre-v3 backups. Schema bumped naar v3
met expliciete comment over wat er nieuw is. Geen migratie nodig — oude
backups laden gewoon zonder Box Mode data, wat correct gedrag is.

**Bestanden:** `src/components/Settings.jsx` (export shape uitgebreid,
`_schemaVersion: 3`), `src/App.jsx` (`handleRestore` herstelt
`boxModeBests`).

### 5. Stuk "Studie Modus"-knop verwijderd uit session-complete scherm — bug fix

**Probleem:** wanneer de gebruiker een Quiz-sessie afmaakte (Due → 0)
toonde het session-complete-scherm drie knoppen: Sessie afsluiten /
Studie Modus / Train vooruit. De "Studie Modus"-knop riep
`onGoToStudy()` aan, wat `setView('study')` deed — maar de
`view === 'study'` render-branch was in v3 verwijderd. Klikken zette
de app dus in een gebroken staat (state zegt 'study' maar niets
rendert daarvoor). Voor de meeste gebruikers ongezien omdat ze zelden
het session-complete-scherm bereiken (vereist Due + unseen = 0), maar
een echte gebroken-knop bug. Aanwezig sinds v3 home-rebuild.

**Oplossing:** knop volledig verwijderd. Train vooruit is de enige
overgebleven "ik wil verder oefenen"-optie en dekt het use-case af.
Alle bijbehorende code opgeruimd: `handleGoToStudy` callback,
`onGoToStudy` prop in QuizGrid, `setView('study')` callback in App.jsx,
`sessionCompleteStudy` translation key (NL+EN), `.session-complete-study`
CSS rule, en stale comments die de drie-keuzes flow beschreven.

**Bestanden:** `src/components/QuizGrid.jsx`, `src/App.jsx`,
`src/data.js`, `src/components/QuizGrid.css`.

### 6. HMR Fast Refresh fix

**Probleem:** Vite's React plugin gaf elke save de waarschuwing
"Could not Fast Refresh ('defaultConfig' export is incompatible)" en
deed een full page reload, omdat App.jsx zowel React-componenten
exporteerde als plain-data exports (`defaultConfig`, `mergeConfig`).

**Oplossing:** `defaultConfig` en `mergeConfig` verplaatst naar nieuwe
`src/appConfig.js`. App.jsx exporteert nu alleen `useAppConfig` (hook)
en de default `App` component — Fast Refresh compatible.

**Bestanden:** `src/appConfig.js` (nieuw), `src/App.jsx` (import in
plaats van inline definitions, dode module-level `detectedLang`
opgeruimd).

### 7. Studie Modus references opgeruimd

**Probleem:** Studie Modus is in de v3 home-rebuild verwijderd, maar
referenties bleven verspreid:
- Help.jsx had nog een hele "Studie Modus" sectie met intro + 4-stappen
  build-up lijst, plus 3 obsolete FAQs (Study-vs-Quiz, Random/Focused,
  Up Next), plus 6 incidentele Study Mode-vermeldingen verspreid over
  andere FAQ antwoorden, in zowel NL als EN
- `data.js` had 8 dode translation keys (`studyMode`, `bookSelection*`,
  `studyChooseGroup`, `startStudy`, `settingsSubsectionStudy`)
- `Settings.jsx` had ongebruikte `study` in de destructure
- README beschreef Study Mode in het features-overzicht, miste
  Box Mode helemaal

**Oplossing:** alle dode references verwijderd; FAQ entries die
Studie Modus tangentieel noemden zijn herschreven naar Box Mode of
Quiz Mode waar logisch. README features-sectie heeft nu de Box Mode
beschrijving op de plek waar Study Mode stond. JW Library Studie-
bijbel verwijzingen blijven (echte publicatie, niet de app-modus).

**Bestanden:** `src/components/Help.jsx`, `src/data.js`,
`src/components/Settings.jsx`, `README.md`.

## Test instructies

1. Pak de zip uit in `C:\qwencode\BibleBookFinder` — overschrijf
   bestaande bestanden. Verwijder `src/components/UpNextPanel.css`,
   `src/components/UpNextPanel.jsx`, en `src/suggestedMode.js` als ze
   nog op disk staan (oude v3-resten die nooit werden opgeruimd).
2. `npm install` (indien nodig)
3. `npm run dev` om lokaal te testen
4. Test in de browser:
   - **Box Mode wrong-answer:** start een sessie, tik op een fout boek
     → het juiste boek licht blauw op → wacht 5 seconden, niets gebeurt
     (geen auto-advance) → tik op het blauwe boek → advanceert
   - **Hard-mode timeout:** Settings → Doos Modus → Tijdsdruk: streng,
     start sessie, laat timer aflopen → identiek wrong-answer-gedrag
   - **Start-knop labels:** wissel tussen Box/Quiz selector cards op
     home → label past zich aan ("Start Box Mode" / "Start Quiz Mode")
   - **Layout-stabiliteit:** wissel snel heen en weer tussen Box en
     Quiz selector cards → cards en knoppen eronder verschuiven niet
   - **Backup round-trip:** wijzig Box Mode tijdsdruk-instelling, behaal
     een Box Mode persoonlijk record, exporteer backup, reset progress,
     importeer backup → instelling EN record moeten terugkomen
   - **HMR:** edit een willekeurige .jsx of .css file in dev-mode →
     hot patch (geen full page reload, geen "Could not Fast Refresh"
     waarschuwing in terminal)
5. `npm run build` om production-build te valideren
6. Indien alles goed is: commit en push.

## Voorgestelde commit-message

```
v3 polish: uniform Box/Quiz UX, backup completeness, doc cleanup

Box Mode now mirrors Quiz Mode for wrong answers (tap correct book to
advance, no auto-advance after 1.5s). Start button labels uniform
across modes/languages. Home dashboard panel height-stabilized so
mode-card switching no longer shifts layout below.

Backup/restore bug fix: config.boxMode and user.boxModeBests are now
included in export and restored on import (schema v3). Both fields
existed since Box Mode was added but were silently omitted from the
export shape, causing a backup round-trip to lose Box Mode settings
and personal bests.

HMR Fast Refresh fix via new src/appConfig.js so App.jsx only exports
React-component-shaped values. Saves no longer trigger full reload.

Documentation: README modes section updated (Study Mode out, Box Mode
in); CHANGES.md rewritten for this round; all Study Mode references
removed from in-app Help (FAQ entries, intro text, JSX section);
8 dead translation keys removed; upNext* keys renamed to homeStart*.
```

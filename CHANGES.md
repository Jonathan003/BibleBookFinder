# v4 commit 4 — Pause/resume, training-pool fallback, removed "no schedule"

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

# Bible Book Finder

An interactive quiz app to help you learn the location of all 66 Bible books. Inspired by the book grid in the JW Library Study Bible app, with group descriptions sourced from the NWT "The 66 Books of the Bible" article.

🔗 **Live app:** [jonathan003.github.io/BibleBookFinder](https://jonathan003.github.io/BibleBookFinder/) — also available at [biblebookfinder.netlify.app](https://biblebookfinder.netlify.app)

## Features

**Modes**
- **Quiz Mode** — Race to 66 confident books (a book becomes confident when your last 3 answers on it were all correct AND within your target time). The home screen shows confident count out of 66, a tier breakdown bar (Unseen → Permanent), and total training time. When you hit 66, a trophy celebration with total time appears; tap "Start a new run →" to soft-reset confident lines and race again with FSRS preserving long-term scheduling underneath. A single run can span one session or many days. See [ADR 0008](./docs/adr/0008-speedrun-only-quiz-mode-model.md) for the design rationale.
- **Box Mode** — Single-session Leitner-style cram independent of the FSRS schedule. Each book starts in box 1; correct answers promote, wrong answers demote, session ends when every book reaches box 5. Scope is selectable: all 66, a single group (Pentateuch, Gospels, etc.), any combination of 2-8 groups (e.g. Pentateuch + Gospels for weekly Bible reading), or — once FSRS has built up enough data — a dynamic "books that need attention" scope that surfaces your personally-difficult or overdue books. Per-scope personal bests for time, mistakes, and longest streak (except for the attention scope, which has a variable set and tracks no bests). No FSRS impact, no progress impact — a clean cram tool. See [ADR 0009](./docs/adr/0009-attention-scope-box-mode.md) for the attention scope.

**Progress tracking**
- **Confident gold line** — The gold line under a book cell appears when your last 3 answers on that book were all correct AND within your target time. Achievable in a single ~30-minute session if you already know the layout. One miss removes the line; 3 more correct-fast answers earn it back.
- **Six-tier ladder** — A parallel FSRS-driven long-term measure: Unseen → Learning → Familiar → Rooted → Anchored → Permanent. Independent of the gold line; this is the "stuck in long-term memory" axis (Permanent ≈ 6+ months stability).
- **Total training time** — Cumulative active-quiz time, surfaced on the home screen so irregular practice still shows accumulating effort.
- **All-66 celebration** — When you hit 66 confident, the in-quiz screen shows a trophy with your total run time and a Share button; the back arrow returns home where a parallel celebration card waits. From home, "Start a new run →" soft-resets and launches a fresh race; FSRS scheduling, per-book best times, lifetime streak, and history all carry over.
- **Learning pace** (advanced) — Flexible / Relaxed / Balanced / Intensive control FSRS `request_retention`. Hidden behind Settings → Training → Quiz Mode → Advanced since the schedule-free model rarely needs it; default is Intensive.

**Your data**
- **Multi-user** — Up to 10 profiles with separate progress, settings, FSRS data, and confident buffers
- **Backup & restore** — JSON export/import with free choice of save location. Device-specific layout settings (column counts, abbreviation modes, OT/NT layout, theme) stay local on each device so backups don't disturb screen-tuned settings on the importing device
- **Reset progress** — Per-mode in Settings → Data. Reset Quiz progress wipes FSRS data, confident buffers, history, and training time. Reset Box progress wipes per-scope personal bests. Independent so you can reset one without the other.
- **Bilingual** — Dutch and English, auto-detected from browser language

**Display**
- **Theme** — Light, dark, or auto (follows OS `prefers-color-scheme`). Settings → Display
- **Responsive** — Portrait and landscape with smart abbreviation switching
- **OT/NT layout** — Landscape mode supports stacked (default) or side-by-side testaments (JW Library Study Bible style), with independent column counts per testament
- **Colorblind-safe** — Blue (#3B82F6) for correct, orange (#F97316) for wrong (deutan-friendly; no green/red anywhere)

**Platform**
- **PWA** — Installable on Android, iOS, and desktop, works offline
- **In-app help** — Getting started guide, recommended approach, and FAQ accordion

## Getting started

**Just want to use the app?**
Open [jonathan003.github.io/BibleBookFinder](https://jonathan003.github.io/BibleBookFinder/) in your browser. To install on your phone: Chrome menu → "Add to Home Screen" or "Install". Training tips and FAQ are available in the app via the ❓ button.

**Want to run the code locally?**

```bash
git clone https://github.com/Jonathan003/BibleBookFinder.git
cd BibleBookFinder
npm install
npm run dev
```

Open `http://localhost:5173/BibleBookFinder/` in your browser.

## Tech stack

React 19, Vite 6, ts-fsrs (FSRS spaced repetition), CSS custom properties, localStorage, PWA with service worker (vite-plugin-pwa).

## Deployment

Hosted on **GitHub Pages** (primary) with auto-deploy via GitHub Actions on every push to `main`. Also hosted on **Netlify** as a backup (free plan, 300 build credits/month).

## Data sources

- Book abbreviations and color groups: JW Library Study Bible
- Group names and descriptions: NWT "The 66 Books of the Bible — What Is Contained in Them?" (jw.org)
- Spaced repetition: FSRS algorithm (open-spaced-repetition project)

## Training-time tracking

Cumulative active-quiz time (`totalQuizMs`) is summed per answered question, capped at 30 seconds per question (Anki-style). The cap means walking away or letting the screen idle adds at most 30 s per uncompleted question rather than minutes or hours. This keeps the share-message claim ("I'm confident on X out of 66 Bible books in Y time") legitimate without requiring `visibilitychange`/`pagehide` handlers (which are unreliable on mobile, especially on iOS). Reset Quiz progress wipes the counter; "Start a new run" (or "Start over" on a paused run) also resets it for a fresh race; backups carry it across devices via `_schemaVersion: 5`.

## Design philosophy: open practice, no schedule chrome

The app is built for a small dataset (66 books) and users who often already know many of the answers — a fundamentally different problem than Anki's "thousands of unfamiliar cards" use case for which FSRS was designed. So FSRS runs underneath as a smart picker (it still decides which book to ask next based on stability, difficulty, and elapsed time), but its calendar projection is not surfaced to the user. There is no 7-day forecast, no "next book due at 9 PM" countdown, no daily-quota nag. Practice happens when the user has time — in bed before sleep, on a coffee break, between shifts — and the home screen reflects that: a single "X / 66 Confident" stat shows where you stand toward the goal, with no countdown or pressure to come back at a specific moment.

Spaced repetition's core insight still applies: re-drilling stable books resets the FSRS timer without adding strength. So Quiz Mode shapes itself as a speedrun: race to 66 confident, see your time, soft-reset and race again. Each run leaves FSRS calibration intact, so the picker biases toward your weakest books over runs — long-term retention compounds without the user having to think about a calendar. Users who want a different kind of practice altogether have Box Mode, a separate Leitner-style cram independent of FSRS scheduling. See [ADR 0008](./docs/adr/0008-speedrun-only-quiz-mode-model.md).

## Update notifications

The app uses vite-plugin-pwa's `prompt` strategy with `useRegisterSW`. The service worker checks for updates every 30 minutes while the app is open; when a new version is detected, a banner on the home screen offers a one-tap reload via `updateServiceWorker(true)`. Settings → Data shows the currently-running build (commit hash and date), injected at build time from `git rev-parse` so it accurately reflects the deployed code on each device. This avoids the common PWA pitfall where users unknowingly run cached old versions across multiple devices.

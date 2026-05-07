# Bible Book Finder

An interactive quiz and study app to help you learn the location of all 66 Bible books. Inspired by the book grid in the JW Library Study Bible app, with group descriptions sourced from the NWT "The 66 Books of the Bible" article.

🔗 **Live app:** [jonathan003.github.io/BibleBookFinder](https://jonathan003.github.io/BibleBookFinder/) — also available at [biblebookfinder.netlify.app](https://biblebookfinder.netlify.app)

## Features

**Modes**
- **Quiz Mode** — FSRS spaced repetition, timed responses, streaks, personal records, milestones, session summaries
- **Study Mode** — Group-based practice, no timer, focused or random book selection

**Your data**
- **Multi-user** — Up to 10 profiles with separate progress, settings, and FSRS data
- **Backup & restore** — JSON export/import with free choice of save location (any cloud drive or local folder). Device-specific layout settings (column counts, abbreviation modes, OT/NT layout) stay local on each device, so importing a backup on a different device doesn't disturb that device's screen-tuned settings
- **Bilingual** — Dutch and English, auto-detected from browser language

**Display**
- **Responsive** — Portrait and landscape with smart abbreviation switching
- **OT/NT layout** — Landscape mode supports stacked (default) or side-by-side testaments (JW Library Study Bible style), with independent column counts per testament
- **Colorblind-safe** — Blue (#3B82F6) for correct, orange (#F97316) for wrong

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

Cumulative active-quiz time (`totalQuizMs`) is summed per answered question, capped at 30 seconds per question (Anki-style). The cap means walking away or letting the screen idle adds at most 30 s per uncompleted question rather than minutes or hours. This keeps the share-message claim ("X books mastered in Y time") legitimate without requiring `visibilitychange`/`pagehide` handlers (which are unreliable on mobile, especially on iOS). Reset Progress wipes the counter; backups carry it across devices via `_schemaVersion: 2`.

## Update notifications

The app uses vite-plugin-pwa's `prompt` strategy with `useRegisterSW`. The service worker checks for updates every 30 minutes while the app is open; when a new version is detected, a banner on the home screen offers a one-tap reload via `updateServiceWorker(true)`. Settings → Data shows the currently-running build (commit hash and date), injected at build time from `git rev-parse` so it accurately reflects the deployed code on each device. This avoids the common PWA pitfall where users unknowingly run cached old versions across multiple devices.

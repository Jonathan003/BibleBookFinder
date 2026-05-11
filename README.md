# Bible Book Finder

An interactive quiz app to help you learn the location of all 66 Bible books. Inspired by the book grid in the JW Library Study Bible app, with group descriptions sourced from the NWT "The 66 Books of the Bible" article.

🔗 **Live app:** [jonathan003.github.io/BibleBookFinder](https://jonathan003.github.io/BibleBookFinder/) — also available at [biblebookfinder.netlify.app](https://biblebookfinder.netlify.app)

## Features

**Modes**
- **Quiz Mode** — FSRS spaced repetition, timed responses, streaks, personal records, milestones. Launch with a session-size of your choice: **Quick** (5 books, ~1-2 min), **Standard** (10 books, ~3-4 min), or **Full** (all due books). Launchers adapt to how many books are actually due, so you never see redundant options.
- **Box Mode** — Single-session Leitner-style cram independent of the regular schedule. Each book starts in box 1; correct answers promote, wrong answers demote, session ends when every book reaches box 5. Per-scope personal bests (all 66, individual groups) for time, mistakes, and longest streak. Tap-to-continue on wrong answers (consistent with Quiz Mode). No FSRS impact, no streak impact — a clean cram tool for short focused sessions.

**Progress tracking**
- **Six-tier ladder** — Books climb Unseen → Learning → Familiar → Mastered → Anchored → Permanent as the FSRS algorithm builds confidence. Replaces the binary mastered/not-mastered split with a tangible long-term goal (Permanent ≈ 6+ months stability)
- **7-day forecast** — Bar chart on the home screen showing how many books are due each upcoming day, so you can plan around busy or quiet days
- **Day streak** — Consecutive-days counter (with grace day for "yesterday" so night owls aren't punished by midnight rollover); your best streak ever is shown alongside
- **Three-level rest celebration** — When nothing's due now, the message matches reality: "Session complete" if the next book is back within an hour, "Done for today" if later today, "Done — enjoy the rest" if tomorrow or later
- **Session-complete screen** — When all books in the chosen session are answered, the quiz pauses on a clear stopping point (rather than refilling with random books). Two explicit choices: end the session, or use Train Ahead for bonus practice — making "stop" the obvious default rather than an act of will
- **Train Ahead** — Optional bonus practice on books that aren't yet due. Pick a horizon (5 books / 10 books / next 7 days / all remaining); books are presented closest-to-scheduled first. FSRS keeps running normally — early reviews just give slightly smaller per-rep stability gains, which is the algorithm working as intended. Useful before a vacation, on quiet days, or when you simply have extra time
- **Learning pace** — Flexible (~20% forgetting risk, lightest schedule for irregular practice), Relaxed (~15%), Balanced (default, ~10%), or Intensive (~5%, fastest mastery but daily practice required). Switching is safe: existing FSRS data stays intact, only future repetitions use the new setting

**Your data**
- **Multi-user** — Up to 10 profiles with separate progress, settings, and FSRS data
- **Backup & restore** — JSON export/import with free choice of save location (any cloud drive or local folder). Device-specific layout settings (column counts, abbreviation modes, OT/NT layout) stay local on each device, so importing a backup on a different device doesn't disturb that device's screen-tuned settings
- **Reset progress** — Per-mode in Settings → Data: Reset Quiz progress wipes FSRS data, mastery, streak, and history; Reset Box progress wipes per-scope personal bests. Independent so you can reset one without losing the other
- **Bilingual** — Dutch and English, auto-detected from browser language

**Display**
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

Cumulative active-quiz time (`totalQuizMs`) is summed per answered question, capped at 30 seconds per question (Anki-style). The cap means walking away or letting the screen idle adds at most 30 s per uncompleted question rather than minutes or hours. This keeps the share-message claim ("X books mastered in Y time") legitimate without requiring `visibilitychange`/`pagehide` handlers (which are unreliable on mobile, especially on iOS). Reset Quiz progress wipes the counter; backups carry it across devices via `_schemaVersion: 3`.

## Design philosophy: stop when due reaches zero

Spaced repetition works because of the *gap* between reviews, not the volume of reviews. When the algorithm says "no books are due", that gap is exactly the period during which your memory consolidates — re-drilling stable books resets that timer without adding strength. So the app treats reaching `due = 0` as a genuine stopping point, not a transition into a "keep going" filler mode. Two choices are then surfaced explicitly:

1. **End the session** — the recommended default. The rest message ("Stoppen versterkt geheugen") makes the case in one line so it doesn't feel like the app is hiding work from you.
2. **Train Ahead** — optional bonus practice on not-yet-due books, FSRS-ordered closest-due-first. The algorithm continues to work correctly under early reviews; users with extra time (or pre-vacation needs) get a legitimate path forward without the app pretending it's free.

For users who want shorter committed sessions, the Quick (5) and Standard (10) launchers on the home screen offer a fixed-budget alternative to the open-ended Full session. Same algorithm, same FSRS commits per answer — just a clearer "I'm done" stopping point.

The same principle applies elsewhere: the home-screen "Ready to practice" counter reaches 0 honestly instead of always showing busywork; the celebration tier matches actual rest length; and the schedule is allowed to be empty without that being a failure state.

## Update notifications

The app uses vite-plugin-pwa's `prompt` strategy with `useRegisterSW`. The service worker checks for updates every 30 minutes while the app is open; when a new version is detected, a banner on the home screen offers a one-tap reload via `updateServiceWorker(true)`. Settings → Data shows the currently-running build (commit hash and date), injected at build time from `git rev-parse` so it accurately reflects the deployed code on each device. This avoids the common PWA pitfall where users unknowingly run cached old versions across multiple devices.

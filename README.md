# Bible Book Finder

An interactive quiz and study app to help you learn the location of all 66 Bible books. Inspired by the book grid in the JW Library Study Bible app, with group descriptions sourced from the NWT "The 66 Books of the Bible" article.

🔗 **Live app:** [jonathan003.github.io/BibleBookFinder](https://jonathan003.github.io/BibleBookFinder/) — also available at [biblebookfinder.netlify.app](https://biblebookfinder.netlify.app)

## Features

- **Quiz Mode** — FSRS spaced repetition, timed responses, streaks, personal records, milestones, session summaries
- **Study Mode** — Group-based practice, no timer, focused or random book selection
- **Multi-user** — Up to 10 profiles with separate progress, settings, and FSRS data
- **Bilingual** — Dutch and English, auto-detected from browser language
- **Backup & restore** — Full JSON export/import of all user data
- **In-app help** — Getting started guide, recommended approach, and FAQ accordion
- **PWA** — Installable on Android, iOS, and desktop, works offline
- **Responsive** — Portrait and landscape with smart abbreviation switching
- **Colorblind-safe** — Blue (#3B82F6) for correct, orange (#F97316) for wrong

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

React 18, Vite 6, ts-fsrs (FSRS spaced repetition), CSS custom properties, localStorage, PWA with service worker (vite-plugin-pwa).

## Deployment

Hosted on **GitHub Pages** (primary) with auto-deploy via GitHub Actions on every push to `main`. Also hosted on **Netlify** as a backup (free plan, 300 build credits/month).

## Data sources

- Book abbreviations and color groups: JW Library Study Bible
- Group names and descriptions: NWT "The 66 Books of the Bible — What Is Contained in Them?" (jw.org)
- Spaced repetition: FSRS algorithm (open-spaced-repetition project)

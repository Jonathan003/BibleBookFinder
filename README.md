# Bible Book Finder

An interactive quiz and study app to help you learn the location of all 66 Bible books. Inspired by the book grid in the JW Library Study Bible app, with group descriptions sourced from the NWT "The 66 Books of the Bible" article.

## Features

**Quiz Mode** — A random book name appears and you tap its position in the grid as fast as you can. Answers within the mastery speed threshold count toward your streak and mark the book as mastered. Correct but slow answers still count as correct but reset the streak. Your best time per book is tracked and shown next to the prompt.

**Study Mode** — Same grid, no timer pressure. The app prioritizes books you got wrong or needed hints for in your last 5 quiz sessions (70% chance to pick a weak book). Once you've found every book in a session, it resets and starts over.

**Hints** — Toggle the hint button to see the book's color group and NWT description (e.g. "Prophetic books (17 books) — Prophecies, or predictions, concerning God's people"). Hints can be used freely without penalty.

**Multi-user** — Supports up to 10 user profiles, each with their own avatar, progress, quiz history, and settings. Users are persisted across sessions.

**Per-user settings** — Each user has independent settings for grid columns (portrait/landscape), mastery speed (1–10 seconds), highlight mastered books, and language. Switching users loads their settings automatically.

**Export / Import** — Back up your progress and settings as a JSON file from the Data tab in Settings. Import on another device to restore everything.

**Bilingual** — Dutch and English, switchable from the header. Section headers, hints, group descriptions, and all UI text are translated.

**Color groups** — 4 purple shades matching the JW Library Study Bible grid: Pentateuch/Gospels (dark), History/Acts (light), Poetry/Epistles (medium), Prophets/Revelation (darkest).

**Abbreviations** — All abbreviations match the JW Library Study Bible exactly, in both Dutch and English.

## Getting started

```bash
git clone https://github.com/Jonathan003/BibleBookFinder.git
cd BibleBookFinder
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

To install on your phone: open the app in Chrome or Safari, tap the browser menu, and select "Add to Home Screen".

## Deployment

Optimized for Netlify. Push to GitHub, import in Netlify, and deploy — the `netlify.toml` and Vite config are already set up.

## Tech stack

React, Vite, CSS custom properties, localStorage for persistence, PWA-ready with service worker.

## Data sources

- Book abbreviations and color groups: JW Library Study Bible
- Group names and descriptions: NWT "The 66 Books of the Bible — What Is Contained in Them?" (jw.org)

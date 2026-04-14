# Bible Book Finder

An interactive quiz and study app to help you learn the location of all 66 Bible books. Inspired by the book grid in the JW Library Study Bible app, with group descriptions sourced from the NWT "The 66 Books of the Bible" article.

🔗 **Live app:** [biblebookfinder.netlify.app](https://biblebookfinder.netlify.app)

## Features

**Quiz Mode (FSRS spaced repetition)** — A book name appears and you tap its position in the grid as fast as you can. The app uses the FSRS algorithm to track your progress per book across sessions. Books you struggle with come back sooner, books you've mastered appear less often. Score only counts for answers within the mastery speed threshold. Feedback (correct, too slow, wrong) appears inline in the book name bar — stats remain visible at all times.

**Study Mode (group-based)** — Choose one or more book groups to practice with checkboxes, then tap Start. No timer, no score — just learning. When you tap the wrong book, the app scrolls to the correct book which lights up in blue — tap it to continue. Hints are always free. Your group selection is saved per user and restored next time.

**Spaced repetition (FSRS)** — Long-term per-book tracking powered by the Free Spaced Repetition Scheduler algorithm. Your progress is saved across sessions. The home screen shows how many books are ready to practice.

**Personal records** — In Quiz Mode, the app tracks your best response time per book. When you beat your previous best, you see a "⚡ New record!" notification. Personal records are included in the export/import backup.

**Session summary** — When you tap Back in Quiz Mode after answering at least one question, a summary screen shows books reviewed, time spent, correct answers, and new personal records. Tap "Keep going" to continue or "Done" to return to the menu.

**Milestones** — When you master your 10th, 20th, 33rd (halfway through all 66), 39th (all Hebrew-Aramaic Scriptures), 50th, or 66th book, a celebration message appears.

**Welcome back** — If you haven't opened the app for more than 24 hours, a friendly welcome message appears on the home screen. No guilt, no streaks — just a warm nudge to pick up where you left off.

**Learning pace** — Choose between Relaxed, Balanced, or Intensive in Settings. This controls how often books come back for review. The app adapts to your schedule — practice as much or as little as you want, whenever you want. There is no daily requirement and no penalty for skipping days or weeks.

**Mastery indicator** — Books you've mastered show a gold accent line at the bottom of the cell in Quiz Mode. Toggle this on or off in Settings.

**Hints** — Toggle the hint button 💡 to see the book's color group and NWT description (e.g. "Prophetic books (17 books) — Prophecies, or predictions, concerning God's people"). The hint appears as an overlay — tap it to close. The grid never shifts.

**Multi-user** — Supports up to 10 user profiles, each with their own avatar, progress, FSRS data, quiz history, personal records, and settings.

**Export / Import** — Back up your full progress as a JSON file (e.g. `biblebookfinder-Jonathan-backup.json`) from the Data tab in Settings. The backup includes FSRS data, personal records, quiz history, all settings including study group selection, and last activity. Import on another device to restore everything. Name and avatar are not overwritten on import.

**Bilingual** — Dutch and English, switchable from the header.

**Smart abbreviations** — In portrait mode, the app automatically detects if full book names fit in the grid cells. If not, all cells switch to abbreviations together. You can override this in Settings (Auto / Always / Never). Landscape mode always shows full names.

**Auto-scroll** — When enabled in Settings → Quiz, the app automatically scrolls to the target book on each new question: Hebrew-Aramaic Scriptures scroll to the top, Christian Greek Scriptures scroll to the bottom. Toggle on or off per user.

**Responsive layout** — In landscape mode the topbar compresses to a single row, giving more space to the book grid. In portrait mode the topbar uses two rows with more detail.

**Color groups** — 4 purple shades matching the JW Library Study Bible grid: Pentateuch/Gospels (dark), History/Acts (light), Poetry/Epistles (medium), Prophets/Revelation (darkest).

**Abbreviations** — All abbreviations match the JW Library Study Bible exactly, in both Dutch and English.

## Study groups

The 66 books are divided into 8 groups, matching the NWT Study Bible:

| Group | Books | Icon |
|-------|-------|------|
| Pentateuch | Genesis — Deuteronomy (5) | 📜 |
| Historical | Joshua — Esther (12) | ⚔️ |
| Poetic | Job — Song of Solomon (5) | 🎵 |
| Prophetic | Isaiah — Malachi (17) | 🔥 |
| Gospels | Matthew — John (4) | 🕊️ |
| Acts | Acts (1) | 💨 |
| Letters | Romans — Jude (21) | ✉️ |
| Revelation | Revelation (1) | 👑 |

## Training tips

**Beginners — learn the structure step by step:**

1. Start with **Pentateuch + Gospels** (9 books) — the foundation of both testaments
2. Add **Historical books** (21 books total) — the story of Israel
3. Add **Acts + Letters** (43 books total) — the Christian congregation
4. Finally add **Prophets + Revelation** (all 66 books) — the hardest section

**Hardest books to locate:** The 17 prophetic books are the toughest for most people — they sit close together and have less familiar names. Extra practice on this group helps the most.

**Meeting preparation:** Select the group(s) that match the weekly Bible reading program. For example, if you're studying Isaiah, practice the Prophets group.

## Example training schedules

**Recommended starting point for most people**
Set Learning Pace to Balanced. Start with Study Mode on Pentateuch + Gospels (9 books) to build a mental map. Once you can find them reliably, switch to Quiz Mode. Add more groups as you feel confident. Aim to train until Due reaches 0 each session — sessions get shorter as you master more books.

**Complete beginner**
Start with Study Mode on one or two groups. Practice daily if possible, 10–15 minutes. After each study session, switch to Quiz Mode with the same groups. Work through groups in order: Pentateuch → Gospels → Historical → Poetry → Acts → Letters → Prophets → Revelation. Set Learning Pace to Balanced.

**Fast learner / highly motivated**
Set Learning Pace to Intensive. Start with Study Mode on all 66 books to build a full mental map, then switch to Quiz Mode exclusively. Train until Due reaches 0 each session. With Intensive, Due rises faster — short sessions multiple times a day work well.

**Already know the basics — strengthen weak spots**
Jump straight into Quiz Mode with all 66 books. After a few sessions, the FSRS algorithm will identify which books you struggle with and show them more often. Focus on the Prophets group separately in Study Mode if needed — most people find those 17 books the hardest.

**Busy schedule / maintaining your knowledge**
Use the app whenever you have a spare moment — waiting room, lunch break, commute. Even 2 minutes helps. Set Learning Pace to Relaxed so Due rises slowly and sessions stay short. There is no minimum, no daily requirement, and no penalty for skipping days or weeks.

## FAQ

**What is the difference between Study Mode and Quiz Mode?**
Study Mode is for learning without pressure — pick one or more groups, practice at your own pace, and the correct answer lights up when you tap wrong. Quiz Mode tests your speed and tracks your progress over time using spaced repetition. Use Study Mode to learn, Quiz Mode to master.

**What does "Ready to practice" (Due) mean on the home screen?**
It shows how many books the algorithm suggests you review right now. This includes books you haven't seen yet and books where the review interval has passed. If you have time, it is ideal to train until Due reaches 0 — but there is no obligation. After training, Due will gradually rise again as review intervals expire. How quickly it rises depends on your Learning Pace setting: Intensive brings books back sooner, Relaxed keeps them away longer.

**Does it matter how fast I tap?**
In Quiz Mode, yes. Answers within the mastery speed (default 5 seconds) count toward your score and streak. Faster answers make the book come back less often (you know it well). Slower answers or wrong answers make the book come back sooner. In Study Mode, speed does not matter.

**What do Relaxed, Balanced, and Intensive mean?**
This controls how often books come back for review, which directly affects how fast Due rises between sessions. Relaxed means longer intervals — Due rises slowly, sessions are shorter but less frequent. Intensive means shorter intervals — Due rises faster, you practice more often but learn faster. Balanced is recommended for most learners. You can change this anytime in Settings → Quiz.

**What happens when I tap the wrong book?**
In both Quiz Mode and Study Mode, the app automatically scrolls to the correct book which lights up in blue. All other books turn orange. You must tap the blue book to continue — this reinforces learning by making you actively confirm the correct location.

**What is auto-scroll?**
When enabled, the app scrolls automatically at the start of each question: Hebrew-Aramaic Scriptures scroll to the top of the grid, Christian Greek Scriptures scroll to the bottom. This gives a subtle positional hint. Toggle it on or off in Settings → Quiz.

**What happens if I use a hint?**
Nothing negative. The hint shows which color group the book belongs to, helping you find the right area in the grid. The hint appears as an overlay — tap it to close. There is no penalty for using hints. If you needed the hint to find the book, you will naturally be slower, and the algorithm picks that up automatically.

**What happens if I don't use the app for a while?**
Nothing bad. There is no penalty for taking a break — whether it's a few days, weeks, or months. When you come back, the app will show more books as "Ready to practice" because some review intervals have passed. Just pick up where you left off. The algorithm adjusts automatically.

**Is my progress saved?**
Yes, in your browser's local storage. But it will be lost if you clear your browser history or switch to a different device. Use the Export function in Settings → Data to create a backup file you can import on any device.

**Can multiple people use the app on the same device?**
Yes. The app supports up to 10 user profiles, each with their own progress, settings, and FSRS data. Tap your name in the top left to switch users or create a new one.

**What is the gold line at the bottom of some book cells?**
That indicates a mastered book — the FSRS algorithm considers it stable in your memory. You can turn this indicator on or off in Settings → Quiz → "Mastered books".

**I'm faster/slower than average. Should I change any settings?**
Yes. Adjust the mastery speed in Settings → Quiz. Lower it (e.g. 3–5 seconds) if you find it too easy. Raise it (e.g. 8–10 seconds) if you're often correct but marked as "too slow". The algorithm adapts to whatever threshold you set.

**Why are the abbreviations different from what I'm used to?**
All abbreviations match the JW Library Study Bible exactly. If you notice a difference, it may be because other Bible translations use slightly different abbreviations.

**Can I use this offline?**
Yes. After opening the app once, it works offline as a PWA (Progressive Web App). Install it on your phone via "Add to Home Screen" for the best experience.

## Getting started

**Just want to use the app?**
Open [biblebookfinder.netlify.app](https://biblebookfinder.netlify.app) in your browser. No installation needed.

To install on your phone: open the app in Chrome, tap the browser menu (three dots), and select "Add to Home Screen" or "Install". This installs the app as a PWA on your home screen and works offline.

**Want to run the code locally (for developers)?**
This requires [Node.js](https://nodejs.org) and [Git](https://git-scm.com) installed on your PC.

`git clone` downloads a full copy of the source code from GitHub to your PC:

```bash
git clone https://github.com/Jonathan003/BibleBookFinder.git
cd BibleBookFinder
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Any changes you make to the code are instantly visible.

## Deployment

Hosted on Netlify with auto-deploy on push. Push to GitHub and the site updates within 30 seconds. The `netlify.toml` and Vite config are already set up.

## Tech stack

React, Vite, ts-fsrs (FSRS spaced repetition), CSS custom properties, localStorage for persistence, PWA-ready with service worker.

## Data sources

- Book abbreviations and color groups: JW Library Study Bible
- Group names and descriptions: NWT "The 66 Books of the Bible — What Is Contained in Them?" (jw.org)
- Spaced repetition: FSRS algorithm (open-spaced-repetition project)

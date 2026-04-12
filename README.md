# Bible Book Finder

An interactive quiz and study app to help you learn the location of all 66 Bible books. Inspired by the book grid in the JW Library Study Bible app, with group descriptions sourced from the NWT "The 66 Books of the Bible" article.

🔗 **Live app:** [biblebookfinder.netlify.app](https://biblebookfinder.netlify.app)

## Features

**Quiz Mode (FSRS spaced repetition)** — A book name appears and you tap its position in the grid as fast as you can. The app uses the FSRS algorithm to track your progress per book across sessions. Books you struggle with come back sooner, books you've mastered appear less often. Score only counts for answers within the mastery speed threshold.

**Study Mode (group-based)** — Choose one or more book groups to practice with checkboxes, then tap Start. No timer, no score — just learning. When you tap the wrong book, the correct one lights up in blue so you can see where it is. Hints are always free.

**Spaced repetition (FSRS)** — Long-term per-book tracking powered by the Free Spaced Repetition Scheduler algorithm. Your progress is saved across sessions. The home screen shows how many books are ready to practice.

**Learning pace** — Choose between Relaxed, Balanced, or Intensive in Settings. This controls how often books come back for review. The app adapts to your schedule — practice as much or as little as you want, whenever you want. There is no daily requirement and no penalty for skipping days or weeks.

**Mastery indicator** — Books you've mastered show a gold accent line at the bottom of the cell in Quiz Mode. Toggle this on or off in Settings.

**Hints** — Toggle the hint button to see the book's color group and NWT description (e.g. "Prophetic books (17 books) — Prophecies, or predictions, concerning God's people").

**Multi-user** — Supports up to 10 user profiles, each with their own avatar, progress, FSRS data, quiz history, and settings.

**Export / Import** — Back up your progress and settings as a JSON file from the Data tab in Settings. Import on another device to restore everything.

**Bilingual** — Dutch and English, switchable from the header.

**Smart abbreviations** — In portrait mode, the app automatically detects if full book names fit in the grid cells. If not, all cells switch to abbreviations together. You can override this in Settings (Auto / Always / Never). Landscape mode always shows full names.

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

**Complete beginner — relaxed pace**
Practice 2-3 times per week, 5-10 minutes each. Start with Study Mode on Pentateuch + Gospels (9 books). Once comfortable, switch to Quiz Mode with those groups. Add Historical books when ready. No rush — in a few months you'll know them all.

**Complete beginner — focused pace**
Practice daily, 10-15 minutes. Start with Study Mode on one group at a time. After each study session, switch to Quiz Mode. Work through groups in order: Pentateuch → Historical → Poetry → Prophets → Gospels → Acts → Letters → Revelation.

**Highly motivated — fastest progress**
Set Learning Pace to Intensive. Practice 3-4 times per day in short bursts (10-15 minutes each): morning, lunch, afternoon, evening. Start with Study Mode on all groups to build a mental map of the grid. Then switch to Quiz Mode exclusively. When a session feels easy, challenge yourself by lowering the mastery speed threshold in Settings.

**Already know the basics — strengthen weak spots**
Jump straight into Quiz Mode with all 66 books. After a few sessions, the FSRS algorithm will identify which books you struggle with and show them more often. Focus on the Prophets group separately if needed — most people find those 17 books the hardest.

**Maintaining your knowledge**
Open the app once or twice a week for a quick Quiz session. The FSRS algorithm will only show books you're about to forget. Sessions will be short once you've mastered most books.

**Busy schedule / unpredictable free time**
Use the app whenever you have a spare moment — waiting room, lunch break, commute. Even 2 minutes helps. Set Learning Pace to Relaxed. There is no minimum, no daily requirement, and no penalty for skipping days or weeks.

## FAQ

**What is the difference between Study Mode and Quiz Mode?**
Study Mode is for learning without pressure — pick one or more groups, practice at your own pace, and the correct answer lights up when you tap wrong. Quiz Mode tests your speed and tracks your progress over time using spaced repetition. Use Study Mode to learn, Quiz Mode to master.

**What does "Ready to practice" mean on the home screen?**
It shows how many books the algorithm suggests you review. This includes books you haven't seen yet and books where the review interval has passed. It is not a daily target — just a guide for when you feel like practicing.

**Does it matter how fast I tap?**
In Quiz Mode, yes. Answers within the mastery speed (default 5 seconds) count toward your score and streak. Faster answers make the book come back less often (you know it well). Slower answers or wrong answers make the book come back sooner. In Study Mode, speed does not matter.

**What do Relaxed, Balanced, and Intensive mean?**
This controls how often books come back for review. Relaxed means books come back less often — best if you practice occasionally. Intensive means books come back more frequently — best if you practice often. Balanced is recommended for most learners. You can change this anytime in Settings → Quiz.

**What happens if I use a hint?**
Nothing negative. The hint shows which color group the book belongs to, helping you find the right area in the grid. There is no penalty for using hints. If you needed the hint to find the book, you will naturally be slower, and the algorithm picks that up automatically.

**What happens if I don't use the app for a while?**
Nothing bad. There is no penalty for taking a break — whether it's a few days, weeks, or months. When you come back, the app will show more books as "Ready to practice" because some review intervals have passed. Just pick up where you left off. The algorithm adjusts automatically.

**Is my progress saved?**
Yes, in your browser's local storage. But it will be lost if you clear your browser history or switch to a different device. Use the Export function in Settings → Data to create a backup file you can import on any device.

**Can multiple people use the app on the same device?**
Yes. The app supports up to 10 user profiles, each with their own progress, settings, and FSRS data. Tap your name in the top left to switch users or create a new one.

**What is the gold line at the bottom of some book cells?**
That indicates a mastered book — the FSRS algorithm considers it stable in your memory. You can turn this indicator on or off in Settings → Quiz → "Mastered books".

**I'm faster/slower than average. Should I change any settings?**
Yes. Adjust the mastery speed in Settings → Quiz. The default is 5 seconds. If you find it too easy, lower it (e.g. 3 seconds). If you're often correct but marked as "too slow", raise it (e.g. 7 or 8 seconds). The algorithm adapts to whatever threshold you set.

**Why are the abbreviations different from what I'm used to?**
All abbreviations match the JW Library Study Bible exactly. If you notice a difference, it may be because other Bible translations use slightly different abbreviations.

**Can I use this offline?**
Yes. After opening the app once, it works offline as a PWA (Progressive Web App). Install it on your phone via "Add to Home Screen" for the best experience.

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

Hosted on Netlify with auto-deploy on push. Push to GitHub and the site updates within 30 seconds. The `netlify.toml` and Vite config are already set up.

## Tech stack

React, Vite, ts-fsrs (FSRS spaced repetition), CSS custom properties, localStorage for persistence, PWA-ready with service worker.

## Data sources

- Book abbreviations and color groups: JW Library Study Bible
- Group names and descriptions: NWT "The 66 Books of the Bible — What Is Contained in Them?" (jw.org)
- Spaced repetition: FSRS algorithm (open-spaced-repetition project)

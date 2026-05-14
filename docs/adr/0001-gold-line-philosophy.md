# ADR 0001: Gold line philosophy — no daily streak, no time-decay, no refresher indicator

## Status

Accepted

Date: 2026-05-14

## Context

BibleBookFinder displays a "gold line" indicator on book tiles to mark books the user has demonstrated competence with. This requires defining three interlinked design questions:

1. **How is the gold line earned?** Performance-based or time-based?
2. **Does it decay with time alone?** If a user doesn't review a book for months, does the gold line disappear automatically?
3. **Should a visual signal warn the user when a book's FSRS retrievability has dropped below a threshold?**

These questions were addressed at different points in the project's history (v4 introduction, v6 commit 22 streak FAQ, v6 commit 30 FAQ on time-decay, post-commit-25 audit research). This ADR consolidates the rationale into one place.

The broader context: BBF is positioned as a no-pressure learning tool. Unlike Duolingo (which uses streak-loss anxiety to drive daily engagement) or strict SRS apps (which surface "overdue" warnings prominently), BBF aims for irregular practice to feel acceptable. A user who practices three times a week and one who practices once a month should both feel welcome.

## Decision

Three interlocking choices:

1. **Gold line is performance-based**, earned via a 3-of-3 ring buffer of correct-AND-within-target-time answers. A correct-but-slow answer pushes `false` into the buffer, same as a wrong answer. The gold line is decoupled from FSRS stability and Rooted tier — those evolve over calendar time, while the gold line responds to recent in-quiz performance.

2. **No time-based decay of the gold line.** A gold line persists indefinitely until a wrong or too-slow answer demotes it through the ring buffer. Calendar time alone does not affect gold line status.

3. **No visual refresher indicator on tiles** where FSRS retrievability has dropped below a threshold. The implicit decay mechanism (returning user → likely slower answer → ring buffer demotes the gold line) is sufficient. The user learns through the natural review experience, not through a passive UI warning.

## Alternatives Considered

### For (1): How is the gold line earned?

- **FSRS Rooted tier as gold marker** — tie gold visually to FSRS scheduling tier. Rejected because Rooted tier evolves on calendar time (stability > 7 days, MASTERY_MIN_REPS reps) and is not achievable in a single session. The gold line is meant to be an in-quiz earnable reward.
- **First correct answer = gold** — simple but creates false confidence on lucky guesses. Rejected for not requiring demonstrated consistency.

### For (2): Should the gold line decay with time?

- **Hard FSRS-coupled decay** — gold disappears when retrievability drops below ~70%. Rejected: strict, punishes irregular practice, contradicts no-pressure ethos. Users who practice monthly would see gold lines drain steadily without doing anything "wrong".
- **Visual fade with retrievability** — gradient opacity instead of binary on/off. Rejected: visual complexity, risk for deutan colorblind users for whom subtle opacity gradients fuse with background colors.

### For (3): Refresher indicator?

- **Refresh icon (↻) in tile corner when retrievability < threshold** — industry-precedent in Duolingo's "cracked skill" system. Rejected after research showing (a) no major SRS app (Anki, SuperMemo, RemNote, Mnemosyne) implements this, (b) Duolingo users complain the cracked-skill signal feels punitive and opaque, (c) Mochi's lack of decay indicator produces "forgetting hell" — but BBF's fixed 66-item scope means users naturally encounter every book through FSRS scheduling, so that failure mode doesn't apply here.
- **Subtle colored dot** — minimal version of the icon. Rejected: same conceptual issue, just less visible. Either it's visible enough to create pressure, or invisible enough to be useless.

## Consequences

### Positive

- Gold line is **achievable in a single focused session** (3 correct-within-target answers on a book).
- **No daily-streak pressure**: irregular practice is not punished. Users return after a week to find their gold lines intact.
- The "Streak" counter in-quiz is unambiguously a **per-session combo**, not a consecutive-days metric. Documented in the FAQ.
- **Implicit decay works naturally**: a long pause → slower first answers → ring buffer demotes gold lines → user re-earns them through re-engagement. No surprise data loss, no visual nag.

### Negative

- **"All 66 gold" can become a permanent end-state visually**, even after months of inactivity. The user might believe they "know" the books when their actual FSRS retrievability is below 50%. Mitigated by: (a) FSRS naturally surfaces low-retrievability books in Quiz Mode regardless of gold status, (b) FAQ entry (v6 commit 30) documents this honestly.
- **Discrepancy between visual signal (gold) and scheduling signal (FSRS retrievability)** exists but is not surfaced to the user. Acceptable trade-off given the no-pressure ethos.

## Review Trigger

Reopen this decision if:

- Users report being surprised by their actual recall when they thought "all gold = mastered"
- A user-research study (formal or anecdotal across many users) shows the no-decay model creates false confidence that materially harms learning outcomes
- A new mental model emerges in the SRS community (e.g., Anki adopts visual decay) that re-anchors user expectations

## Related

- v4: Original gold-line implementation via ring buffer (`fsrs.js`: `recordConfidentAttempt`, `isConfident`, `CONFIDENT_BUFFER_SIZE`)
- v6 commit 22: Streak FAQ rewrite, daily-streak philosophy documented
- v6 commit 30: Gold-line time-decay FAQ entry added
- v6 commit 31: Box Mode FAQ reordered and streak misinformation removed (consistency with this ADR)
- Research conducted during the refresher-indicator design discussion (2026-05-14): Anki, SuperMemo, RemNote, Mochi, Duolingo crack-skill patterns

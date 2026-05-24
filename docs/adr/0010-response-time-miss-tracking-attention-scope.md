# ADR 0010 — Response-time + miss tracking for attention scope

**Status:** Accepted (supersedes [ADR 0009](./0009-attention-scope-box-mode.md))

**Date:** 2026-05-21

## Context

ADR 0009 introduced the "Books that need attention" scope in Box Mode with a criterion combining two signals: FSRS difficulty as a statistical outlier (`difficulty > mean + 1σ`) and FSRS-due status. The hypothesis was that personally-difficult books would have elevated difficulty values and would surface as outliers.

In live use this turned out to be wrong. A user (Jonathan) reported that after completing a full 66/66 Quiz Mode race, the scope was consistently empty — even days later. Investigation revealed why:

1. **FSRS difficulty converges, not diverges, under BBF's race mechanic.** A 66/66 race requires every book to be answered 3 times correct+fast. That means almost every book receives Rating.Good, which pushes difficulty values toward a similar value. Simulation with the real ts-fsrs library showed all 66 books ending at difficulty ≈ 2.10 with stddev = 0. No outliers exist when there's no variance.

2. **FSRS-due fires only after pauses.** Books just answered have due dates pushed weeks into the future. For a regularly-training user, the due-criterion never triggers between sessions.

3. **The criterion was insensitive to actual user struggle.** Two books — one answered in 2 seconds, one in 8 seconds (both within a 10-second target) — receive identical Rating.Good and identical difficulty updates. The struggle signal is invisible to FSRS.

The user's expectation was explicit and reasonable: "even when all books are within target time, books I needed more time for, or didn't tap correctly on first try, should still surface." That cannot be derived from FSRS data alone. It requires tracking response times and miss events directly per book.

ADR 0009's "Review Trigger" section anticipated this exact failure mode: *"Reopen this decision if user feedback indicates the scope is consistently empty (suggests threshold needs adjustment, or that the underlying statistical approach is wrong for BBF's domain)."* This ADR is that reopening.

## Decision

Replace the difficulty-outlier criterion with two new criteria, kept alongside the existing FSRS-due check. The "Books that need attention" scope now triggers when at least one of the following holds for a book:

**Criterion 1 — FSRS-due NOW** (unchanged from ADR 0009)
The book's FSRS schedule has overdue it at the moment of scope computation. Catches "user has been away long enough that something needs review."

**Criterion 2 — Personally slow** (new)
The book's median recent response time (among correct answers only) is greater than the mean of all per-book medians plus one standard deviation. Catches "user answers this book correctly but consistently slower than other books, even within target time."

Requires at least 3 correct answers in the book's recent window for the median to be considered statistically meaningful. Books with fewer than 3 correct answers in the window contribute neither to the global mean nor to the per-book outlier test.

**Criterion 3 — Recent miss** (new)
The book has at least one miss in its window of last 5 answers. A "miss" is either a wrong-tap or a time-up event. Catches "user didn't tap correctly on first try recently." Self-corrects: 5 subsequent correct answers push the miss out of the window.

These are joined with logical OR — any single criterion firing puts the book in scope.

### Data structure

A new per-user field, `recentAnswers`, with shape:

```
recentAnswers: {
  '<bookId>': [
    { ms: 3200, correct: true,  ts: 1716321600000 },
    { ms: 5800, correct: true,  ts: 1716321890000 },
    { ms: 0,    correct: false, ts: 1716322100000 },
    ...
  ],
  ...
}
```

Per book, a rolling window of the last 5 answer events. Each entry has the response time in milliseconds (`ms`, set to 0 for non-correct events since the time is meaningless), the `correct` boolean, and a timestamp `ts` (for debug/audit). When a new event is appended, the oldest is dropped to maintain the window size.

Window size = 5 because: it fills within 1–2 races (responsive to recent state), it's small enough to react quickly to improvement, and it keeps storage trivial (~330 numbers across all 66 books).

### What is tracked

**Quiz Mode answers are tracked:**
- Correct + fast → `{ms: <actual>, correct: true}`
- Correct + slow (over target time but answered) → `{ms: <actual capped at MAX_ANSWER_MS>, correct: true}`
- Wrong-tap → `{ms: 0, correct: false}`
- Time-up → `{ms: 0, correct: false}`

**Box Mode answers are NOT tracked.** This preserves Box Mode's foundational FSRS-independence (ADR 0008/0009): Box Mode is a safe cram zone where drilling doesn't influence external systems. Tracking response times here would let cram-practice artificially lower a book's median, making it disappear from the attention scope despite the user not really knowing it cold. Box Mode also includes the attention scope itself; tracking would create a feedback loop where the scope can erode its own data.

### Statistical choices

**Median over mean** for the per-book aggregate. Wetenschappelijke standaard for reaction-time measurement (Cambridge CANTAB, log-transformed RT cognitive batteries). Robust against single-occurrence outliers — one accidentally slow answer doesn't promote a book into "needs attention" until it becomes a pattern.

**Correct answers only** for the median calculation. A wrong-tap's response time measures finding-the-wrong-cell, not finding-the-correct-cell — it is not a valid time for the target book. Excluding it follows the standard practice in cognitive assessments (CANTAB identification task: "average of all log-transformed reaction times of correct responses").

**Per-book medians vs global mean of medians + 1σ.** Comparing each book's median against the user's overall median tendency. Books that are 1σ above the user's average are statistically interesting outliers in *this user's* response distribution. Scales naturally: a user who answers most books in 2 seconds gets 4-second books flagged; a user who answers in 7 seconds gets 9-second books flagged. Both fair within their context.

### Eligibility (when the scope button is enabled)

Inherited from ADR 0009 with one refinement:

- Minimum 20 books with FSRS cards (insufficient-data) — unchanged
- Minimum 3 books in the resulting attention set (too-few) — unchanged
- The criterion-2 inner gate (3 correct answers per book) is implicit: books without enough data simply don't contribute to criterion 2; they may still appear via criterion 1 or 3.

The button shows disabled state with the relevant explanatory text when ineligible, as in ADR 0009.

## Alternatives Considered

- **Exponential moving average (EMA) over response time.** Technically elegant and used in deep-learning optimizers and trading indicators. Rejected here because: (a) EMA values are harder to debug and explain ("why is this book in scope?" becomes "because the EMA, which weighs old values by α^n, is..."), (b) the rolling window is more transparent to users and to future maintainers, (c) data-storage savings (1 number instead of 5) are negligible at BBF's scale.

- **Track each rating directly (Rating.Good/Hard/Easy/Again) as the signal.** FSRS already does this internally. The information is captured in difficulty and stability. Rejected because the signal is too coarse — Rating.Good covers both 2-second and 9-second correct answers; the difference between them is the actual struggle, and it gets lost.

- **Use absolute time threshold** (e.g., "books taking >70% of target time"). Considered and rejected: this is target-time-coupled, defeating jonathan's explicit requirement that the criterion work regardless of target speed. A user with a 5-second target and one with a 15-second target need different absolute thresholds; the relative (mean + 1σ) approach handles both.

- **Track Box Mode answers too.** Rejected — would (a) pollute the signal with cram-practice that doesn't reflect actual recall, (b) violate Box Mode's safe-zone guarantee (ADR 0008/0009), and (c) create a feedback loop where Box Mode "attention" sessions erase the signal that put books there.

- **Larger window (10 answers).** Considered. Would require more sessions to fill before becoming useful, and the marginal accuracy gain over 5 was not worth the slower responsiveness. Rejected for now; can be tuned later if 5 proves too jumpy.

- **Smaller window (3 answers).** Too volatile — one trick answer could flip a book in or out of scope. Rejected.

- **Add a stability-based criterion as well.** Considered as a fourth signal: low stability = not yet consolidated = needs attention. Rejected as redundant — books with low stability tend to be the same books that show up via criterion 2 (slow response) or criterion 3 (recent miss). Adding a fourth criterion would dilute the signal rather than strengthen it.

## Consequences

### Positive

- The scope now reflects what the user actually struggles with, not what FSRS infers from ratings.
- After a normal race, the scope is almost always populated (~5–15 books typically), matching user expectation.
- After a true perfect run (all books at uniformly fast times, zero misses), the scope is correctly empty.
- Self-corrects with practice: a book that drops out of the slow-or-missed pattern naturally falls out of the scope after 5 good answers.
- Target-time-independent: works whether the user has a 5-second or 15-second target.
- Aligns with cognitive-assessment science (median, correct-only).
- Box Mode's FSRS-independence is preserved.

### Negative

- A new per-user data field with rolling tracking adds storage and serialization concerns. Schema version bumps to v6.
- Requires migration code in restore path (graceful fallback to empty `{}` for pre-v6 backups).
- More code paths touching the new tracking (Quiz Mode correct/wrong/time-up handlers all need to record).
- The window-size choice (5) is empirical; may need tuning if it proves too jumpy or too sluggish.
- The miss-counter does not distinguish wrong-tap from time-up. Both are treated as the same kind of "didn't get it right on first try." If we later want different handling, the data structure supports it (the `ms` field is 0 for both, but we could add a `cause: 'wrong-tap' | 'time-up'` field without migration). Not done now to keep the structure minimal.

## Migration

Backup schema version bumps from v5 to v6. The added field is `recentAnswers`. On restore:

- v6 backup → restore `recentAnswers` as-is.
- v5 or earlier backup → restore with `recentAnswers: {}` (empty). User rebuilds the window naturally within 1–2 sessions.

Pre-existing users updating to this version see `recentAnswers: {}` until they answer some Quiz Mode questions. During the rebuild window the attention scope falls back to criterion 1 (FSRS-due) only, which may produce a temporarily reduced scope. This is acceptable — the rebuild is fast and the alternative (computing recentAnswers retroactively from quizHistory) would add migration complexity for marginal benefit.

## Review Trigger

Reopen this decision if:

- Window size of 5 proves too volatile (scope jumps in/out of scope per session) → consider 7 or 10.
- Window size of 5 proves too sluggish (slow books take many sessions to drop out) → consider 3 or 4.
- User feedback suggests the criterion-2 outlier test (mean + 1σ) is too aggressive or too lenient → tune the σ multiplier.
- A clear case emerges where wrong-tap and time-up should be weighted differently — the `cause` field can be added then.
- Box Mode answers should be tracked after all (e.g., if a separate "Box Mode personal best per book" feature wants the data) — would require careful consideration of the safe-zone implications.

## Related

- Supersedes [ADR 0009](./0009-attention-scope-box-mode.md) (the difficulty-outlier criterion is replaced; the scope itself, its eligibility gates, its mutual exclusivity with categorical scopes, and its no-records policy all remain).
- ADR 0005 — calendar-hiding principle. This ADR is consistent: response-time data drives an opt-in scope, not a daily pressure system.
- ADR 0008 — speedrun-only Quiz Mode. Quiz Mode tracks responses as a side-effect of normal answering; no UI change to Quiz Mode itself.
- Help.jsx FAQ updated in the same commit to describe the three criteria.

# ADR 0009 — Attention scope in Box Mode

**Status:** Accepted (criterion superseded by [ADR 0010](./0010-response-time-miss-tracking-attention-scope.md))

**Date:** 2026-05-18

## Context

ADR 0008 collapsed the Quiz Mode user-facing model to a single-loop speedrun: race to 66 confident, soft-reset, race again. The session-complete model is now honest and minimal. Long-term retention happens via FSRS scheduling underneath each new run.

A subsequent investigation into how FSRS data actually flows through the app surfaced a real tension. For a user whose pattern is back-to-back races (the most common usage pattern under the speedrun model), FSRS contributes:

1. The tier ladder display on the home screen (substantial — the only persistent long-term progress signal)
2. Picker order: weak books surfaced earlier in each race via Branch 3 stability tie-break (modest, mostly an order effect, not a count effect)
3. Branch 1 firing for FSRS-due books between sessions (real when breaks happen, zero benefit in back-to-back use)

Beyond these, FSRS data accumulates per-book difficulty and stability values across many races, but those values do not influence the race itself in any meaningful way — the race always needs the same ~198 picks regardless of FSRS state, because the confident threshold (3 correct + fast hits) is invariant per book.

This produces a structural mismatch: the app maintains rich FSRS data, but the race model does not surface or use that data in a way the user can act on. A user who has identified their personally-difficult books has no built-in path to practice them deliberately. Box Mode exists as a separate cram tool (Leitner-style, FSRS-independent), but its scopes are categorical (all 66, individual canonical groups, or combinations of groups) — none of which align with FSRS's actual data about which books are difficult for *this* user.

The question this ADR addresses: should Box Mode gain a scope that lets the user practice their FSRS-identified difficult books, on demand, without affecting FSRS scheduling? And if so, what defines that scope?

## Decision

Add a new scope to Box Mode called **"Boeken die aandacht nodig hebben"** / **"Books that need attention"**, positioned at the bottom of the scope picker after all 9 canonical groups.

The scope contains all books matching at least one of:

1. **High personal difficulty** — FSRS `difficulty` value strictly greater than (mean + 1 standard deviation) across all books with FSRS cards. Identifies books that are outliers in difficulty for this user, regardless of when they were last seen.
2. **FSRS-due** — books whose FSRS schedule has overdue them at the moment of scope computation.

Books that are Unseen (no FSRS card) are excluded entirely.

The scope is **disabled** (shown as a greyed-out button with a short explanatory message) when:

- Fewer than 20 books have FSRS cards (insufficient data for meaningful difficulty statistics), OR
- The resulting scope contains fewer than 3 books (would not produce a useful Box Mode session).

The scope is **mutually exclusive** with other scopes: tapping it deselects any currently-selected categorical scopes (all 66 / canonical groups), and tapping a categorical scope while attention is selected deselects attention. This differs from the existing 2-8 group multi-selection behavior in section 6 of the Box Mode UI.

The boook set is **snapshotted at session start** — selecting books that match the criteria at the moment the user taps "Start" — and remains fixed for the duration of that Box Mode session. FSRS state changes during the session (which cannot happen anyway, see point 5) would not retroactively alter the working set.

**No FSRS updates** are made during sessions in this scope, consistent with all other Box Mode scopes. Box Mode remains a safe practice zone with zero impact on the FSRS schedule.

**No persistent records** (fastest time, fewest mistakes, longest streak) are tracked for this scope, because the underlying book set varies between sessions. Per-combination records would not be comparable across sessions.

## Alternatives Considered

- **Scaled confident threshold in Quiz Mode** — Make the number of hits required for a book to become confident depend on its FSRS tier (1 hit for Permanent, 2 for Anchored/Rooted, 3 for lower tiers). Rejected: this changes Quiz Mode's race mechanic itself, requires sharing FSRS-tier-derived behavior across the app, complicates the mental model ("why does this book need fewer hits?"), and breaks comparability of personal-best times across races as more books climb tiers. The race becoming progressively shorter as the user improves is appealing in theory but adds complexity that doesn't align with ADR 0008's "one clear model" principle.

- **Two-phase warmup-then-race in Quiz Mode** — Add a pre-race FSRS-driven warmup phase before the race timer starts. Rejected: blends time-pressure and focused-learning in the same session, which the literature (and successful apps like Chess.com with their separate Rated / Learning / Puzzle Rush modes) consistently treat as distinct contexts. Adds two timers, transition states, and Share-comparability questions. Breaks ADR 0008's collapsed speedrun model.

- **Build nothing; leave FSRS data structurally underused** — Acknowledged as a serious option throughout the design discussion. Rejected because the user-visible signal of "FSRS-difficult books exist but cannot be practiced" is real, even if mild. Adding an opt-in scope provides the practice path without forcing it on anyone or requiring engagement with the FSRS internals.

- **Make the new scope combinable with categorical scopes** (e.g., "Pentateuch + attention") — Rejected: categorical scopes have a fixed semantic meaning (which canonical group), attention is a dynamic personal selection. Combining them produces a hybrid scope with no clear interpretation (unie? intersection? filter?) and no meaningful record-keeping. The conceptual asymmetry between categorical and dynamic scopes is fundamental and should be reflected in the UI.

- **Update FSRS during attention-scope Box Mode sessions** — Argued for as a way to "not waste" learning evidence. Rejected: (a) breaks Box Mode's foundational guarantee of FSRS independence; (b) feeds FSRS biased data — Box Mode sessions drill books until all reach Leitner box 5, producing only positive ratings, no failures; (c) introduces massed practice into the FSRS schedule, which is precisely what FSRS is designed to avoid (Cepeda 2008); (d) breaks the user's mental model that Box Mode is a safe zone.

- **Hard gate the scope until the user reaches 66/66 confident at least once** — Rejected: introduces an achievement-unlock mechanic that doesn't exist elsewhere in BBF. The existing soft gates (minimum 20 cards, minimum 3 books in scope) already make the scope unavailable in beginner scenarios without requiring a "first complete a race" milestone. Soft gating via natural data availability is gentler and respects user autonomy.

## Consequences

### Positive

- FSRS data finally has a user-visible, on-demand path. The picker-order effects and the tier ladder were both indirect — this scope is the first place where the user can deliberately act on FSRS's per-book judgment.
- Solves the "I just raced to 66 but I know Habakuk is still weak" use case without requiring changes to the race mechanic itself.
- Aligned with how successful learning apps separate "focused practice on weak areas" from "timed performance" (Chess.com Learning vs Rated modes, TypeQuicker weak-keys vs speed tests).
- Box Mode's FSRS independence is preserved, so users can experiment with this scope freely.
- The scope auto-disables for users where it wouldn't be meaningful (insufficient data, no significant outliers), so it doesn't pollute the UI for new users.

### Negative

- Adds a fourth conceptual category to Box Mode's scope picker (canonical universal "all 66", canonical individual groups, multi-group combinations, and now the dynamic attention scope). Mental model is slightly more complex.
- Requires explanation in Help — users won't intuit the difficulty + due unie criterion from the label alone.
- The statistical threshold (μ + 1σ) is approximate. For BBF's 66-book domain, FSRS difficulty values may not produce statistically robust outliers, especially for advanced users with relatively uniform mastery. The scope may often default to "FSRS-due books only" in practice.
- New i18n strings, README updates, and an additional FAQ to maintain.
- The exclusivity rule (attention cannot be combined with categorical scopes) is a subtle UI behavior that users may briefly find surprising on first encounter.

## Review Trigger

Reopen this decision if:

- User feedback indicates the scope is consistently empty (suggests threshold needs adjustment, or that the underlying statistical approach is wrong for BBF's domain).
- The scope feels redundant with other Box Mode use cases (no clear reason to choose it over an existing group scope).
- A different approach to surfacing FSRS data emerges as clearly superior (e.g., embedding it in Quiz Mode in a way ADR 0009 alternatives ruled out).
- Box Mode session counts drop, suggesting the added complexity is reducing engagement with Box Mode overall.

## Related

- Supersedes nothing. Extends Box Mode.
- **Superseded (criterion only) by [ADR 0010](./0010-response-time-miss-tracking-attention-scope.md)** — the difficulty-outlier criterion proved unreliable in live use (under BBF's race mechanic, FSRS difficulty values converge rather than diverge, so the outlier test produced consistently empty scopes for active users). ADR 0010 replaces criterion 2 with response-time and miss tracking. The scope itself, its eligibility gates, mutual exclusivity rules, and no-records policy from this ADR all remain.
- ADR 0005 — soft-reset framework (the calendar-hiding principle holds; this scope is on-demand, not pushed).
- ADR 0008 — speedrun-only Quiz Mode model (Quiz Mode mechanic untouched).
- BibleBookFinder Help FAQ "Wat doet 'Boeken die aandacht nodig hebben'?" (added in the same commit as this ADR).

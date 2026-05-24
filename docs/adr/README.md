# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the BibleBookFinder project.

## What is an ADR?

An ADR captures a significant design decision: the problem context, the chosen approach, alternatives considered, and consequences. Each ADR is short (typically one page), append-only (never modified after acceptance), and lives alongside the code in this repo.

For background, see [Martin Fowler's article on ADRs](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html).

## When to write one

Write an ADR when a decision is:

- **Significant** — affects how the app behaves, how users interact with it, or how the code is structured
- **Debatable** — multiple reasonable approaches exist and you had to choose
- **Likely to be questioned later** — by future-you, or by someone else reading the code in six months

Do NOT write an ADR for routine bug fixes, dead code cleanup, or obvious choices. Use commit messages for those.

A reasonable target: about one ADR per significant design discussion, typically once or twice per month for an actively maintained project.

## Index

| # | Title | Status |
|---|---|---|
| [0001](./0001-gold-line-philosophy.md) | Gold line philosophy: no daily streak, no time-decay, no refresher indicator | Accepted |
| [0002](./0002-time-up-click-to-advance.md) | Time-up flow: click-to-advance with minimum read window | Superseded by [0007](./0007-time-up-match-wrong-answer-flow.md) |
| [0003](./0003-immediate-session-complete-on-66-confident.md) | Quiz Mode flow on reaching 66 confident — immediate session-complete | Accepted |
| [0004](./0004-guard-against-late-buffer-updates.md) | Guard against late buffer updates after session-complete | Accepted |
| [0005](./0005-soft-reset-for-start-a-new-run.md) | Soft-reset semantics for "Start a new run" | Accepted (post-66 maintenance framing partly superseded by [0008](./0008-speedrun-only-quiz-mode-model.md)) |
| [0006](./0006-hint-no-rating-penalty.md) | Hint usage does not affect FSRS rating or gold-line credit | Accepted |
| [0007](./0007-time-up-match-wrong-answer-flow.md) | Time-up uses the same click-to-advance flow as wrong-answer | Accepted |
| [0008](./0008-speedrun-only-quiz-mode-model.md) | Speedrun-only Quiz Mode model — one goal, one loop | Accepted |
| [0009](./0009-attention-scope-box-mode.md) | Attention scope in Box Mode — FSRS-driven practice path | Accepted (criterion superseded by [0010](./0010-response-time-miss-tracking-attention-scope.md)) |
| [0010](./0010-response-time-miss-tracking-attention-scope.md) | Response-time + miss tracking for attention scope | Accepted |

## How to add a new ADR

1. Copy `template.md` to `NNNN-title-in-kebab-case.md` where NNNN is the next sequential number (zero-padded to 4 digits)
2. Fill in the sections
3. Add an entry to the Index table above
4. Commit using Conventional Commits format with a `docs:` prefix:
   ```
   docs: add ADR 0003 for [decision topic]
   ```

## Status meanings

- **Proposed** — under discussion, not yet decided
- **Accepted** — decision made and currently in effect
- **Deprecated** — no longer relevant but not replaced by anything specific
- **Superseded by ADR-NNNN** — replaced by a newer decision; the new ADR explains why

ADRs are never edited after Acceptance. If a decision changes, write a new ADR that supersedes the old one, with a link both ways.

## Why ADRs and not CHANGELOG.md

This project previously maintained `CHANGES.md` with detailed entries per commit. That file is retained as historical artifact through v6 commit 35 at [`docs/legacy/CHANGES.md`](../legacy/CHANGES.md) but does not receive new entries.

The split going forward:
- **Routine code changes** — captured by Conventional Commits messages (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- **Significant design decisions** — captured by ADRs in this directory

This matches modern industry practice and scales from solo development to team contexts.

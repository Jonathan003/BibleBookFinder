# ADR 0006: Hint usage does not affect FSRS rating or gold-line credit

## Status

Accepted

Date: 2026-05-15

## Context

Quiz Mode includes a Hint button that reveals the group name of the current target book (e.g., "Pentateuch", "Pauline Letters"). The hint helps a user who can't recall the location narrow down which region of the grid to scan.

Code path: `handleHint` in `QuizGrid.jsx` toggles `hintVisible` and tracks `sessionHintedBooks` for in-session stats. The hint visibility is shown in the prompt UI but does NOT enter `ratingFromSpeed` or the confident-buffer update path. A user who taps the hint, sees the group name, and clicks the correct cell within `targetSpeedMs` receives:

- FSRS rating Good or Easy (based on speed, same as an unhinted answer)
- `true` pushed to the confident buffer (counts toward the gold line)
- Score "correct within time" (same as unhinted)

During code review (2026-05-15) this was flagged as a possible gap: "shouldn't a hinted answer count differently? The user looked up the group, not retrieved it from memory." The maintainer's response was that this is deliberate, not an oversight, and the rationale should be documented before the question gets reopened.

## Decision

Hint usage does **not** modify the FSRS rating or block confident-buffer credit. A hinted-but-correct-and-fast answer is recorded identically to an unhinted correct-and-fast answer.

The `sessionHintedBooks` set continues to be tracked for in-session display purposes only — it has no effect on FSRS, the confident buffer, or any persisted state.

## Rationale

The hint reveals the book's group name, not its position in the grid. Even with the group name visible, the user still has to:

1. Recall which region of the 8×N grid corresponds to that group
2. Recognise which specific book within that group is the target
3. Locate that book's cell among ~5-12 books in the group

That sequence is active retrieval work. The group hint reduces the search space but does not give the answer. Treating a hinted-correct-fast answer as "not a retrieval" would misrepresent what the user actually did.

A secondary consideration: penalising the hint creates a disincentive to use a feature designed to unstick the user. The hint exists so a user who is genuinely stuck can keep moving without losing the session to frustration. If using the hint costs them gold-line progress, they'll avoid it — exactly the failure mode the hint was added to prevent.

## Alternatives Considered

- **Clamp rating to Hard if `hintVisible` was true at click time.** Rejected: assumes the hint gave away the answer, which it doesn't. Distorts FSRS scheduling for what is still a successful retrieval.
- **Push `false` to the confident buffer regardless of speed when the hint was used.** Rejected for the same reason — the user demonstrated retrieval, the buffer should reflect that.
- **Track hinted-vs-unhinted gold lines as two separate signals** (a "perfect gold" tier that requires no hint usage). Rejected as over-engineering for the value provided; the existing one-tier gold line is already a clear achievement.

## Consequences

### Positive

- Hint feature remains usable without psychological cost. The user can lean on it when stuck without sabotaging their gold-line progress.
- Simple, single semantics for "what counts as confident": correct AND within time, regardless of hint usage. Parallel to ADR 0001's no-decay rule — the gold line is governed by a small number of clear conditions rather than a web of modifiers.

### Negative

- A user who always hints can reach 66/66 confident without ever recalling group memberships unaided. Mitigated by: (a) the position-within-group retrieval still being required even with a hint, and (b) FSRS naturally re-surfacing books that get slow answers, so a perpetually-hinted user will still see those books often.
- The `sessionHintedBooks` set is essentially debug-only state — visible in stats but not acted on. Acceptable as long as the field is documented as such.

## Review Trigger

Reopen if:

- User-research evidence shows that hint reliance is producing weak retention (users hit 66 gold but fail position recall when tested without hint)
- The hint is expanded to reveal more than the group (e.g., specific book row or column, or the answer outright) — at that point penalisation becomes appropriate because the hint would actually be giving the answer
- A "no-hint speedrun" leaderboard / mode is added — that would require splitting the signal, but only inside the new mode, not the default flow

## Related

- ADR 0001 — Gold-line philosophy (defines what counts as confident)
- Code: `handleHint`, `sessionHintedBooks`, and the rating path in `src/components/QuizGrid.jsx`

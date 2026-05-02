## Context

The frontend proof verifier currently checks heading-based tasks with a regular expression that requires `##` before each configured heading. This is faithful to the prompt text, but it rejects Copilot outputs that preserve the intended section structure with plain heading lines such as `What Went Well`.

The change is limited to client-side proof validation. Board generation, session persistence, event reporting, scoring, and leaderboard behavior remain unchanged.

## Goals / Non-Goals

**Goals:**

- Accept required headings when they appear as standalone plain section labels.
- Preserve acceptance of existing Markdown heading output.
- Keep heading validation deterministic, local, and covered by unit tests.
- Avoid accepting arbitrary prose that merely contains the heading text.

**Non-Goals:**

- Changing task prompt wording or task bank composition.
- Introducing semantic AI-based proof grading.
- Changing bullet, paragraph, table, marker, or keyword validation behavior.
- Changing backend scoring or persistence contracts.

## Decisions

1. Use line-based heading detection.

   Required heading text should match a standalone line after trimming surrounding whitespace, with an optional Markdown heading prefix. This accepts `## What Went Well` and `What Went Well`, while rejecting prose like `Here is what went well today`.

   Alternative considered: continue using substring regex matching and add a plain-heading fallback. That would be smaller, but it increases false positives because heading names can appear inside ordinary sentences.

2. Escape configured heading text before building regular expressions.

   Task headings are currently simple strings, but escaping keeps future headings with punctuation safe and prevents accidental regex behavior.

   Alternative considered: compare normalized strings without regex. That works for plain labels, but optional Markdown prefixes are easier to express clearly with a small escaped regular expression.

3. Keep the error message wording stable.

   The current user-facing failure says `Missing heading: ## <name>`. Keeping it avoids extra UI churn while the accepted inputs broaden.

   Alternative considered: change the message to mention plain headings too. That is friendlier, but it can be handled separately if facilitators want clearer copy across all validation errors.

## Risks / Trade-offs

- Broader acceptance could let minimally formatted outputs pass -> Mitigation: require the heading text to be on its own line rather than anywhere in the proof.
- Existing tests may only cover Markdown headings -> Mitigation: add tests for plain headings, Markdown headings, case-insensitive matching, and embedded prose rejection.
- Markdown variants can be interpreted differently -> Mitigation: accept common Markdown heading prefixes while keeping matching anchored to a line.

## Migration Plan

No data migration is required. Deploy the frontend validator change with its unit tests. Rollback is a code-only revert to the previous `##`-required heading check and corresponding tests.

## Open Questions

- Should validation error copy later explain that plain section labels are accepted, or is preserving the current concise message preferable for the live game UI?
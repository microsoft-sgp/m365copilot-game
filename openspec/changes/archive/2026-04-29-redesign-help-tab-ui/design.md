## Context

The current HelpPanel is a single glass card containing a heading, summary paragraph, seven ordered-list instructions, and two secondary-looking actions. The surrounding game UI uses compact Tailwind/M3 primitives, stacked panels, and game-progress language, while the Help tab reads more like static documentation.

This change is frontend-only. It should keep the existing `HelpPanel` component boundary, `COPILOT_URL` link, and `admin` event contract intact.

## Goals / Non-Goals

**Goals:**

- Present Help as a concise play-loop guide that players can scan quickly.
- Preserve all essential gameplay instructions: onboarding, assigned pack, tile prompt, Copilot Chat, proof verification, Bingo line keywords, and activity tracking.
- Make Open Copilot Chat visually primary and keep Admin Login available as a secondary action.
- Keep the layout responsive without horizontal overflow or hidden bottom content on compact screens.
- Update component tests to verify the new content structure and preserved interactions.

**Non-Goals:**

- No changes to board generation, verification logic, keyword awarding, leaderboard behavior, or backend APIs.
- No new external dependencies or icon libraries.
- No state-aware help progression in this change; the guide remains static and deterministic.
- No changes to tab navigation structure beyond the HelpPanel content.

## Decisions

### Use a play-loop layout instead of a long ordered list

The HelpPanel should group instructions into a small number of player phases: Start, Play, Claim, and Track. This makes the workflow easier to scan than seven separate list items while preserving the same underlying guidance.

Alternative considered: keep the ordered list and improve spacing. That would be lower risk but would not address the core issue that Help feels like documentation rather than a game-facing support surface.

### Keep HelpPanel static for this iteration

The redesigned panel should not depend on `useBingoGame` state. Static content keeps the change narrow, avoids creating new reactive edge cases, and preserves the Help tab as a stable reference regardless of board state.

Alternative considered: highlight the player's current phase based on board progress. That may be useful later, but it introduces state coupling and test scope that are not necessary for the visual redesign.

### Use existing Tailwind/M3 primitives

The implementation should reuse existing classes such as `glass`, `btn`, `btn-primary`, `btn-ghost`, `text-gradient`, `bg-surface-container`, `border-outline-variant`, and named typography tokens. This keeps the redesign aligned with the current design system and avoids adding global CSS for a single panel.

Alternative considered: create new Help-specific global CSS classes. That would add indirection for a small component and make future design-system cleanup harder.

### Preserve existing external action contracts

The Copilot link should continue to use `COPILOT_URL` with `target="_blank"` and safe `rel` attributes. The Admin Login button should continue emitting `admin` so `App.vue` routing remains unchanged.

Alternative considered: move admin access out of Help. That would reduce player-facing clutter, but administrators currently rely on this entry point and the proposal keeps it in scope.

## Risks / Trade-offs

- Players may miss one of the previous ordered steps if the grouped copy becomes too terse -> Keep each phase copy explicit enough to mention every existing gameplay action.
- Promoting Copilot Chat as primary may visually compete with the game flow -> Place actions near the heading but keep the content hierarchy clear.
- Compact layouts may become cramped with multiple phase cards -> Use a single-column stack on small screens and a two-column/grid layout only at wider breakpoints.
- Tests that expect `ol li` count will fail -> Update tests to assert phase content and preserved actions instead of the old list shape.

## Migration Plan

1. Replace the HelpPanel markup with the play-loop structure while preserving imports and emitted events.
2. Update HelpPanel unit tests for the new structure, Copilot URL, admin emission, and hidden developer notes.
3. Run frontend unit tests for the HelpPanel and broader app smoke coverage.
4. Roll back by restoring the previous HelpPanel markup and tests if the redesign causes usability or regression issues.

## Open Questions

- Should future HelpPanel iterations become state-aware and highlight the player's current phase?
- Should Admin Login remain in Help long-term, or move to a less prominent footer/admin entry point after event operations settle?
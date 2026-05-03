## Context

Player recovery is entered when a player email is already claimed but the current browser lacks matching ownership proof. The backend/API behavior already exists; the issue is presentation in the setup panel. The current recovery actions use a `btn-secondary` class that is not defined in the shared frontend styles, so the primary and secondary actions can appear like plain bold text, especially on mobile. The code-entry input also uses an `input` class rather than the existing `field-input` design-system class.

The change is limited to the Vue/Tailwind frontend. It should preserve the current recovery API calls, player-token storage, assignment sync behavior, and Launch Board blocking semantics.

## Goals / Non-Goals

**Goals:**

- Make the Player Recovery section read as a focused recovery step with a clear primary action.
- Ensure recovery actions are obvious touch targets on compact screens.
- Keep the recovery email prominent so the player understands which identity is being recovered.
- Use the existing button/input design system rather than introducing a new visual language.
- Make disabled actions, especially Launch Board during recovery, visibly unavailable.

**Non-Goals:**

- No changes to backend recovery request or verification APIs.
- No changes to recovery-code generation, expiry, delivery, rate limiting, or token issuance.
- No inline email-entry flow inside Player Recovery; choosing a different email continues to use the existing identity reset path.
- No broad redesign of the setup panel, top bar, tabs, or board UI.

## Decisions

1. Use a focused recovery card inside the existing setup panel.
   - Decision: Keep recovery colocated with assigned-pack setup, but restructure the recovery card content around a title, identity email, concise guidance, and one primary action per state.
   - Rationale: The player still needs setup context, but recovery should not compete with assigned-pack metadata.
   - Alternative considered: Replace the whole setup panel with a dedicated full-page recovery screen. This would be visually cleaner but is a larger navigation/state change than needed.

2. Use existing `btn-primary`, `btn-ghost`, and `field-input` classes.
   - Decision: Replace undefined or mismatched recovery UI classes with existing design-system classes and responsive utility classes.
   - Rationale: This fixes the missing-button affordance at the source while keeping the implementation aligned with the current Tailwind component layer.
   - Alternative considered: Add a new `btn-secondary` style. This is useful if secondary filled buttons become a broader design-system need, but this flow only needs one primary and one quiet secondary action.

3. Keep “Use a different email” as a secondary action.
   - Decision: Present the different-email path as a visibly interactive secondary action below the primary recovery action.
   - Rationale: Recovery should be the main path for the claimed email, while identity reset remains available without visually competing.
   - Alternative considered: Add an inline email input to the recovery card. This duplicates EmailGate validation and organization handling, increasing risk for a polish-focused change.

4. Preserve the current two-step recovery sequence.
   - Decision: Before a successful request, show the send-code action. After a successful request, show the code field and verify action, with resend and different-email paths still available.
   - Rationale: This matches the existing API lifecycle and prevents code-entry from appearing before delivery is accepted.
   - Alternative considered: Always show the code-entry field. That is less stateful but conflicts with the existing slow-send requirement.

```text
Player recovery state
        |
        v
┌───────────────────────────┐
│ Recover your board        │
│ email identity visible    │
│ [Send Recovery Code]      │
│ Use a different email     │
└────────────┬──────────────┘
             |
             v
┌───────────────────────────┐
│ Enter recovery code       │
│ email identity visible    │
│ [000000] [Verify Code]    │
│ Send again                │
│ Use a different email     │
└────────────┬──────────────┘
             |
             v
       Board resumes
```

## Risks / Trade-offs

- Visual polish could accidentally change recovery state behavior -> keep tests anchored to existing API calls, delayed send status, code-entry timing, verify behavior, and identity reset.
- Full-width mobile buttons may make the setup card taller -> keep copy concise and avoid introducing extra explanatory text.
- Shared disabled button styling could affect other buttons -> use conventional disabled opacity/cursor/pointer behavior and verify common setup/recovery tests still pass.
- Emoji/icon use may feel inconsistent if overdone -> keep any icon small and supportive, with text carrying the accessible meaning.

## Migration Plan

- Update the frontend recovery card markup/classes and shared button disabled styles.
- Update or add component/e2e coverage for visible recovery actions, code-entry timing, and disabled Launch Board state.
- Run frontend unit tests for SetupPanel and Playwright recovery coverage where feasible.
- Roll back by reverting the frontend component/style/test changes; no data migration or API rollback is required.

## Open Questions

- None. The different-email path will continue to reset identity and return to the existing EmailGate flow.
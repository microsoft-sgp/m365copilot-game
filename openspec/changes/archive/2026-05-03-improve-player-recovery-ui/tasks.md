## 1. Recovery Card UI

- [x] 1.1 Update `SetupPanel.vue` recovery copy and structure to present a focused recovery step with the recovery email, a primary send-code action, and a secondary different-email action.
- [x] 1.2 Update the post-request recovery state so the code-entry input uses `field-input`, verify is the primary action, and resend/different-email remain available as secondary actions.
- [x] 1.3 Ensure recovery controls use responsive sizing so actions are obvious touch targets on compact screens and do not appear as unstyled body text.

## 2. Shared Styling

- [x] 2.1 Add or adjust shared disabled button styling in `tailwind.css` so disabled actions, including Launch Board during recovery, are visibly unavailable.
- [x] 2.2 Confirm the recovery UI uses existing design-system button/input classes rather than undefined classes such as `btn-secondary` or `input`.

## 3. Tests

- [x] 3.1 Update co-located `SetupPanel.test.js` coverage for the initial recovery state, visible primary/secondary actions, disabled Launch Board, and successful request code-entry state.
- [x] 3.2 Update or add Playwright recovery coverage for the compact/mobile recovery flow if existing e2e coverage does not assert the visible action hierarchy.

## 4. Verification

- [x] 4.1 Run `npm test` in `frontend/` before marking implementation tasks complete.
- [x] 4.2 Run targeted frontend lint/typecheck or e2e checks as feasible for the touched Vue/Tailwind recovery flow.
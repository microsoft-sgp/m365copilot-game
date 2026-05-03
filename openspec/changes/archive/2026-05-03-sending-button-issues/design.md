## Context

Admin OTP and Player Recovery send actions both wait for the backend request to finish before revealing the code-entry step. The backend request includes ACS Email delivery confirmation, so normal provider latency can hold the frontend in a static disabled-button state for several seconds.

The current frontend state is binary: idle versus sending. That is truthful, but visually flat. The desired change is a frontend-only perceived-responsiveness improvement that gives users a second pending status when the request takes longer than expected, without changing the backend delivery contract or implying success before the API response returns.

Current flow:

```text
User clicks Send Code
  |
  v
Frontend disables button and shows "Sending..."
  |
  v
POST request waits for backend + ACS Email confirmation
  |
  +-- success --> show code-entry step
  |
  +-- failure --> show error and allow retry
```

Proposed flow:

```text
User clicks Send Code
  |
  v
sending_fast: "Sending..."
  |
  | 3-second timer fires while request is still pending
  v
sending_slow: "Confirming delivery..."
  |
  +-- backend ok -----> sent_confirmed: show code-entry step
  |
  +-- backend 429 ----> rate-limited error and allow retry
  |
  +-- backend fail ---> delivery error and allow retry
```

## Goals / Non-Goals

**Goals:**

- Add a visible slow-pending state for Admin OTP and Player Recovery code request actions when the backend has not responded after a short delay.
- Keep send buttons disabled while a request is pending to prevent duplicate OTP/recovery code requests.
- Show code-entry controls only after the backend request succeeds.
- Clear timers and pending UI state on success, failure, retry, and component unmount.
- Cover fast success, slow pending, failure, and cleanup behavior with focused frontend tests.

**Non-Goals:**

- No backend endpoint, ACS Email, database, rate-limit, token, cookie, or telemetry changes.
- No optimistic OTP entry before the request succeeds.
- No claim that delivery has completed before the backend returns success.
- No new external UI dependency or global notification system.

## Decisions

### D1 - Model send progress as a small frontend state machine

Use an explicit request-status state rather than a boolean-only loading flag. The state should distinguish at least `idle`, `sending`, `confirming`, `sent`, and `failed` outcomes, while preserving existing error handling for 429 and service failures.

Alternatives considered: keep a boolean loading flag and change text using only a timeout side effect. Rejected because it makes stale timer cleanup and retry behavior harder to reason about, especially across two components.

### D2 - Treat `Confirming delivery...` as pending, not successful

The slow state should appear only while the request is still pending, and it should not reveal the OTP/recovery code field. The confirmed success transition remains tied to `res.ok` from the existing API helper.

Alternatives considered: change to `Sent` after three seconds regardless of backend state. Rejected because ACS Email can still fail after that point, which would force the UI to retract a success claim.

### D3 - Keep Admin OTP and Player Recovery copy aligned but context-specific

Both flows can share the same timing behavior and slow-pending copy. Final success copy can remain flow-appropriate, such as `Code sent. Check your email.` for Player Recovery and the existing OTP step prompt for Admin Login.

Alternatives considered: introduce a shared composable immediately. Viable if implementation duplication becomes awkward, but not required unless it clearly simplifies timer cleanup and tests.

### D4 - Prefer component-level tests over broad e2e timing coverage

Use fake timers in Vitest to assert the 3-second transition deterministically. Existing Playwright coverage can remain focused on end-to-end recovery behavior rather than timing-sensitive UI states.

Alternatives considered: add Playwright waits for the slow status. Rejected for the primary coverage path because timing-based e2e tests are more brittle and slower than component tests for this behavior.

## Risks / Trade-offs

- [Risk] Users may interpret `Confirming delivery...` as a guarantee that email delivery will succeed. -> Mitigation: reserve `Code sent` and code-entry reveal for backend success only.
- [Risk] Timer state can leak after success, failure, retry, or component unmount. -> Mitigation: centralize timeout cleanup in each component or a small composable and test cleanup with fake timers.
- [Risk] The 3-second threshold may feel too slow or too fast in production. -> Mitigation: keep the threshold local and easy to adjust; choose conservative copy that remains accurate across latency profiles.
- [Risk] Admin anti-enumeration semantics can be weakened by overly specific copy. -> Mitigation: keep the backend response semantics unchanged and avoid exposing whether an email is allow-listed.

## Migration Plan

1. Update Admin Login and Player Recovery frontend request states and copy.
2. Add focused frontend tests using controlled promises and fake timers.
3. Run the targeted frontend unit tests for the changed components.
4. Roll back by reverting the frontend state/copy changes; no backend data or API migration is involved.

## Open Questions

- Should the slow-pending threshold be exactly 3 seconds, or should it be slightly shorter on mobile where perceived latency is harsher?
- Should final Admin Login success display an explicit `Code sent` status before the OTP field appears, or is the existing OTP-step prompt enough confirmation?

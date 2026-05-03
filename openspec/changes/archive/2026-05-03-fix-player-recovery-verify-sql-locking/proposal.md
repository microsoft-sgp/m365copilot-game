## Why

Player recovery verification is failing in the deployed Azure Function App even when Azure Communication Services successfully sends the recovery email and the player enters the fresh code. Application Insights shows Azure SQL rejecting the verification query because `READPAST` is used inside a `SERIALIZABLE` transaction, causing the backend to return the generic service error before the code can be verified.

## What Changes

- Adjust player recovery verification so its transaction and lock hints are valid for Azure SQL while preserving atomic code redemption and device-token issuance.
- Preserve the existing user-facing failure classes: invalid or expired codes still return 401, while unexpected service failures still return a retryable 5xx response.
- Add regression coverage that exercises the intended SQL locking semantics or otherwise prevents reintroducing the invalid `SERIALIZABLE` + `READPAST` combination.
- Document and validate the deployed recovery smoke path enough to confirm a sent recovery code can be redeemed successfully.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `player-session-auth`: Recovery verification must use Azure SQL-compatible transaction and row-locking semantics while continuing to redeem valid codes atomically and reject double redemption.

## Impact

- Affected teams: backend/API maintainers, deployment operators, and event support staff who triage player recovery issues.
- Affected code: `backend/src/functions/verifyPlayerRecovery.ts`, recovery verification tests, and any SQL-specific test helper or smoke-check documentation needed for confidence.
- Affected systems: Azure Functions, Azure SQL Database, player recovery telemetry in Application Insights, and the frontend recovery UI only insofar as it consumes the existing response classes.
- APIs remain unchanged: `POST /api/player/recovery/verify` keeps the same request and response contract.
- Rollback plan: redeploy the previous backend package if the locking change causes regressions; recovery request/email delivery remains additive and existing unused recovery codes continue to expire naturally.
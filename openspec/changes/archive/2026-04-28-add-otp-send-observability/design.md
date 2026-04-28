## Context

The admin OTP login flow is implemented by [backend/src/functions/requestOtp.ts](backend/src/functions/requestOtp.ts) and [backend/src/lib/email.ts](backend/src/lib/email.ts). The send pipeline has six terminal outcomes today, but only one of them — the ACS exception path — produces an operator-readable log line, and even that line does not include the ACS operation id needed to cross-reference Azure Communication Services Email Operations / message-trace tooling. The HTTP response is intentionally identical for "email not in admin allow-list" and "email sent successfully" to prevent enumeration, so the response itself cannot be used for triage.

The repository already has an established structured-logging convention via the `InvocationContext` logger: `context.log('<event_name>', { ...details })`. Examples live in [backend/src/lib/cache.ts](backend/src/lib/cache.ts#L25-L26) and [backend/src/lib/packAssignments.ts](backend/src/lib/packAssignments.ts#L327-L328). The Function App is already wired to Application Insights, so structured `context.log` calls become queryable telemetry without any infra change.

The recipient's email address must not appear in plain text in logs. The codebase already exposes `hashOtp` in [backend/src/lib/adminAuth.ts](backend/src/lib/adminAuth.ts#L199-L201), which is a thin wrapper over Node's `createHash('sha256')`. A short SHA-256 prefix of the normalized email is sufficient to correlate multiple attempts by the same admin without exposing the address.

## Goals / Non-Goals

**Goals:**

- Make every terminal outcome of `POST /api/portal-api/request-otp` observable from Application Insights / Log Analytics without reproducing the issue.
- Capture the ACS Email operation id on every successful (and every terminally-failed) ACS call so operators can jump straight to ACS Email Operations / message-trace.
- Capture send-attempt latency so operators can spot ACS slowness or polling timeouts.
- Preserve the existing anti-enumeration HTTP response shape exactly.
- Preserve user privacy: no plain-text email address in any new log line.

**Non-Goals:**

- Surfacing diagnostic information to the admin in the HTTP response (would defeat anti-enumeration).
- Changing OTP TTL, rate-limit window, allow-list semantics, ACS configuration, or the Azure-managed sender domain.
- Adding new dashboards, alerts, or KQL queries — those are downstream consumer work and out of scope here.
- Replacing `console`-style logging with a structured logger library; we use the `InvocationContext` logger already in scope.
- Persisting send attempts to the database (the `admin_otps` row already records the attempt; we only need the send-side outcome in logs).

## Decisions

### Decision 1: Use `context.log('<event>', { ...fields })` for structured logs

The codebase already follows this pattern in `cache.ts` and `packAssignments.ts`, and Application Insights ingests these as structured custom events.

**Alternatives considered:**

- **Add `pino` or `winston`.** Rejected — pulls a new runtime dependency, conflicts with the established convention, and `InvocationContext` already routes to App Insights.
- **Plain `context.log('message')`.** Rejected — strings are not queryable as fields in App Insights; we'd lose the ability to filter on `outcome` or aggregate by `acs_send_status`.

### Decision 2: Single log event name `admin_otp_send_attempt` with an `outcome` field

Rather than multiple event names (`admin_otp_sent`, `admin_otp_acs_failed`, `admin_otp_rate_limited`, …), all branches emit the same event name and discriminate via an `outcome` enum field. This makes "show me everything that happened to OTP requests in the last hour" a single KQL query.

| Field             | Type   | Always present | Notes                                                                        |
| ----------------- | ------ | -------------- | ---------------------------------------------------------------------------- |
| `outcome`         | string | yes            | `sent` \| `dev_skipped` \| `acs_failed` \| `acs_not_configured` \| `rate_limited` \| `not_authorised` \| `not_configured` |
| `email_hash`      | string | yes            | First 12 hex chars of SHA-256 of normalized email                            |
| `latency_ms`      | number | when ACS called | Wall-clock duration of `sendAdminOtpEmail`                                  |
| `acs_message_id`  | string | when ACS replied | ACS Email operation id from the long-running operation                     |
| `acs_send_status` | string | when `outcome=acs_failed` | `exception` \| `non_succeeded_status:<status>` \| `not_configured`  |
| `error_name`      | string | when `outcome=acs_failed` and exception | Constructor name of the thrown error                            |

Note: the field set deliberately excludes `error.message` because ACS errors can echo recipient addresses; we log the error name only and leave the full stack to the existing `context.error` call.

### Decision 3: Email is identified by an opaque hash, never logged in plain text

`email_hash = sha256(normalizeEmail(email)).slice(0, 12)`. Twelve hex chars = 48 bits of entropy, more than enough to disambiguate the small admin allow-list (typically <50 entries) without being usefully brute-forceable from logs alone.

**Alternatives considered:**

- **Log the bare email.** Rejected — PII in logs, fails privacy review.
- **Log only the domain.** Rejected — too lossy when multiple admins share a tenant (the common case).
- **Log a per-deployment HMAC instead of plain SHA-256.** Considered, deferred — adds a key-management problem for marginal benefit at this scale. If admin counts grow we can migrate by re-hashing at query time.

### Decision 4: Extend `EmailSendResult` with optional metadata, not a callback

`sendAdminOtpEmail` already returns a discriminated union. We extend it to:

```ts
type EmailSendResult =
  | { ok: true; skipped?: boolean; messageId?: string; latencyMs: number }
  | { ok: false; error: string; status: 'exception' | 'non_succeeded' | 'not_configured';
      acsStatus?: string; messageId?: string; latencyMs: number };
```

The handler then decides what to log. This keeps `email.ts` free of any opinion about logging format and keeps all per-branch log emission in one place ([requestOtp.ts](backend/src/functions/requestOtp.ts)).

**Alternatives considered:**

- **Pass a logger callback into `sendAdminOtpEmail`.** Rejected — splits log emission across two files and makes it harder to reason about which fields appear in which branch.
- **Throw on failure and let the caller catch.** Rejected — the existing return-shape contract is consumed by [requestOtp.ts](backend/src/functions/requestOtp.ts#L71-L83) and the test in [backend/src/functions/requestOtp.test.js](backend/src/functions/requestOtp.test.js#L91-L103); changing it to exceptions would ripple further than necessary.

### Decision 5: Retrieve `messageId` from the ACS poller, with a documented fallback

The ACS Email SDK's `beginSend` returns a poller; the operation id is available from `poller.getOperationState().result?.id` after `pollUntilDone()` resolves, or via the long-running-operation polling URL. We read it defensively (`?.`) and treat its absence as non-fatal — `messageId` is optional in the result shape. This protects against future SDK changes while still capturing the id in the common case.

## Sequence — observable OTP send

```
 Admin UI            requestOtp.ts                  email.ts                 ACS Email
    │                     │                            │                         │
    │ POST request-otp    │                            │                         │
    │────────────────────▶│                            │                         │
    │                     │ allow-list check           │                         │
    │                     │──┐                         │                         │
    │                     │  │ if not authorised:      │                         │
    │                     │  │  log(outcome=not_authorised, email_hash)         │
    │                     │  │  return 200 friendly                              │
    │                     │◀─┘                         │                         │
    │                     │ rate-limit check           │                         │
    │                     │──┐                         │                         │
    │                     │  │ if blocked:             │                         │
    │                     │  │  log(outcome=rate_limited, email_hash)           │
    │                     │  │  return 429                                       │
    │                     │◀─┘                         │                         │
    │                     │ INSERT admin_otps          │                         │
    │                     │ sendAdminOtpEmail          │                         │
    │                     │───────────────────────────▶│                         │
    │                     │                            │ start = now()           │
    │                     │                            │ beginSend ─────────────▶│
    │                     │                            │ pollUntilDone ─────────▶│
    │                     │                            │ latency = now() - start │
    │                     │                            │ messageId = poller.id   │
    │                     │   { ok, messageId,         │                         │
    │                     │     latencyMs, status }    │                         │
    │                     │◀───────────────────────────│                         │
    │                     │ log(outcome=sent|acs_failed|...,                     │
    │                     │     email_hash, latency_ms, acs_message_id, ...)    │
    │                     │ if !ok: invalidate OTP, return 503                   │
    │                     │ else:    return 200 friendly                         │
    │ HTTP response       │                            │                         │
    │◀────────────────────│                            │                         │
```

## Risks / Trade-offs

- **Risk: Truncated 12-char SHA-256 prefix collides on unrelated tenants.** → Mitigation: 48 bits of entropy is more than enough for the admin allow-list cardinality; if collisions ever matter, lengthen the prefix without breaking older logs (longer ids still match a prefix query).
- **Risk: ACS SDK changes the shape of the poller and `messageId` becomes unavailable.** → Mitigation: `messageId` is an optional field. The log line still records `outcome`, `latency_ms`, and `acs_send_status`, which are sufficient for triage even without an id.
- **Risk: Adding logs to the anti-enumeration "not_authorised" branch leaks which emails were probed.** → Mitigation: only the hashed email and outcome are logged. App Insights access is already restricted to operators authorised to see admin-allow-list contents (they configure them in Terraform). No new audience gains visibility.
- **Risk: `latency_ms` adds wall-clock measurement overhead.** → Mitigation: a single `Date.now()` pair around an already-async ACS call is negligible (microseconds against a network round-trip).
- **Trade-off: `error.message` is intentionally excluded from logs.** → Operators lose some detail on the failure path. Mitigation: the existing `context.error('Failed to send admin OTP email', err)` call is preserved unchanged; full error stacks remain available in App Insights exceptions, just keyed off the `acs_message_id` / timestamp rather than embedded in the structured event.

## Migration Plan

1. Land code changes (no schema, no infra).
2. Deploy the Function App as part of the next normal release; logs begin appearing immediately.
3. Operators can write KQL queries against `customEvents` filtered to `name == "admin_otp_send_attempt"` from that point forward. (Authoring those queries / dashboards is downstream and out of scope.)
4. **Rollback**: revert the three code files and the spec delta and redeploy. No data migration; no cleanup of historical logs required (they self-expire under the existing App Insights retention policy).

## Open Questions

_None at this time._ The hash length, the event name, and the field set are intentionally conservative defaults that can be tuned later without breaking the contract.

## Context

Sentry is already integrated in the Vue frontend and Azure Functions backend, but the current contract only reports frontend network failures and `5xx` API responses. Expected `4xx` responses such as player recovery conflicts, invalid recovery codes, authorization failures, and validation failures are currently invisible to Sentry unless they also throw.

The deployed environment also has configuration gaps: the backend Function App can run with an empty `SENTRY_DSN`, and the frontend can be deployed from a bundle built without `VITE_SENTRY_DSN`. Since Vite embeds frontend environment variables at build time, enabling the frontend requires a rebuild, not just an App Service setting change.

Current high-level flow:

```text
Browser request
  │
  ├─ network failure/status 0 ─────────────▶ frontend Sentry event
  │
  ├─ API returns 4xx ──────────────────────▶ currently no Sentry event
  │
  └─ API returns 5xx ──────────────────────▶ frontend Sentry event

Azure Function handler
  │
  ├─ returns 4xx/5xx response ─────────────▶ currently no backend Sentry event
  │
  └─ throws exception ─────────────────────▶ backend Sentry exception + flush
```

## Goals / Non-Goals

**Goals:**

- Send every API failure response with status `400` through `599` to Sentry from the frontend API layer.
- Send every backend HTTP handler response with status `400` through `599` to Sentry, even when the handler returns a handled response rather than throwing.
- Keep backend thrown exception capture and flush behavior intact.
- Enable the same Sentry project for frontend and backend using the provided DSN, environment tags, and release metadata.
- Preserve existing response semantics: no API status/body/cookie/retry behavior changes.
- Maintain privacy filtering for request context, headers, cookies, tokens, OTPs, recovery codes, emails, and names.

**Non-Goals:**

- Changing player recovery, token ownership, admin auth, or validation business rules.
- Replacing Application Insights; it remains the Azure platform/runtime diagnostic layer.
- Adding new Sentry projects or splitting frontend/backend across different projects.
- Guaranteeing source-map upload credentials are available in every deployment; source-map upload remains controlled by existing Sentry auth token build configuration.

## Decisions

1. Capture all HTTP `400` through `599` responses as Sentry API failure events.

   Rationale: the user requirement explicitly changes the previous contract from selective capture to complete API failure visibility. This includes expected business responses such as `409 PLAYER_RECOVERY_REQUIRED` and `401 Invalid or expired code`.

   Alternative considered: keep `4xx` responses out of Sentry and rely on Application Insights or local browser inspection. That preserves low noise but fails the visibility requirement.

2. Preserve separate frontend and backend Sentry events rather than deduplicating across tiers.

   Rationale: frontend events show browser/runtime context, online state, API base, and client-side route timing; backend events show function name, runtime, status, and sanitized request context. Both are useful and satisfy the requirement that Sentry be implemented for both surfaces.

   Alternative considered: capture only backend returned failures to reduce duplicate events. That misses browser-only failures and would make frontend Sentry less useful.

3. Use explicit classification tags and stable fingerprints.

   The frontend should fingerprint by failure class, method, sanitized endpoint path, and status. The backend should fingerprint by runtime/function name, method, sanitized route/path, and status. Events should include tags such as `service`, `runtime`, `api_method`, `api_status`, and `api_status_class`.

   Alternative considered: rely on Sentry's default grouping. Default grouping would combine unrelated API failures or split stable failures by stack/message noise.

4. Keep privacy filtering centralized in existing Sentry helpers.

   Rationale: current frontend and backend helpers already sanitize sensitive keys and redact email-like values. New capture paths should pass only sanitized endpoint paths and status metadata, and should avoid including raw request bodies.

   Alternative considered: include response bodies for richer debugging. That increases the risk of sending OTP/recovery-code/auth details and is not required to meet the observability goal.

5. Enable frontend Sentry at build time and backend Sentry at runtime via Terraform-managed settings.

   Rationale: backend Function App settings are runtime configuration, while frontend `VITE_*` values are compiled into the static bundle. The same DSN must be supplied in both deployment paths.

   Alternative considered: set `VITE_SENTRY_DSN` as a frontend App Service runtime setting. That does not initialize Sentry in an already-built Vite bundle.

Target flow:

```text
Browser request
  │
  ├─ status 0 ─────────────────────────────▶ frontend event: network failure
  ├─ status 400-499 ───────────────────────▶ frontend event: API client response failure
  └─ status 500-599 ───────────────────────▶ frontend event: API server response failure

Azure Function handler
  │
  ├─ returns status 400-599 ───────────────▶ backend event: returned API failure
  └─ throws exception ─────────────────────▶ backend exception + flush
```

## Risks / Trade-offs

- [Risk] Expected user mistakes, expired codes, lockouts, auth failures, and recovery conflicts can create substantial Sentry volume. → Mitigation: tag/fingerprint `4xx` separately from `5xx` so alerts and dashboards can filter them.
- [Risk] The same returned API failure can produce both frontend and backend events. → Mitigation: tag `service=frontend` and `service=backend`, include shared status/method/path values, and rely on Sentry filtering for each investigation lens.
- [Risk] Frontend Sentry appears enabled in source but remains disabled in production if the bundle is not rebuilt with `VITE_SENTRY_DSN`. → Mitigation: include frontend build environment requirements in deployment tasks and verification.
- [Risk] Committing DSN values can invite unwanted event ingestion. → Mitigation: use Terraform variables as the environment source of truth and avoid committing Sentry auth tokens; treat the DSN as configuration that can be rotated if abused.
- [Risk] Capturing handled backend responses could accidentally include sensitive response details. → Mitigation: capture status, method, route/path, function name, and sanitized request context only; do not send raw bodies by default.

## Migration Plan

1. Update frontend Sentry API failure classification to include `400` through `599` responses.
2. Add backend Sentry capture for returned HTTP responses with status `400` through `599` in both Azure Functions and local Express execution paths.
3. Update Sentry tests to cover frontend `4xx`, backend returned `4xx`, backend returned `5xx`, and existing thrown exception capture.
4. Configure Terraform/deployment inputs so the backend Function App receives the provided `SENTRY_DSN` and related environment/release values.
5. Rebuild the frontend with `VITE_SENTRY_DSN` set to the same project DSN and deploy the rebuilt bundle.
6. Verify by triggering a controlled `4xx` and `5xx` path and confirming Sentry receives distinct frontend/backend events with sanitized context.

Rollback:

1. Empty or remove the backend `SENTRY_DSN` setting through Terraform and redeploy/restart the Function App.
2. Rebuild and redeploy the frontend without `VITE_SENTRY_DSN`.
3. Keep Application Insights enabled for platform/runtime diagnostics during rollback.

## Open Questions

- Should `4xx` events be captured with Sentry level `warning` to reduce alert noise, or level `error` to match the user's phrasing that all `4xx` are errors?
- Should high-frequency endpoints such as recovery verification receive additional rate limiting or sampling later if Sentry event volume becomes too high?

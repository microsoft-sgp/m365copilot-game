## Context

The current pack assignment lifecycle is server-authoritative: a player has at most one active assignment per campaign, incomplete assignments are reused, and rotation only happens after the challenge reaches completion. The frontend New Board button currently clears local board state, which routes the player back to setup, but setup then reuses the same assigned pack because the active assignment is still incomplete.

The product direction is to make New Board a free reroll. A reroll should close the current active board without treating it as completed, assign a new active pack, and keep abandoned packs eligible for future draws. The change crosses frontend state, backend assignment resolution, stale-session protection, and the database lifecycle status model.

## Goals / Non-Goals

**Goals:**
- Make New Board request a server-authoritative reroll and start the returned pack as a fresh board.
- Record user-initiated rerolls as abandoned assignment history, not completed challenge cycles.
- Preserve one active assignment per player campaign.
- Stop abandoned assignment sessions from accepting future progress or scoring events.
- Keep abandoned packs eligible for the same player in future assignments, while preferring a different pack for the immediate reroll when possible.
- Preserve existing first-assignment and completion-based rotation behavior for normal login/session bootstrap.

**Non-Goals:**
- Add a permanent per-user pack blacklist.
- Add paid limits, cooldowns, or anti-reroll quotas.
- Re-score or migrate historical tile events for abandoned sessions.
- Change deterministic pack generation or tile verification rules.

## Decisions

### Add an explicit reroll API path

Use a dedicated `POST /api/player/assignment/reroll` endpoint instead of overloading `POST /api/sessions` with a reroll flag.

Rationale: session creation already means bootstrap or resume. Reroll is a destructive lifecycle transition that abandons the current active assignment, so a distinct endpoint keeps normal login semantics stable and makes stale-session behavior easier to test.

Alternative considered: add `{ reroll: true }` to `POST /api/sessions`. This would reduce endpoint count but blur two different operations and make accidental rerolls easier.

### Store abandonment as lifecycle state

Extend `pack_assignments.status` with `abandoned` and add an `abandoned_at` timestamp. Do not overload `completed_at` for rerolls.

Rationale: completion and abandonment mean different things for analytics, player progress, and future challenge-cycle behavior. A separate timestamp makes assignment history auditable without pretending the board was finished.

Alternative considered: delete or overwrite the active assignment. This would lose useful history and make reroll behavior harder to explain when investigating support or analytics issues.

### Do not blacklist abandoned packs

The assignment picker should not maintain a per-user exclusion list of abandoned pack ids. It should only prefer avoiding the pack that was just abandoned when another campaign-supported pack can be selected.

Rationale: free reroll should be lightweight and replayable. A permanent blacklist introduces edge cases after many rerolls and changes assignment from balanced distribution into a no-repeat draw for each player.

Alternative considered: never reassign abandoned packs to the same player. This was rejected because it adds hidden state, makes high-reroll users special, and can exhaust the available pack set.

### Reject stale abandoned sessions

When a game session is linked to an assignment whose status is not `active`, `PATCH /api/sessions/:id` and `POST /api/events` should reject the request and avoid writing progress or score-bearing records.

Rationale: after a reroll, another open tab may still hold the old game session id. Rejecting inactive assignment sessions prevents one player from scoring multiple boards at once.

Alternative considered: let old tabs continue updating but hide them from current state. This would preserve offline progress but breaks leaderboard integrity.

### Reroll succeeds before local state is cleared

The frontend should call the reroll endpoint before clearing local board state. On success, it replaces the board with the returned pack/session. On failure, it leaves the current board intact and surfaces an error.

Rationale: a server-authoritative reroll cannot safely fall back to a local-only pack assignment. Preserving the current board on failure avoids data loss.

Alternative considered: clear local state first and let setup retry. This matches current reset behavior but can strand the player without a board if the API is unavailable.

## Sequence Diagrams

### Successful New Board reroll

```text
Player
  |
  | clicks New Board and confirms
  v
BoardPanel/useBingoGame
  |
  | POST /api/player/assignment/reroll { email, playerName, organization }
  v
Reroll API
  |
  | verify player token for email
  | begin serializable transaction
  | mark current active assignment abandoned
  | choose next pack, preferring not previous pack when possible
  | insert new active assignment and game_session
  | commit
  v
BoardPanel/useBingoGame
  |
  | initialize fresh board from returned packId/gameSessionId
  v
Player sees new board
```

### Stale old tab after reroll

```text
Old Tab
  |
  | PATCH /api/sessions/{oldSessionId}
  v
Backend
  |
  | verify token
  | load session assignment status
  | status = abandoned
  v
HTTP 409 ASSIGNMENT_NOT_ACTIVE
```

## Risks / Trade-offs

- Players may reroll until they find easier packs -> Mitigation: this is accepted product behavior for now; retain abandonment history so limits can be added later if needed.
- Reroll API failure could frustrate players who expect instant reset -> Mitigation: keep the current board intact and use clear error copy.
- Concurrent rerolls from multiple tabs could create duplicate active assignments -> Mitigation: perform abandon-and-create in a serializable transaction and rely on the existing unique active assignment index.
- Existing queries may assume assignment status is only `active` or `completed` -> Mitigation: update filters/tests to treat `abandoned` as inactive and audit admin/analytics consumers.
- A one-pack campaign cannot avoid the just-abandoned pack -> Mitigation: allow immediate reassignment of the same pack when no alternative campaign-supported pack exists.

## Migration Plan

1. Add a migration that updates the assignment status check constraint to allow `abandoned` and adds nullable `abandoned_at`.
2. Update lifecycle helpers with an explicit reroll path that abandons the active assignment and creates a replacement in one transaction.
3. Add the reroll API endpoint and stale-session guards for session updates and events.
4. Update frontend API helpers and New Board behavior to call reroll before clearing local state.
5. Update unit tests for lifecycle, API guards, frontend state, and component behavior; update e2e coverage for New Board reroll if practical.
6. Roll back by disabling the frontend reroll call and returning New Board to local reset behavior. The schema extension can remain because it is backward-compatible with active/completed flows.

## Open Questions

- Should abandoned assignments appear in any admin analytics view immediately, or is database-level history enough for this change?
- Should the stale-session rejection response use HTTP 409 consistently for both session updates and events, or should update/event endpoints continue to prefer 401 only for token failures and 400 for invalid sessions?

## 1. Database Support

- [x] 1.1 Add a numbered SQL migration with a non-unique index that supports active assignment lookup/counting by campaign, status, and pack id.
- [x] 1.2 Verify the migration does not add a uniqueness constraint that would block duplicate pack ids after campaign capacity is exhausted.

## 2. Assignment Selection Logic

- [x] 2.1 Add campaign-scoped transaction locking before new assignment pack selection.
- [x] 2.2 Replace per-player used-pack selection with active campaign pack-count selection.
- [x] 2.3 Select randomly from zero-count pack ids while any campaign-supported pack remains unused by active assignments.
- [x] 2.4 Select randomly from lowest-count pack ids when every campaign-supported pack id has at least one active assignment.
- [x] 2.5 Preserve existing incomplete-assignment reuse and completion-based rotation behavior.

## 3. Tests

- [x] 3.1 Update first-assignment tests to cover campaign-wide unused pack selection.
- [x] 3.2 Add overflow tests proving duplicates are allowed after all pack ids are active.
- [x] 3.3 Add least-used overflow tests proving duplicate assignments are distributed across minimum-count packs.
- [x] 3.4 Add tests proving existing assignment reuse does not acquire unnecessary new pack selections.
- [x] 3.5 Add transaction rollback coverage for lock or selection failures.

## 4. Validation

- [x] 4.1 Run backend unit tests for pack assignment and session lifecycle behavior.
- [x] 4.2 Run OpenSpec validation/status for `unique-active-pack-assignments` and confirm the change is apply-ready.

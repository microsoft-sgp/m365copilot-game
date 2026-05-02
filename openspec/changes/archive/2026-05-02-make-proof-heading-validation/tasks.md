## 1. Validator Implementation

- [x] 1.1 Add a safe heading-matching helper in `frontend/src/lib/verification.ts` that escapes configured heading text.
- [x] 1.2 Update the `headings` rule to accept required headings as standalone plain section-label lines or Markdown heading lines.
- [x] 1.3 Keep missing-heading error messages and all non-heading validation behavior unchanged.

## 2. Verification Coverage

- [x] 2.1 Add Vitest coverage for plain section-label headings passing validation.
- [x] 2.2 Add Vitest coverage proving existing Markdown heading output still passes validation.
- [x] 2.3 Add Vitest coverage proving heading text embedded only in prose still fails validation.
- [x] 2.4 Run the frontend Vitest suite with `npm test` from `frontend/` and confirm it passes.
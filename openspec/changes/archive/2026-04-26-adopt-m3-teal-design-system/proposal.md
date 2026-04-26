## Why

The current frontend uses a bespoke dark purple/neon-pink aesthetic with ad-hoc color tokens (`lilac`, `neon`, `app`), arbitrary typography sizes (`text-[10px]`, `text-[14px]`), and inconsistent interactive states. This makes the design system hard to maintain, produces accessibility gaps (10px text below minimum, missing focus indicators), and lacks a systematic foundation. Adopting Google Material Design 3 with a teal seed color (`#00BCD4`) replaces the ad-hoc system with a structured, accessible, and self-documenting design language — while keeping the dark theme.

## What Changes

- **Replace the color palette**: Remove the purple/neon tokens (`lilac`, `neon`, `app`, `card`) and adopt M3 tonal palette roles (`primary`, `on-primary`, `surface`, `on-surface`, etc.) generated from a teal seed color
- **Rename all design tokens**: Map 14 ad-hoc tokens to ~20 M3 color roles in the Tailwind `@theme` block
- **Introduce a typography scale**: Replace 9 arbitrary `text-[Npx]` sizes with named tokens (`text-label-sm`, `text-body-md`, `text-title-lg`) mapped to M3 type scale, with 11px minimum
- **Add state layer system**: Implement consistent hover (8% opacity), focus-visible (outline ring), pressed (10% opacity), and disabled states across all interactive elements
- **Remove hardcoded colors**: Eliminate ~16 occurrences of `rgba(192,132,252,...)` borders and inline purple hex values from component templates
- **Update gradient and glow effects**: Rewrite `text-gradient`, `glass`, `shadow-glow`, body `::before` radial gradients, and tile shimmer to use the new teal-derived palette
- **Update confetti colors**: Replace hardcoded purple hex array in `WinModal.vue` with new palette values

## Capabilities

### New Capabilities

_None — this change restructures the existing visual layer without adding new capabilities._

### Modified Capabilities

- `bingo-frontend`: Visual styling requirements change — color tokens, typography scale, and component utility classes are redefined under M3 roles
- `mobile-responsive-layout`: Minimum text size requirement updated from mixed sizes to consistent M3 type scale (label-small minimum 11px)

## Impact

- **Frontend styles**: `frontend/src/styles/tailwind.css` — full rewrite of `@theme`, `@layer base`, and `@layer components` blocks
- **18 Vue component files**: All files under `frontend/src/components/` that reference color tokens or arbitrary text sizes
- **Test files**: ~5 test files may need updates if they assert on CSS classes or color-related content
- **No backend impact**: Zero changes to API, database, or server code
- **No dependency changes**: No new npm packages required — pure CSS/Tailwind token changes
- **Rollback plan**: Revert the `tailwind.css` theme block and component class changes; all changes are CSS-only with no data or API impact
- **Affected teams**: Frontend only — no cross-team coordination needed

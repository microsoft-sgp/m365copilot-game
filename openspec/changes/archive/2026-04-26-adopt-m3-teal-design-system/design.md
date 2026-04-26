## Context

The Copilot Chat Bingo game frontend (`frontend/`) is a Vue 3 + Tailwind CSS v4 single-page application. The current visual system uses a bespoke dark purple/neon-pink palette with 14 custom color tokens defined in `frontend/src/styles/tailwind.css` via Tailwind v4's `@theme` directive. Typography uses 9 different arbitrary pixel sizes scattered across 18 component files. Interactive state feedback (hover, focus, pressed) is inconsistent — some elements have custom hover effects, most lack focus indicators. Approximately 16 occurrences of hardcoded `rgba(192,132,252,...)` border colors exist outside the token system.

The project uses Tailwind CSS v4 with the `@tailwindcss/vite` plugin. No component library is in use — all components are hand-built.

## Goals / Non-Goals

**Goals:**
- Adopt Material Design 3 color role naming and tonal palette structure using teal (`#00BCD4`) as the seed color
- Replace all 14 ad-hoc color tokens with M3 dark scheme color roles
- Introduce a named typography scale replacing arbitrary `text-[Npx]` values, with 11px minimum
- Add consistent state layer system (hover, focus-visible, pressed, disabled) across all interactive elements
- Eliminate all hardcoded color values from Vue component templates
- Maintain dark-only theme (no light mode)

**Non-Goals:**
- Adding a Material component library (Vuetify, Material Web) — components remain hand-built
- Implementing Material You dynamic color (seed from wallpaper/user preference)
- Light mode or theme switching
- Changing component architecture, game mechanics, or API surface
- Adding JS animation libraries
- Ripple effect on tap (CSS state layers are sufficient)

## Decisions

### Decision 1: Teal seed color with M3 tonal palette generation

**Choice**: Use `#00BCD4` (teal) as the M3 seed color. Generate the dark scheme tonal palette following M3's tone mapping algorithm. The palette produces primary (teal), secondary (desaturated teal), and tertiary (blue-lavender) color families.

**Rationale**: Teal echoes the Copilot visual identity, reads as "tech but fun", and generates high-contrast tonal palettes in dark mode. The tertiary blue-lavender provides a natural accent for achievements and rewards without conflicting with semantic colors (success green, error red).

**Alternatives considered**:
- Microsoft brand blue (`#0078D4`): Too corporate, could feel like "another MS app". Rejected.
- Coral (`#FF6E40`): Warm and playful but low contrast on dark surfaces. Rejected.
- Green (`#00C853`): Conflicts with success-state semantics. Rejected.

### Decision 2: M3 color role token mapping

**Choice**: Map the Tailwind `@theme` color tokens to M3 dark scheme roles:

| M3 Role | Hex | Replaces |
|---|---|---|
| `primary` | `#4DD0E1` | `lilac` (#c084fc) |
| `on-primary` | `#003640` | — |
| `primary-container` | `#004D5A` | `lilac-3` (#7c3aed) |
| `on-primary-container` | `#B2EBF2` | — |
| `secondary` | `#B0CCD1` | `muted` (#c4b5fd) |
| `on-secondary` | `#1B3438` | — |
| `secondary-container` | `#324B4F` | `app-3` (#251840) |
| `on-secondary-container` | `#CCE8ED` | — |
| `tertiary` | `#BAC6EA` | `neon` (#e879f9) |
| `on-tertiary` | `#243048` | — |
| `tertiary-container` | `#3A4760` | — |
| `on-tertiary-container` | `#D6E2FF` | — |
| `surface` | `#0E1415` | `app` (#0f0a1e) |
| `on-surface` | `#DEE3E4` | `text` (#f3e8ff) |
| `surface-container` | `#1A2122` | `card` (#1e1340), `app-2` (#1a1030) |
| `surface-container-high` | `#252B2D` | `app-3` (#251840) |
| `on-surface-variant` | `#BFC8CA` | `muted` (#c4b5fd) |
| `outline` | `#899294` | — |
| `outline-variant` | `#3F484A` | all `rgba(192,132,252,0.25)` borders |
| `error` | `#FFB4AB` | `error` (#f87171) |
| `success` | `#81C784` | `success` (#4ade80) |
| `warning` | `#FFD54F` | `warn` (#fbbf24) |

**Rationale**: Direct mapping from existing ad-hoc tokens to M3 roles makes migration mechanical. Every current token has a clear M3 equivalent. The `card` and `app-2` tokens both serve as card/container backgrounds, so they merge into `surface-container`.

**Alternatives considered**:
- Keeping dual naming (old + new): Increases maintenance. Rejected — clean cut is simpler.
- Strict M3 with 29 roles: Many roles (inverse-surface, scrim, shadow) aren't needed for this app. Rejected — only include roles actually used.

### Decision 3: Named typography scale via Tailwind `@theme`

**Choice**: Define 7 named font-size tokens in `@theme` that generate Tailwind utilities:

| Token | Size | M3 Role | Replaces |
|---|---|---|---|
| `label-sm` | 11px | Label Small | `text-[10px]` (bumped) |
| `label-md` | 12px | Label Medium | `text-[11px]`, `text-[12px]` |
| `label-lg` | 13px | Label Large | `text-[13px]` |
| `body-md` | 14px | Body Medium | `text-[14px]` |
| `title-md` | 18px | Title Medium | `text-[18px]` |
| `title-lg` | 22px | Title Large | `text-[22px]` |
| `headline-sm` | 28px | Headline Small | `text-[28px]` |

The single `text-[56px]` in WinModal stays as an arbitrary value (one-off display size).

**Rationale**: 7 named steps cover all 9 current arbitrary sizes. Merging `text-[11px]` and `text-[12px]` into `label-md` reduces visual noise — the 1px difference is imperceptible. Bumping `text-[10px]` to 11px meets M3 label-small minimum and improves readability on mobile.

### Decision 4: State layer system via Tailwind utilities

**Choice**: Apply M3 state layers as opacity overlays on the element's primary color:

| State | Opacity | Implementation |
|---|---|---|
| Hover | 8% | `hover:bg-primary/8` (or `hover:bg-on-surface/8` for surface elements) |
| Focus | — | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary` |
| Pressed | 10% | `active:bg-primary/10` |
| Disabled | 38% fg / 12% bg | `disabled:opacity-38 disabled:bg-on-surface/12` |

Focus uses outline rings rather than opacity overlays per M3 guidance. All interactive elements (buttons, tabs, tiles, links, table rows) get state layers. Current custom hover effects (tile scale+glow, button translateY) are replaced with the standardized system, though tiles retain `scale(1.03)` alongside the state layer for game feel.

**Rationale**: Consistent state feedback is an M3 core principle and accessibility requirement. Outline-based focus is more visible than opacity-based focus and works across all backgrounds.

### Decision 5: Gradient and glow effects adapt to teal palette

**Choice**: Keep the gradient and glow design patterns (text-gradient, glass, shadow-glow, body::before radial gradient, tile shimmer) but rewrite their color values to use teal-family colors. The structural CSS (gradient directions, blur amounts, animation keyframes) stays unchanged.

| Effect | Current Colors | New Colors |
|---|---|---|
| `text-gradient` | lilac → neon | primary → tertiary |
| `glass` | rgba(192,132,252, 0.08/0.25) | rgba(77,208,225, 0.08/0.25) |
| `shadow-glow` | rgba(168,85,247, 0.3) | rgba(77,208,225, 0.3) |
| `body::before` | purple/pink radials | teal/blue-lavender radials |
| `btn-primary` gradient | lilac-3 → lilac-2 → neon | primary-container → primary → tertiary |
| Tile shimmer | rgba(192,132,252, 0.04) | rgba(77,208,225, 0.04) |
| Confetti (WinModal) | 7 purple hex values | primary, tertiary, success, warning + tonal variants |

**Rationale**: The gradient/glow patterns give the app personality. Keeping the patterns but swapping colors preserves the feel while adopting the new palette.

### Decision 6: Migration is a single atomic change, not phased

**Choice**: Execute all color token renames, typography scale changes, state layer additions, and hardcoded color removals in a single change. No intermediate "dual naming" or compatibility period.

**Rationale**: All changes are CSS/template only — no API, database, or logic changes. A single change avoids the complexity of maintaining two naming systems simultaneously. If anything breaks, the rollback is simple: revert the CSS theme block and component class changes.

**Alternatives considered**:
- Two-phase (tokens first, then components): Creates a broken intermediate state where token names don't match component references. Rejected.
- Gradual file-by-file migration with aliases: Adds complexity for a purely visual change. Rejected.

## Risks / Trade-offs

- **Visual regression risk** → Mitigated by the change being CSS-only. Manual visual inspection of each view (EmailGate, SetupPanel, BoardPanel, SubmitPanel, KeywordsPanel, HelpPanel, TileModal, WinModal, admin views) against current screenshots catches regressions.
- **Hardcoded rgba values may be missed** → Mitigated by grep audit of all `rgba(` and `#` hex references in `src/components/`. The audit identified 16 hardcoded occurrences across 5 files.
- **Teal palette contrast on dark surfaces** → Primary `#4DD0E1` on surface `#0E1415` = 10.8:1 contrast ratio, well above WCAG AA. Secondary `#B0CCD1` on surface = 9.4:1. All passing.
- **Test breakage** → Tests that assert on specific CSS class names (e.g., `text-lilac`, `bg-app`) will break. These are template-level assertions, not behavioral. Mitigation: update class assertions in the same change.

## Open Questions

_None — all technical decisions are resolved._

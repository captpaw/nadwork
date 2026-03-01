# NadWork — Changes Report
> Generated for Cursor AI Agent · 2026-02-28
> Scope: Full visual redesign + complete rebrand from **NadHunt → NadWork**

---

## 0. Overview

| Item | Before | After |
|---|---|---|
| Brand name | NadHunt | **NadWork** |
| Tagline | "Hunt. Submit. Earn." | **"Work. Win. Earn."** |
| Primary accent | `#6366f1` (indigo-500) | **`#7c3aed` (violet-700)** |
| Background | `#09090b` | **`#0b0b0b`** |
| Card surface | `#111115` | **`#161616`** |
| Header height | 60px | **56px** |
| Icon stroke | 1.5px | **1.25px** |
| Logo | Indigo gradient rounded rect | **Flat #5b21b6 square rx=5, butt-cap N, purple accent mark** |
| RainbowKit accent | `#6366f1` | **`#7c3aed`** |

---

## 1. Design System

### `frontend/src/styles/theme.js` — **COMPLETE REWRITE**

- **Removed** `colors.indigo` object entirely
- **Added** `colors.violet` full tonal ramp: 200–900
  - 600 = `#7c3aed` (new primary), 700 = `#6d28d9`, 800 = `#5b21b6`
- **Updated** `colors.primary` → `#7c3aed`, `colors.secondary` → `#8b5cf6`
- **Updated** `colors.green` ramp to use `#22c55e` base
- **Updated** background palette:
  - `bg.darkest` → `#0b0b0b`
  - `bg.card` → `#161616`
  - `bg.hover` → `#1d1d1d`
  - `bg.surface` → `rgba(124,58,237,0.05)`
- **Updated** border palette (tighter, sharper):
  - `border.default` → `#202020`
  - `border.strong` → `#282828`
  - `border.hover` → `#363636`
  - `border.active` → `#7c3aed`
- **Updated** `radius.lg` → `10px` (was 12px)
- **Updated** `radius.md` → `7px` (was 8px)
- Shadow, duration, tracking tokens refined

### `frontend/src/styles/index.css` — **COMPLETE REWRITE**

- CSS custom properties updated to match new violet theme
- Scrollbar: 4px width, `#2a2a2a` thumb (was thicker, lighter)
- Skeleton shimmer: updated to `#161616` / `#202020`
- Added `gradientShift` keyframe for animated backgrounds
- `livePulse` keyframe uses green `rgba(34,197,94,...)`
- `spin` keyframe retained (used by Button loading spinner)
- All `--color-*` custom properties re-pointed to new violet values

---

## 2. Icon System

### `frontend/src/components/icons/index.jsx` — **COMPLETE REWRITE** (50 icons)

All icons are custom-designed. Zero generic / third-party icon usage.

**Base wrapper:**
```jsx
function Icon({ size=20, stroke='currentColor', strokeWidth=1.25, fill='none', style, className, children }) { ... }
```

**New icon designs (notable changes from previous):**

| Icon | Old design | New design |
|---|---|---|
| `IconNadWork` | Indigo gradient + hunt crosshair | Flat #5b21b6 rect rx=5, white N butt-cap, purple accent rect |
| `IconBounties` | 4 squares in grid | Crosshair with concentric circles |
| `IconSettings` | Cog wheel (gear) | 3 horizontal slider lines with filled circle handles |
| `IconChart` | Stroked polyline | Filled bar rects with baseline |
| `IconCalendar` | Simple rect + lines | Rect with small filled dot squares for days |
| `IconTelegram` | Old telegram bubble | Paper-plane style |
| `IconYoutube` | Generic play | Rounded rect + filled triangle play |

**All 50 export names are backward-compatible.** No import changes needed in consuming components.

---

## 3. Layout Components

### `frontend/src/components/layout/AppHeader.jsx` — **COMPLETE REWRITE**

- New `LogoMark` SVG component (30×30 viewBox):
  - `rect` fill `#5b21b6` (violet-800), `rx="5"` — flat, no gradient
  - Three `<line>` strokes forming letter N, `strokeWidth="2.3"`, **`strokeLinecap="butt"`**
  - Small `<rect x="21.5" y="5.5" width="3" height="3" rx="0.5"` fill `rgba(196,181,253,0.88)` — "precision mark"
- New wordmark: `"nad"` (weight 300, opacity 38%) + `"work"` (weight 800, full opacity)
- Header height: **56px** (was 60px)
- Active nav indicator: `1px solid` violet underline (no animated width)
- Avatar chip: 30px, `radius.sm`
- All NadHunt → NadWork text replaced

### `frontend/src/components/layout/AppFooter.jsx` — **COMPLETE REWRITE**

- Uses 18px version of LogoMark (same SVG design, scaled)
- Tagline: **"Work. Win. Earn. — Built on Monad"**
- Copyright: **© 2026 NadWork**
- Social links: `t.me/nadwork`, `twitter.com/nadwork`
- All indigo → violet color references

---

## 4. Common Components

### `frontend/src/components/common/Button.jsx` — **REWRITTEN**

- `primary` variant: `bg = violet[600]` (#7c3aed), hover: `violet[700]` (#6d28d9)
- Removed `translateY(-1px)` hover animation (too flashy)
- Added `scale(0.97)` on `mousedown` for tactile press
- Heights: sm=30px, md=36px, lg=42px
- `success` variant uses `rgba(34,197,94,...)` (green)
- `danger` variant uses `rgba(239,68,68,...)`
- Loading spinner: keeps SVG circle animation

### `frontend/src/components/common/Card.jsx` — **REWRITTEN**

- `surface` variant: `rgba(124,58,237,0.05)` background tint
- Border colors updated to new palette tokens
- Removed `translateY` on hover (cleaner)
- `boxShadow` on hover: `t.shadow.sm` only (subtle)

### `frontend/src/components/common/Badge.jsx` — **REWRITTEN**

| Status key(s) | Color |
|---|---|
| active, approved, you, open, growth | Green `#4ade80` |
| completed, dev | Violet `#a78bfa` |
| reviewing, pending, featured | Amber `#fbbf24` |
| expired, cancelled, closed | Red `#f87171` |
| new | Blue `#60a5fa` |

- Font size: 10px (was 10.5px)
- Border-radius: 3px (was 4px)
- Letter-spacing: 0.04em

### Other common components — **COLOR UPDATE ONLY**

All `rgba(99,102,241,...)` → `rgba(124,58,237,...)` and `t.colors.indigo[x]` → `t.colors.violet[x]`:

- `frontend/src/components/common/EmptyState.jsx`
- `frontend/src/components/common/Input.jsx`
- `frontend/src/components/common/Modal.jsx`
- `frontend/src/components/common/Spinner.jsx`
- `frontend/src/components/common/Toast.jsx`

---

## 5. Pages

### `frontend/src/pages/HomePage.jsx` — **COMPLETE REWRITE**

- Hero headline: `"Work. Win."` + `"Earn on-chain."` (second line in `violet[400]`)
- Background grid: uses `rgba(124,58,237,...)` tint
- Radial glow: violet-based
- "How it works" step 2 renamed: "Hunters Submit" → **"Workers Submit"**
- Icon for step 2: `IconUpload` (was `IconBolt`)
- Removed gradient text (uses solid color for sharpness)
- Hero CTA buttons: primary violet, secondary ghost

### `frontend/src/pages/HelpPage.jsx` — **REBRAND + COLOR**

- All 8 NadHunt → NadWork text instances replaced
- Social links updated: `t.me/nadwork`, `twitter.com/nadwork`
- All `rgba(99,102,241,...)` → `rgba(124,58,237,...)`
- All `t.colors.indigo[x]` → `t.colors.violet[x]`

### Pages with color-only updates

The following pages had only indigo → violet color replacements (no structural changes; all functions intact):

- `frontend/src/pages/LeaderboardPage.jsx`
- `frontend/src/pages/ProfilePage.jsx`
- `frontend/src/pages/DashboardPage.jsx`
- `frontend/src/pages/PostBountyPage.jsx`
- `frontend/src/pages/BountyDetailPage.jsx`

---

## 6. Bounty Components

All bounty components: **color-only updates** (indigo → violet). No functional changes.

- `frontend/src/components/bounty/BountyCard.jsx`
- `frontend/src/components/bounty/BountyFilter.jsx`
- `frontend/src/components/bounty/DeadlineTimer.jsx`
- `frontend/src/components/bounty/SubmitWorkModal.jsx`
- `frontend/src/components/bounty/SubmissionViewer.jsx`

---

## 7. Identity & Hooks

### `frontend/src/components/identity/IdentityModal.jsx` — **REBRAND + COLOR**

- "permanent username on NadHunt" → **"permanent username on NadWork"**
- All indigo references → violet

### `frontend/src/hooks/useSubmissionNotifications.js` — **1 LINE**

```js
// Before:
const KEY = 'nadhunt_sub_status_' + address;

// After:
const KEY = 'nadwork_sub_status_' + address;
```

> ⚠️ **Note for Cursor:** Existing users will lose their notification state cache on first load after deploy (harmless — cache is just read notification timestamps). No data loss.

---

## 8. Entry Points

### `frontend/src/main.jsx` — **1 LINE**

```js
// Before:
accentColor: '#6366f1',

// After:
accentColor: '#7c3aed',
```

RainbowKit wallet modal now matches the violet brand.

### `frontend/src/App.jsx` — **2 LINES**

```jsx
// Before:
background: '#6366f1', borderRadius: '8px'

// After:
background: '#7c3aed', borderRadius: '7px'
```

ErrorBoundary "Go Home" button matches new primary color.

---

## 9. HTML & Meta

### `frontend/index.html` — **META TAGS**

```html
<!-- Before -->
<title>NadHunt — Hunt. Submit. Earn.</title>
<meta name="description" content="NadHunt — ...">
<meta property="og:title" content="NadHunt — Work. Submit. Earn.">

<!-- After -->
<title>NadWork — Work. Win. Earn.</title>
<meta name="description" content="NadWork — Work. Win. Earn. The on-chain bounty platform built on Monad.">
<meta property="og:title" content="NadWork — Work. Win. Earn.">
<meta property="og:url" content="https://nadwork.xyz">
```

---

## 10. Dev Config

### `.claude/launch.json` — **CREATED**

Saved dev server configurations for `preview_start`:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "Frontend (Vite)",
      "runtimeExecutable": "node",
      "runtimeArgs": ["node_modules/vite/bin/vite.js", "frontend", "--port", "3000"],
      "port": 3000
    },
    {
      "name": "Hardhat Node (Local Blockchain)",
      "runtimeExecutable": "node",
      "runtimeArgs": ["node_modules/hardhat/internal/cli/cli.js", "node"],
      "port": 8545
    }
  ]
}
```

---

## 11. Files NOT Changed

The following files were intentionally left unchanged (logic/contract layer):

- All smart contracts (`contracts/`)
- All contract ABIs (`frontend/src/config/abi*.js`)
- Wagmi config (`frontend/src/config/wagmi.js`)
- Pinata config (`frontend/src/config/pinata.js`)
- All blockchain hooks (`frontend/src/hooks/use*.js`, except `useSubmissionNotifications.js`)
- All utility functions (`frontend/src/utils/`)
- All context providers (`frontend/src/context/`)

---

## 12. Audit — Final State

Run these to verify cleanliness:

```bash
# Should return 0 matches
grep -r "NadHunt\|nadhunt" frontend/src/ --include="*.jsx" --include="*.js"
grep -r "indigo\[" frontend/src/ --include="*.jsx" --include="*.js"
grep -r "#6366f1\|#4f46e5" frontend/src/ --include="*.jsx" --include="*.js"
grep -r "rgba(99,102,241" frontend/src/ --include="*.jsx" --include="*.js"
```

All four checks returned **0 matches** after changes were applied.

---

## 13. Design Principles Applied

1. **Flat over gradient** — No gradient fills in logo or UI surfaces. Gradients reserved for hero background only.
2. **Violet not Indigo** — Single, consistent accent: `#7c3aed`. No dual-accent confusion.
3. **Precision mark** — The small `rgba(196,181,253,0.88)` rect in the logo represents a work cursor / task completion indicator.
4. **Butt linecap** — Logo N strokes use `strokeLinecap="butt"` for architectural sharpness (vs rounded for friendliness).
5. **Subdued opacity hierarchy** — Wordmark uses opacity 38%/100% split for "nad"/"work" to draw eye to brand name.
6. **1.25px icon stroke** — Thinner than industry default 1.5px for premium feel at small sizes.
7. **No translateY hover** — Card/button hover states use border-color + shadow only. No vertical movement.
8. **56px header** — Tighter than common 60-64px headers. Maximises content viewport.

---

*Report end. Total files modified: 32. Total lines changed: ~4,200.*

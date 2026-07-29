# Design System and Visual Identity

This document defines the visual identity for `somosedificadigital`, based on the established Congrega App and Edifica Digital work. Preserve this system across the landing page and operational application.

## Experience principles

- Spanish and English cover every visible label, message, status, and report heading.
- The language control remains visible and preserves route, step, and entered values.
- Mobile is the primary composition. Each step has one primary action and a visible position in the flow.
- Labels remain visible, instructions stay short, and errors state the exact action needed to continue.
- Decorative elements must support meaning, hierarchy, or navigation.
- Use direct product copy. Avoid antitheses, comparisons, personification of non-human subjects, and generic AI-page motifs.
- Replace the word “no” with a direct construction when the result remains precise.
- Respect the dignity of users with varied cognitive and digital literacy through familiar language and predictable interaction.

## Color Palette

The system uses a professional, warm palette that communicates technology, order, trust, warmth, and ministerial utility.

| Color | Hex | RGB | Usage |
|-------|-----|-----|-------|
| **Purple (Primary)** | `#5B2E91` | rgb(91, 46, 145) | Headlines, buttons, brand elements, focus states |
| **Orange (Accent)** | `#F28C28` | rgb(242, 140, 40) | Call-to-action, highlights, emphasis |
| **Yellow (Soft)** | `#FFD166` | rgb(255, 209, 102) | Secondary accents, warnings, notifications |
| **Background (Light)** | `#FBFAFF` | rgb(251, 250, 255) | Page background, card backgrounds, neutral surfaces |

### Usage Guidelines

#### Purple (#5B2E91)
- Primary brand color
- Main navigation and section headers
- Primary CTA buttons
- Links and interactive elements
- Badge highlights (e.g., "Closed" status)

#### Orange (#F28C28)
- Secondary brand color
- Important actions ("New Donation", "New Impact Event")
- Section dividers and accents
- Warning/alert elements (non-critical)
- Hover states on CTAs

#### Yellow (#FFD166)
- Tertiary accent
- Information boxes
- Pending/in-progress status badges
- Secondary highlight for data visualization
- Background for subtle callouts

#### Light Background (#FBFAFF)
- Main page background
- Card and container backgrounds
- Table row alternation
- Subtle separation from white
- Reduces eye strain with slight purple tint

### Derived Colors (Generated)

For common UI states, derive these from the primary palette:

| State | Color | Usage |
|-------|-------|-------|
| Success | `#1baf7a` or `#008300` | Checkmarks, "Closed" status, completed states |
| Error | `#e74c3c` or `#c0392b` | Error messages, delete confirmations |
| Warning | `#f39c12` or `#e67e22` | Warnings, important notices (close to orange) |
| Disabled | `#bdc3c7` or `#95a5a6` | Disabled buttons, muted text |
| Border | `#e0e0e0` or `#d0d0d0` | Subtle borders, dividers |

## Typography

### Font stack

```css
/* Editorial headings */
font-family: "Source Serif 4", Georgia, serif;

/* Interface and body */
font-family: "Manrope", Arial, sans-serif;
```

Manrope provides clear interface text. Source Serif 4 provides a serious editorial tone for selected headings. Retain the existing loading and fallback strategy.

### Type Scale

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| **H1** | 32px | 700 | 1.2 | Page title, major headings |
| **H2** | 24px | 700 | 1.3 | Section headings, card titles |
| **H3** | 20px | 600 | 1.4 | Subsection headings |
| **Body** | 16px | 400 | 1.6 | Main paragraph text |
| **Small** | 14px | 400 | 1.5 | Secondary text, labels |
| **Caption** | 12px | 400 | 1.4 | Helper text, timestamps |

## Component Styling

### Buttons

**Primary Button** (Purple, CTA)
```
Background: #5B2E91
Text: White
Padding: 12px 24px
Border Radius: 8px
Hover: Darken to #4a1f6e or add 10% opacity shadow
Active: Scale 0.98
```

**Secondary Button** (Orange)
```
Background: #F28C28
Text: White
Padding: 12px 24px
Border Radius: 8px
Hover: Darken or add shadow
```

**Ghost Button** (Outline)
```
Background: Transparent
Border: 2px #5B2E91
Text: #5B2E91
Padding: 10px 22px
Hover: Background #FBFAFF
```

**Disabled Button**
```
Background: #bdc3c7
Text: White
Opacity: 0.6
Cursor: not-allowed
```

### Form Inputs

```
Background: White or #FBFAFF
Border: 1px #d0d0d0
Border Radius: 6px
Padding: 12px
Focus: Border #5B2E91, Shadow 0 0 0 3px rgba(91, 46, 145, 0.1)
```

### Cards & Containers

```
Background: White
Border Radius: 8px
Box Shadow: 0 2px 8px rgba(0, 0, 0, 0.08)
Padding: 20px
Hover: Box Shadow 0 4px 12px rgba(0, 0, 0, 0.12)
```

### Status Badges

| Status | Background | Text | Icon |
|--------|-----------|------|------|
| **InProgress** | `#FFD166` | `#333` | ⏳ |
| **Closed** | `#1baf7a` | White | ✓ |
| **Error** | `#e74c3c` | White | ✗ |
| **Pending** | `#e0e0e0` | `#333` | ⏱️ |

## Layout & Spacing

### Spacing Scale (Tailwind-compatible)

```
4px   = xs
8px   = sm
12px  = md
16px  = lg
24px  = xl
32px  = 2xl
48px  = 3xl
```

Use multiples of 4px for consistency.

### Grid & Responsive

**Mandatory: mobile-first.** Design and build the mobile layout first. Desktop remains fully usable, and every screen grows from the mobile base styles.

- Write base styles for mobile. Add tablet and desktop refinements with `min-width` breakpoints.
- **Mobile (base, <640px):** Single column, gutters 16px, padding 16px
- **Tablet (`md:`, ≥768px):** Adjust column widths, gutters 20px
- **Desktop (`lg:`, ≥1024px):** Full width, gutters 24px

Every new screen/component must be checked at a mobile viewport first, before checking desktop.

## Module Panel Layout Standard

Every operational module panel inside the dashboard (`/app/...`) follows the
same three-block structure, top to bottom. Reference implementation:
`frontend/src/features/dashboard/ProjectsPanel.jsx` (`.project-portal-header`,
`.project-filter-bar`, `.project-list-card` — see `project-portal.css`).

1. **Header block** — kicker label (e.g. "CUMPLIMIENTO Y TRAZABILIDAD"), an
   `<h1>` page title, and a one- or two-sentence description of what the
   module manages. An optional summary stat (e.g. "0 proyectos activos") may
   sit at the top-right, in its own small card.
2. **Search block** — a single card containing at least a text search input
   (placeholder describes exactly what it matches, e.g. "Buscar por código,
   proyecto, organización o aliado/donante") and a "Limpiar" (clear) button
   as a ghost/outline button. The principle to preserve is that a dedicated
   search area exists, separate from the header and from the list block —
   not that it stays minimal forever. Additional simple filters (e.g. a
   status `<select>`) fit here by default; a module may grow into more
   advanced/multi-field search or filtering within this same block as its
   needs require. Keep it to one row on desktop; stack on mobile.
3. **List block** — one card containing: a heading row with a kicker (e.g.
   "CARTERA DE PROYECTOS") + `<h2>` title on the left, and the primary
   "+ Nuevo/Crear ___" action button on the right (purple, `.edifica-
   primary-button` styling) when the module supports creating a record.
   The list/table itself follows directly below that heading row, inside
   the same card.

Do not invent a different structure for a new or existing module screen.
When a module's current layout diverges from this (e.g. the create action
lives in a separate toolbar above the search block, or the create form
opens inline in a different-colored panel), that is a defect to fix, not an
intentional variation — bring it in line with this standard instead of
preserving the divergence. See
`docs/plans/SPRINT-S2-v1_donor-picker-auth-consistency-and-toast-notifications.md`
for the "Aliados y donantes" color-consistency fix that was an early,
narrower instance of this same rule.

## Dark Mode (Future)

Not required for MVP, but design for light mode should be dark-mode compatible:
- Use CSS custom properties or Tailwind dark mode classes
- Test contrast ratios: minimum 4.5:1 for text

## Accessibility

- **Contrast:** All text must have 4.5:1 contrast ratio against background
- **Focus states:** Always visible (not just hover)
- **Color not only signal:** Use icons + color for status (e.g., ✓ + green, not just green)
- **Font sizes:** Never below 12px for body text
- **Touch targets:** Minimum 44px x 44px for buttons on mobile

## Button Tooltip Standard

Every actionable button (icon-only or text) must carry a native `title`
attribute with a short (2–6 word) description of what it does. This is the
one required baseline — no custom tooltip component, no extra CSS/JS: a
plain `title="..."` attribute, which the browser renders on hover and
exposes as the accessible name fallback for screen readers when the button
has no visible text (icon-only buttons).

- Icon-only buttons (e.g. nav icons, the toast close `×`): `title` is
  mandatory — without it there is no accessible name at all.
- Text buttons whose label is already the full action (e.g. "＋ Nuevo
  voluntario", "Guardar cambios"): still add `title` restating or slightly
  expanding the action ("Registrar un nuevo voluntario en esta
  organización") so hover behavior is consistent across the app — but do
  not restate the label verbatim with no added information; if there is
  nothing useful to add beyond the visible label, a short restatement is
  still acceptable and preferred over an inconsistent gap.
- Row-action buttons whose meaning depends on context (e.g. "Editar",
  "Suspender", "Reactivar" in a table row) should name the record they act
  on when practical (`title="Editar a Ana Pérez"`), not just repeat the
  generic verb.
- Do not use `title` as a substitute for a visible label on buttons that
  should have one per the rest of this standard (touch targets, short
  instructions) — it is a supplementary hover/accessibility hint, not a
  replacement for on-screen text.

## Icon System

Use one of:
- **Heroicons** (free, clean, minimal)
- **Feather Icons** (free, lightweight)
- **Tabler Icons** (free, modern)

Avoid icon-only buttons — always add a tooltip or label.

## Imagery & Photography

- **Donation/receipt photos:** Show as thumbnails with borders (#d0d0d0)
- **Event delivery photos:** Gallery grid with 3 columns on desktop, 2 on tablet, 1 on mobile
- **Charts/graphs:** Use Recharts with colors from palette

## Implementation in React/Tailwind

### Tailwind Config Extension

Add to `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#5B2E91',
        accent: '#F28C28',
        secondary: '#FFD166',
        background: '#FBFAFF',
        success: '#1baf7a',
        error: '#e74c3c',
        warning: '#f39c12',
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
      },
      fontSize: {
        xs: ['12px', { lineHeight: '1.4' }],
        sm: ['14px', { lineHeight: '1.5' }],
        base: ['16px', { lineHeight: '1.6' }],
        lg: ['20px', { lineHeight: '1.4' }],
        xl: ['24px', { lineHeight: '1.3' }],
        '2xl': ['32px', { lineHeight: '1.2' }],
      },
    },
  },
};
```

### Component Examples

**Primary Button:**
```jsx
<button className="bg-primary text-white px-6 py-3 rounded-md hover:bg-primary/90 active:scale-98">
  New Donation
</button>
```

**Status Badge:**
```jsx
<span className={`px-3 py-1 rounded-full text-sm font-medium ${
  status === 'Closed'
    ? 'bg-success text-white'
    : 'bg-secondary text-gray-900'
}`}>
  {status}
</span>
```

---

## Design References

This system is based on:
- **Original brief:** Congrega App + Edifica Digital Propuesta Estratégica
- **Brand promise:** Technology, order, trust, warmth, ministerial utility
- **Palette origin:** Brand guidelines for church/nonprofit ecosystem

## Versioning

- **Version:** 2.1
- **Last Updated:** 2026-07-29
- **Maintained by:** Design & Development Team
- **Review Cycle:** Every 6 months or on major brand changes

---

**Remember:** Design is not decoration — it supports clarity, accessibility, and trust.

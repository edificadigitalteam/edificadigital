# Design System & Visual Identity

This document defines the visual identity for the Donation Traceability System, based on the original Congrega App + Edifica Digital brand guidelines.

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

### Font Stack

```css
/* Headlines */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

/* Body */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

**Recommendation:** Use system fonts for simplicity and performance. Consider Tailwind's default stack.

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

**MANDATORY: Mobile-first.** Design and build the mobile layout first — it's the primary target, not an afterthought. Desktop must remain fully usable, but every screen starts from the mobile base styles and is progressively enhanced upward, never the other way around.

- Write base (unprefixed) styles for mobile. Add tablet/desktop refinements with Tailwind's `min-width` breakpoint prefixes (`sm:`, `md:`, `lg:`, `xl:`) layered on top — never build the desktop layout first and try to cram it down to mobile with `max-width` overrides.
- **Mobile (base, <640px):** Single column, gutters 16px, padding 16px
- **Tablet (`md:`, ≥768px):** Adjust column widths, gutters 20px
- **Desktop (`lg:`, ≥1024px):** Full width, gutters 24px

Every new screen/component must be checked at a mobile viewport first, before checking desktop.

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

- **Version:** 1.0
- **Last Updated:** [date]
- **Maintained by:** Design & Development Team
- **Review Cycle:** Every 6 months or on major brand changes

---

**Remember:** Design is not decoration — it supports clarity, accessibility, and trust.

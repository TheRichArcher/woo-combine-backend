### Design Tokens

Authoritative source for product-wide visual constants. Use tokens exclusively; do not introduce ad-hoc hex values or font sizes in components.

## Colors
- Brand
  - Primary: `#19C3E6`
  - Secondary: `#008FA3`
  - Accent: `#FFFFFF`
  - Contrast: `#111111`
  - Light: `#F5F6FA`

- Semantic (derived; for status/feedback)
  - Info: `#19C3E6` (brand primary)
  - Success: `#0FA3B1`
  - Warning: `#F59E0B`
  - Error: `#DC2626`

Neutral
- Text Primary: `#111827`
- Text Muted: `#6B7280`
- Border: `#E5E7EB`
- Surface: `#FFFFFF`
- Surface Subtle: `#F5F6FA`

Note: All tokens are available as CSS variables in `src/styles/tokens.css` and via Tailwind theme aliases (see `tailwind.config.js`). If a color is missing, add it here first, then wire it into both CSS variables and Tailwind.

## Typography
- Font Family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif
- Headings
  - H1: 30/36, semibold
  - H2: 24/32, semibold
  - H3: 20/28, semibold
- Body
  - Base: 16/24, regular
  - Small: 14/20, regular
  - Caption: 12/16, medium

## Spacing
- Grid: Prefer 8px scale; allow 4px for fine-tuning
- Tailwind reference: `1 = 4px`, `2 = 8px`, `3 = 12px`, `4 = 16px`, `6 = 24px`, `8 = 32px`, `10 = 40px`, `12 = 48px`, `16 = 64px`, `20 = 80px`

## Radius
- Button: 10–12px (`rounded-lg`)
- Input: 10–12px (`rounded-lg`)
- Modal: 12–16px (`rounded-xl`)

## Icons
- Library: lucide-react
- Sizes: 16, 20, 24 (default 20)
- Stroke width: 1.5–2.0 (default 2)

## Elevation
- Card: shadow-sm
- Popover/Toast: shadow-lg
- Modal: shadow-xl + overlay `rgba(0,0,0,0.5)`

## State
- Focus Ring: 2px, brand primary at 30% opacity
- Disabled: 50% opacity; no hover

## Usage
- Use Tailwind classes backed by these tokens or the provided UI components under `src/components/ui/`.
- Do not hardcode inline styles for colors, spacing, or typography in components.



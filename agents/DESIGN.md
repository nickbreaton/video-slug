# Design System

This document describes the design system and styling guidelines for VideoSlug, inspired by a minimalist, sharp-edged aesthetic.

## Philosophy & Principles

The VideoSlug design system emphasizes:

- **Minimalism**: Clean, uncluttered interfaces that focus on content
- **Sharp edges**: Precise borders with thin lines for a technical feel
- **Content-first**: Video information and actions take precedence over decorative elements
- **Mobile-first**: Responsive design that works beautifully on all screen sizes
- **Subtle interactivity**: Gentle state changes that provide feedback without being distracting

The aesthetic draws inspiration from a technical, developer-focused design language while maintaining a friendly, approachable feel for a video management application.

## Color Palette

VideoSlug uses a custom neutral color palette based on Radix Gray, with Radix Blue available for accent colors. All colors are defined as CSS custom properties in `src/styles/global.css`.

### Neutral Colors (Primary)

The neutral palette is used for backgrounds, borders, text, and interactive elements. It automatically adapts to light and dark mode using `@media (prefers-color-scheme)`.

| Scale | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `neutral-1` | `#fcfcfc` | `#111111` | Primary background |
| `neutral-2` | `#f9f9f9` | `#191919` | Secondary backgrounds, button base |
| `neutral-3` | `#f0f0f0` | `#222222` | Tertiary backgrounds, hover states |
| `neutral-4` | `#e8e8e8` | `#2a2a2a` | Dividers, subtle borders |
| `neutral-5` | `#e0e0e0` | `#313131` | Elevated surfaces |
| `neutral-6` | `#d9d9d9` | `#3a3a3a` | Primary borders |
| `neutral-7` | `#cecece` | `#484848` | Border hover states |
| `neutral-8` | `#bbbbbb` | `#606060` | Disabled text, separators |
| `neutral-9` | `#8d8d8d` | `#6e6e6e` | Tertiary text |
| `neutral-10` | `#838383` | `#7b7b7b` | Secondary text, status labels |
| `neutral-11` | `#646464` | `#b4b4b4` | Primary text, button text |
| `neutral-12` | `#202020` | `#eeeeee` | Headings, emphasized text |

**Key Usage Patterns:**

- Backgrounds: `bg-neutral-1` for main page, `bg-neutral-2` for cards and button backgrounds
- Borders: `border-neutral-6` for standard borders, `border-neutral-7` for hover states
- Text: `text-neutral-11` for primary text, `text-neutral-10` for secondary text, `text-neutral-12` for headings

### Accent Colors (Blue Scale)

Radix Blue is available for accent elements when needed (currently unused but available):

| Scale | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `accent-1` to `accent-12` | Various blue shades | Various blue shades | Accent colors, highlights, CTAs |

**Available for:** Links, active states, progress indicators, or any element that needs emphasis.

## Typography

VideoSlug uses the **Geist** font family for all UI text, with specific treatment for monospace content.

### Font Families

- **Geist Sans**: Primary font for all UI text (headings, body text, labels)
  - Applied via Tailwind's default font family setup
- **Geist Mono**: Available for monospace text (code, technical values, data)

### Font Hierarchy

**Headings:**
- Primary heading (e.g., "VideoSlug"): `text-lg sm:text-xl font-medium text-neutral-12`
- Section headings (e.g., "Video: {id}"): `text-xl sm:text-2xl font-medium text-neutral-12`

**Body Text:**
- Primary text: `text-neutral-11`
- Secondary text: `text-neutral-10`
- Status labels: `text-xs text-neutral-10`

**Links:**
- Default: `text-sm text-neutral-11`
- Hover: `hover:text-neutral-12 hover:underline`

**Button Text:**
- Standard: `text-sm text-neutral-11`

## Layout & Spacing

### Mobile-First Approach

All layouts start with mobile styles and expand for larger screens using the `sm:` breakpoint prefix.

### Container System

**Main Container:**
- Centered with max width: `mx-auto max-w-4xl`
- Full height: `min-h-screen`

### Spacing Scale

**Padding:**
- Standard: `px-4 py-4` (16px horizontal, 16px vertical)
- Larger screens: `sm:px-6 sm:py-5` (24px horizontal, 20px vertical)
- Content areas: `px-4 py-6` on mobile, `sm:px-6 sm:py-8` on desktop

**Margins:**
- Gaps in flex layouts: `gap-2` (8px), `gap-3` (12px), `gap-4` (16px)

### Flexbox Patterns

**Horizontal Layout:**
```css
flex items-center justify-between px-4 py-4
```

**Vertical Layout with Responsive Row:**
```css
flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4
```

## Component Styles

### Header

The header is a boxed container with the application title and action buttons.

**Structure:**
- Container with borders on top, left, right: `border-x border-neutral-6 border-t border-neutral-6`
- Flex layout for horizontal arrangement: `flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5`
- Title: `text-lg font-medium text-neutral-12 sm:text-xl`
- Button group: `flex items-center gap-2 sm:gap-3`

**Example:**
```jsx
<div className="border-x border-neutral-6 border-t border-neutral-6">
  <header className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
    <h1 className="text-lg font-medium text-neutral-12 sm:text-xl">VideoSlug</h1>
    <div className="flex items-center gap-2 sm:gap-3">
      {/* Action buttons */}
    </div>
  </header>
</div>
```

### Video List

The video list displays videos in a clean, scannable format with thumbnails, metadata, and actions.

**List Item Structure:**
- Container with bottom border: `border-b border-neutral-6 last:border-b-0`
- Inner wrapper: `flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4`
- Content wrapper: `flex min-w-0 flex-1 flex-col gap-1`
- Thumbnail: `h-20 w-20 flex-shrink-0 rounded-sm object-cover border border-neutral-6`

**Video Item Content:**
- Title link: `font-medium text-neutral-11 hover:text-neutral-12 hover:underline`
- Status text: `text-xs text-neutral-10`
- Progress info: `text-xs text-neutral-10`

**Example:**
```jsx
<li className="border-b border-neutral-6 last:border-b-0">
  <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex gap-3 sm:gap-4">
        {video.info.thumbnail && (
          <img
            src={video.info.thumbnail}
            alt=""
            className="h-20 w-20 flex-shrink-0 rounded-sm object-cover border border-neutral-6"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link to={`/video/${video.info.id}`} className="font-medium text-neutral-11 hover:text-neutral-12 hover:underline">
            {video.info.title}
          </Link>
          <span className="text-xs text-neutral-10">({video.status})</span>
        </div>
      </div>
    </div>
    {/* Action buttons */}
  </div>
</li>
```

### Separators

Separators create visual hierarchy and separate distinct content areas.

**Horizontal Lines:**
- Between list items: `border-b border-neutral-6`
- Last item: `last:border-b-0` (removes bottom border)
- Main content divider: `divide-y divide-neutral-6`

**Usage Examples:**
```jsx
{/* Between list items */}
<li className="border-b border-neutral-6 last:border-b-0">

{/* Entire list with automatic dividers */}
<main className="divide-y divide-neutral-6 border-x border-neutral-6 sm:border-x">
  {items.map(item => <Item key={item.id} />)}
</main>

{/* Section divider */}
<div className="border-b border-neutral-6 pb-4">Content</div>
```

### Buttons

Buttons have consistent styling across the application with smooth transitions for interactive states.

**Base Button Styles:**
- Border: `border border-neutral-6`
- Background: `bg-neutral-2`
- Text: `text-sm text-neutral-11`
- Padding: `px-3 py-1.5` (mobile), `sm:px-4 sm:py-2` (desktop)
- Transition: `transition-all`

**Interactive States:**
- Hover: `hover:border-neutral-7 hover:bg-neutral-3`
- Active: `active:bg-neutral-4`

**Button Variations:**

**Standard Button:**
```jsx
<button className="border border-neutral-6 bg-neutral-2 px-3 py-1.5 text-sm text-neutral-11 transition-all hover:border-neutral-7 hover:bg-neutral-3 active:bg-neutral-4 sm:px-4 sm:py-2 sm:text-sm">
  Button Text
</button>
```

**Icon Button (Square):**
```jsx
<button className="flex items-center justify-center border border-neutral-6 bg-neutral-2 p-2 text-neutral-11 transition-all hover:border-neutral-7 hover:bg-neutral-3 active:bg-neutral-4 sm:p-2.5">
  <span className="sr-only">Add video</span>
  <Add01Icon strokeWidth={2.5} size={16} />
</button>
```

**Icon Button Attributes:**
- Flex center for icon alignment: `flex items-center justify-center`
- Square padding: `p-2` (mobile), `sm:p-2.5` (desktop)
- Screen reader text for accessibility: `sr-only`

### Loading State

A full-page loading state for suspended content:

```jsx
<div className="flex min-h-screen items-center justify-center bg-neutral-1 text-neutral-11">
  Loading...
</div>
```

- Centered: `flex items-center justify-center`
- Full viewport: `min-h-screen`
- Neutral styling: `bg-neutral-1 text-neutral-11`

### Empty State

Displayed when no videos exist in the list:

```jsx
<div className="border-x border-neutral-6 px-6 py-12 text-center text-neutral-10">
  <p className="mb-2">No videos yet</p>
  <p className="text-sm">Add a video to get started</p>
</div>
```

- Centered text: `text-center`
- Generous padding: `px-6 py-12`
- Secondary text color: `text-neutral-10`
- Heading: Default size, `mb-2` for spacing
- Subtext: `text-sm` for smaller size

### Video Player Container

A dark container for video content:

```jsx
<div className="bg-neutral-2">
  <video src={videoSrc} controls className="w-full" />
</div>
```

- Background: `bg-neutral-2` (slightly darker than page background)
- Full width: `w-full`
- Native controls: `controls`

## Iconography

VideoSlug uses the **hugeicons-react** library for consistent, high-quality icons throughout the application.

### Currently Used Icons

- `Add01Icon`: Used for the "Add video" action button in the header
  - Size: `16`
  - Stroke width: `2.5` (slightly thicker for better visibility)

### Icon Button Pattern

When creating icon buttons, follow this pattern:

```jsx
<button className="flex items-center justify-center border border-neutral-6 bg-neutral-2 p-2 text-neutral-11 transition-all hover:border-neutral-7 hover:bg-neutral-3 active:bg-neutral-4">
  <span className="sr-only">Button description</span>
  <IconName strokeWidth={2.5} size={16} />
</button>
```

**Best Practices:**
- Always include `sr-only` text for accessibility
- Use `strokeWidth={2.5}` for better visibility at small sizes
- Maintain consistent sizing across icon buttons
- Use standard button classes for consistent interactive states

### Adding New Icons

1. Import the icon from `hugeicons-react`
2. Apply consistent styling with existing icon buttons
3. Include accessible `sr-only` text
4. Use appropriate size and stroke width for the context

## Responsive Design

### Breakpoints

VideoSlug uses a single breakpoint:

- **Mobile**: Default styles (up to 639px)
- **Small+ (sm)**: 640px and above

### Responsive Patterns

**1. Horizontal to Vertical Layout:**
```jsx
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
  {/* Stack vertically on mobile, horizontally on small+ */}
</div>
```

**2. Responsive Padding:**
```jsx
<div className="px-4 py-4 sm:px-6 sm:py-5">
  {/* Smaller padding on mobile, larger on small+ */}
</div>
```

**3. Responsive Typography:**
```jsx
<h1 className="text-lg sm:text-xl">
  {/* Smaller text on mobile, larger on small+ */}
</h1>
```

**4. Responsive Gaps:**
```jsx
<div className="gap-2 sm:gap-3">
  {/* Tighter spacing on mobile, more generous on small+ */}
</div>
```

## Accessibility

### Color Contrast

All text and interactive elements maintain WCAG AA compliant contrast ratios using the neutral color palette.

### Keyboard Navigation

All interactive elements are keyboard accessible with visible focus states (handled by default browser styles).

### Screen Reader Support

- Icon buttons include `sr-only` text describing the action
- Semantic HTML elements are used (header, main, nav)
- Links have descriptive text rather than generic "click here"

### ARIA Labels

Use `aria-label` or `sr-only` text for icon-only buttons to provide context for screen reader users.

## Best Practices

### When Extending the Design System

1. **Use existing color palette**: Prefer neutral colors over custom values
2. **Follow mobile-first**: Start with mobile styles, add responsive modifiers
3. **Maintain consistency**: Use existing spacing scales and border styles
4. **Test dark mode**: Verify colors work in both light and dark mode
5. **Keep it minimal**: Avoid unnecessary decorative elements
6. **Prioritize content**: Ensure videos and actions remain the focus

### Common Patterns

**Card Container:**
```jsx
<div className="border-x border-neutral-6 bg-neutral-2">
  {/* Card content */}
</div>
```

**Flex Button Group:**
```jsx
<div className="flex shrink-0 gap-2">
  <Button />
  <Button />
</div>
```

**Text Hierarchy:**
```jsx
<h2 className="text-xl font-medium text-neutral-12">Heading</h2>
<p className="text-neutral-11">Primary text</p>
<p className="text-sm text-neutral-10">Secondary text</p>
```

## Implementation Notes

### Tailwind Configuration

The color system is configured in `src/styles/global.css` using CSS custom properties that map to Tailwind's color system. The theme removes all default Tailwind colors and replaces them with custom neutral and accent scales.

### Color Mode Support

Colors automatically adapt to the user's system preference (light or dark mode) using `@media (prefers-color-scheme)`. No class-based theme switching is currently implemented.

### P3 Color Support

The color system includes P3 color space definitions for displays that support wider color gamuts, ensuring vibrant and accurate colors on supported devices.

---

**Last Updated**: January 2026
**Version**: 1.0

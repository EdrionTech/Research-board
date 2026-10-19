Skyglass is a bright, optimistic interface style: frosted glass floating over a clear blue sky, glossy bubble buttons, aqua water and fresh green. It suits media players, launchers, community sites and playful desktop-style apps that want to feel clean, futuristic and a little nostalgic.

## Principles

- **Real glass over a real sky.** Glass is mostly clear: a light tint (`glass`), a strong backdrop blur (`blur-glass`, saturation boosted), a diagonal light sheen (`glass-sheen` → `glass-sheen-end`), a curved reflection across the top-left, a bright rim on the lit top and left edges (`glass-edge`), a dim rim on the shaded edges (`glass-edge-low`) and light caught in the bottom edge (`glass-glow`). Glass only reads as glass when something sits behind it, so the page background always carries the sky gradient with `cloud`s, `bubble`s and the `aurora` streak.
- **Everything shines.** Buttons, orbs and tiles are glossy: a gradient from `*-light` to `*-deep`, with a white shine (`gloss-top` → `gloss-fade`) across their upper half and `gloss-depth` shading underneath.
- **Round and soft.** Pills (`radius-pill`), bubbles (`radius-round`) and generous corners (`radius-lg`). No sharp corners and no hard shadows: `shadow-glass` and `shadow-gloss` are soft and blue-tinted.
- **Light and airy.** Leave space. Use `space-6` between panels. One strong colour action per view; the rest is glass.

## Voice

- Warm, upbeat and simple: "Good morning", "Recommended for today", "What do you want to play?"
- Sentence case everywhere except small overlines (`overline` style: "SHOW ALL", column headers).
- Short labels on buttons, verb first: "Accept", "Follow", "Download", "Create playlist".
- No emoji in UI text; use the icon set.

## Colour

- Text is `ink` on any glass or on the sky. `ink-muted` only on `glass-strong` (or glass over the lower, lighter sky); on plain glass over the dark top of the sky it is too faint.
- Gloss tones have jobs:
  - `blue`: primary action and the main play orb.
  - `green`: accept, go, success.
  - `aqua`: selection, slider fills, app tiles, secondary positive.
  - `red`: decline, delete, close-on-hover only.
  - `orange`: download, warnings, attention badges. Its text is `on-orange` (dark).
- Labels on blue, green, aqua and red gloss are `on-color` (white) with a 1px soft text shadow. Contrast is checked against each tone's mid colour, where the label sits.
- **Deep sea** theme: the sky becomes deep ocean (`sky-*`), glass darkens and the ink turns pale. Gloss colours stay the same, like lights underwater.
- Focus is a solid 3px `focus` ring, offset 2px, on every control.

## Type

- One humanist sans: **Source Sans 3** (`--font-sans`, Google Fonts). Clean and friendly, close in spirit to the airport-sign typefaces of the era.
- `display` (light 300) for greetings and big headlines. `title` and `heading` (semibold) for pages and panels.
- `body` for text, `item` (semibold) for list and card titles, `meta` for artists, dates and hints, `overline` for uppercase column headers.

## Layout

- Pad windows and panels with `space-4`; separate panels with `space-6`; gutters `space-5`.
- A typical app is a Window with a glass sidebar, panels of cards in the middle and a MediaBar docked at the bottom.
- Lists are glass tables (TrackList) with right-aligned tabular numbers.

## States

- Hover: gloss brightens slightly. List rows gain `glass-strong` and a rim.
- Pressed: gloss darkens and the shine drops inside.
- Selected: aqua gloss (chips) or the `selection` fill (rows).
- Disabled: desaturated and half transparent.

## Imagery

- Skies, clouds, water, bubbles, green fields, lens flares, glossy fruit and gentle aurora light.
- Bubbles and soft light can sit behind content; never put photos behind small text without a `glass-strong` panel.

## Iconography

- Glyphs are chunky and rounded, never thin: 2.6px strokes with round ends, solid shapes wherever the object allows (home, heart, mail, user, play, gear). 25 glyphs: arrows, close, minimize, maximize, check, plus, play, pause, next, prev, shuffle, repeat, search, home, heart, mail, user, music, settings, sun, download, volume, more, image.
- Glyphs are embossed: ink glyphs on glass get a 1px light lip (`icon-emboss`). White glyphs on gloss get a soft dark shadow.
- An icon that stands on its own (sidebar, menu, app icon, notification) sits in a glossy **IconBadge**, never bare. Keep each icon in the same tone everywhere: home and user in blue; search, music and volume in aqua; heart and close in red; mail, sun and download in orange; settings and more in glass.
- Assets › Icons are the glossy badges as SVG (for app icons and images). Assets › Glyphs are the bare glyphs for inline use. In code use `Icon` and `IconBadge`, which draw in `currentColor`.
- No logo yet: set the name in `display` type.

## Screens and accessibility

- **Phones (< 600px, `bp-compact`):** page padding drops to `space-3`; `display` steps down to 32/40 and `title` to 24/30; panels and windows pad `space-3`; large buttons shrink to 48px. Lay panels out with `.sg-grid` (auto-fill columns, minimum 240px), which collapses to one column on its own.
- **Tablets and desktops:** above `bp-wide` (900px) a glass sidebar fits beside the content.
- **Components that adapt to their own width:** MediaBar stacks below 700px and hides the volume slider; below 380px it hides shuffle and repeat. TrackList tightens below 360px. Long titles truncate with an ellipsis instead of wrapping or overflowing.
- **Touch:** on touch screens every control grows to at least `target-min` (44px). With a mouse the floor is `target-min-pointer` (32px).
- **Text size:** inputs use 16px text so phones don't zoom in on focus. Layouts reflow at 200% zoom with no sideways scrolling.
- **Reduced transparency:** when the viewer asks for it, or the browser can't blur, glass becomes `glass-solid`, an opaque version with the same rims.
- **High contrast (forced colours):** shine and reflections switch off and every control gets a plain system border.
- **Screen readers:** orbs and icon-only buttons always carry a `label`; TrackList is a table with cells and marks the playing row selected; decorative icons are hidden from assistive tech.
- **Contrast:** `ink` holds at least 4.5:1 on glass anywhere on the sky in both themes. Gloss labels hold 4.5:1 against each tone's mid colour.

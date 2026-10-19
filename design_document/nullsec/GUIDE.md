Nullsec is a cyberpunk heads-up display: neon line frames with clipped corners floating over a dark dot-grid screen, hazard stripes, tick rulers, lock-on brackets and terse system readouts. It suits games, dashboards, hacker tools and anything that should feel like an operator's console.

## Principles

- **Lines, not boxes.** Panels are drawn as 1px neon outlines (`border-hud`) with chamfered corners (`cut-lg`) and heavy brackets on the square corners. Fill stays dark (`surface`); the line carries the colour.
- **Cut, never round.** `radius-none` everywhere. Shape comes from 45° chamfers: `cut-sm` on buttons and inputs, `cut-md` on large buttons, `cut-lg` on frames.
- **Glow is light, not decoration.** Lit things glow (`glow-size`, `*-glow`): frames, lit meter segments, readouts. Text itself stays crisp.
- **Machine detail, used sparingly.** Tick rules, mono codes ("// 0317"), hazard stripes and dot grids give the HUD texture. One stripe band per frame at most; stripes always mean caution.

## Voice

- Terse system speak, present tense, no filler: "System online", "Access denied", "Scan complete", "Reroute power to the east grid."
- UPPERCASE for labels, tabs, buttons and tags (the components do it). Sentence case for messages and body text.
- Codes and numbers in mono: `ASTRAX_0317`, `250 km/h`, `002/220 errors`.
- No emoji; use the glyph set.

## Colour

- **Night** (default): near-black screen `bg` with `bg-grid`, `bg-dot` and a `vignette`; panels in `surface`; text `ink` / `ink-muted`.
- **Paper**: the same system printed light — lavender-grey screen, dark ink, deeper red and teal. Use it for docs, print and bright rooms.
- Colour jobs:
  - `red`: the primary neon. The lead frame, the one solid primary button, the active menu item, health and threats.
  - `cyan`: data and positive state: readouts, energy, checked, unlocked, online, accept.
  - `amber`: warnings and hazards only.
  - `ink` (neutral tone): quiet frames and secondary controls.
- Text on solid red, cyan or amber uses `on-red` / `on-cyan` / `on-amber`. Tinted fills (`*-dim`) take `*-ink` text.
- Focus is a solid 2px `focus` ring (yellow at night, blue on paper), offset 3px. It is deliberately neither red nor cyan, so it can't be mistaken for a state.

## Type

- **Tektur** (`--font-display`): an angular face with clipped corners and 45° cuts, like the frames themselves. Use it for `display`, `title`, `heading`, `label`, buttons, tabs, tags and readout numbers. Always uppercase except headings.
- **Rajdhani** (`--font-sans`): a narrow technical sans for reading, at 500 weight or heavier: `body` (17/26) and `small` (15/22). Never set it lighter than 500; it gets thin.
- **Share Tech Mono** (`--font-mono`): `data` for codes, values, timestamps and typed input.
- All three ship as font files with the system (under the SIL Open Font License), so they render the same everywhere.
- `.nx-glitch` adds a red/cyan offset to one display line per screen. Never on body text.

## Layout

- Frames sit `space-5` apart on the dot grid. Inside, pad `space-4` top and bottom and `space-5` at the sides.
- Lay frames out with `.nx-grid` (auto-fill, minimum 260px), which collapses to one column on phones.
- One lead frame (red) per screen; supporting frames are cyan or neutral.

## States

- Hover: outline controls fill with their `*-dim` tint; solid buttons gain diagonal `hover-stripe`s; menu items slide 4px right.
- Pressed: down 1px.
- Selected: solid red with a clipped corner (menus).
- Disabled: 45% opacity, or a lock glyph for locked content.
- Locked-on: Target brackets blink (off with reduced motion).

## Imagery

- Wireframe geometry (cubes, globes, pyramids), scan-line portraits, data plates, barcodes, radar sweeps and hazard markings.
- Keep imagery monochrome or two-tone (red, cyan) on the dark screen.

## Iconography

- 31 angular glyphs on a 24px grid: 2px strokes, square caps, mitred 45° joins; play, pause and stop are solid. Set: close, check, plus, minus, arrows, chevrons, menu, warning, lock, unlock, search, settings, user, power, signal, target, globe, cube, chip, battery, mail, heart, eye, terminal, download, play, pause, stop.
- In code use `Icon` (draws in `currentColor`). Assets › Icons are self-contained neon HUD chips for app icons and images; Assets › Glyphs are the bare red glyphs.
- No logo yet: set the name in `display` type.

## Screens and accessibility

- **Phones (< `bp-compact`, 600px):** page padding `space-3`; `display` steps to 36/40, `title` to 24/28; frames use `cut-md` and tighter padding; readouts shrink.
- **Wide screens (> `bp-wide`, 960px):** a side HUD column (menu, meters) fits beside the main frame.
- Long labels truncate with an ellipsis; nothing scrolls sideways at 320px or at 200% zoom.
- **Touch:** every control is at least `target-min` (44px) on touch screens; `target-min-pointer` (32px) with a mouse.
- **Reduced motion:** blinking brackets and menu slides switch off.
- **More contrast:** muted text becomes full ink, hairlines become `line-strong`, glow switches off.
- **High contrast (forced colours):** chamfers and glow drop away; controls get plain system borders.
- **Screen readers:** icon buttons always carry a `label`; meters are real meters with values; menus mark the current item; decorative brackets and rules are hidden.
- **Contrast:** text pairs hold 4.5:1 in both themes, including red text on the dark screen and labels on solid red, cyan and amber.

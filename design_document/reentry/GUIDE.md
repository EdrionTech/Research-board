Reentry is a 90s-anime cockpit interface: machined gunmetal plates held on with screws, amber CRT screens behind heavy bezels, analog gauges, chunky keycaps drawn like animation cels (flat colour, a hard shadow, a dark ink outline), hazard-yellow warning stripes, and episode-card titles in wide red capitals. It suits mission and game HUDs, mech and space games, dashboards for anything that launches or lands, and launch pages that want a little drama.

## Principles

- **Drawn, not rendered.** Everything is cel-shaded: flat colour faces, a lit band on top (`*-hi`), a hard unblurred shadow band at the bottom (`*-lo`, `shadow-cel`) and a dark `outline` around every plate, key, well and screen, like ink on an animation cel. No soft drop shadows, no glossy gradients.
- **Hardware you could touch.** Plates have screws (`screw`, `screw-hi`) and a grooved title rule; wells, rails and slots are recessed (`recess`) with a shadow inside; keys press down 3px; switches have levers; sliders have a ridged grip.
- **Screens glow, the rest doesn't.** Only CRT screens, lamps, needles and lit values glow (`phosphor`, `phosphor-glow`). Screens stay dark amber in both themes — they're screens.
- **Colour means a job.** Amber is the action and the light; red is danger; hazard yellow is caution; blue is comms and secondary; white is mech armour; green is "nominal". Never use red or yellow as decoration.
- **Machined corners.** `radius-sm` (4px) for keys and wells, `radius-md` (8px) for plates. The only soft corners are CRT glass (`radius-screen`) and round things: lamps, screws, gauges (`radius-round`).

## Voice

- Terse, procedural, calm under pressure, like radio chatter: "Pod sealed. Heat shield nominal. Hold on." "Burn in 00:14." "Use a sector code like 7G."
- Keycaps, tabs, labels and titles are uppercase stencils; sentences and descriptions are sentence case.
- Numbers come with units and fixed formats: "7.42 KM/S", "1 640 °C", "T+00:14", "SEC 7G".
- No emoji; use the stencil glyphs.

## Colour

- **Cockpit** (default): a dark `hull` with faint panel `seam`s and `rivet`s; plates run `plate-hi` → `plate` → `plate-lo`; text `ink`, labels `ink-muted`.
- **Hangar**: the same hardware under daylight — a pale hangar floor, white enamel plates, dark ink. Keycaps, screens, lamps, hazard stripes and the outline stay the same in both.
- Keycap tones, each with `-hi`, face, `-lo` and `on-`:
  - `amber`: the main action (Engage, Launch), the lit tab, slider fill, the switch when on.
  - `red`: abort, eject, delete, errors (`red-ink` for error text).
  - `blue`: secondary actions, navigation, comms.
  - `white`: neutral actions; mech armour.
  - `steel`: bare metal — tab keys, levers, grips, quiet buttons.
  - `green`: go, systems nominal.
- `hazard` yellow with `hazard-ink` stripes: caution banners and plates that hold dangerous controls.
- Lamps (`lamp-green`, `-amber`, `-red`, `-blue`, `lamp-off`) always have a label beside them, so colour is never the only signal.
- Focus is a 3px cyan ring (`focus`), so it never reads as an amber or red signal.

## Type

- **Russo One** (`--font-display`): heavy, squared capitals for `display`, `title` and `plate-title` — mission names, page and plate titles, the red TitleCard. Uppercase, slightly spaced.
- **Barlow** (`--font-sans`): a clear, industrial grotesque for reading — `heading`, `body`, `small`.
- **Barlow Condensed** (`--font-cond`): stencil-style `label` and `button` text, uppercase and spaced.
- **Share Tech Mono** (`--font-mono`): everything on a screen — `screen`, `readout`, `code`.
- All four ship as font files (SIL Open Font License, see `licenses/`).

## Layout

- Pad plates `space-5`; separate them by `space-5` in a `.re-grid` (auto-fill, minimum 280px), which collapses to one column on phones.
- Group controls the way a console does: a Screen on top, gauges or meters under it, keys at the bottom.
- One amber key, one TitleCard and one `stripe` plate per screen.

## States

- Hover: keys brighten slightly; tab labels go full ink.
- Pressed: keys drop 3px and lose their shadow; the selected tab stays pressed with its lamp lit.
- Selected / on: amber lamp strip (tabs), amber lever and green lamp (switches).
- Warning: values past a redline turn red phosphor; meters below their warn level turn red and say "low".
- Disabled: hatched stripes, a dashed outline and muted text.

## Imagery

- Re-entry, orbit, clouds from above, hangars, pilots, launch pads — drawn cel-style: flat colour layers, hard shadows, ink outlines, a few speed lines.
- Assets › Placeholders has default covers, thumbnails and avatars in both themes.

## Iconography

- 28 stencil glyphs on a 24px grid: 2px strokes with square ends and mitred corners, 45° chamfers instead of curves where a corner turns, small solid fills for warning details: reticle, altitude, speed, thrust, fuel, shield, heat, radar, signal, pod, parachute, horizon, satellite, helmet, power, lock, eject, warning, info, check, close, plus, menu, settings, arrows, chevron and play.
- In code use `Icon`. Assets › Decals are ready-made 64px riveted plates with the glyph lit amber (app icons, badges); Assets › Stencils are the glyphs in hazard yellow on small gunmetal squares.
- No logo yet: set the name in `display` type.

## Screens and accessibility

- **Phones (< `bp-compact`, 600px):** page padding `space-4`; plates tighten; TitleCards step down to 32/36; large keys drop to 48px. Tab rails scroll sideways inside themselves; the page never does.
- **Touch:** every control is at least `target-min` (44px) on touch screens.
- **Keyboard:** every control shows the `focus` ring; Tabs move with the arrow keys, Home and End.
- **Reduced motion:** blinking cursors, alert icons and lamps hold steady; key and lever movement stops animating.
- **More contrast:** muted text becomes full ink; scanlines and glows switch off.
- **High contrast (forced colours):** stripes and scanlines drop away and controls get plain system borders.
- **Screen readers:** gauges and meters are real meters with formatted values and units; switches are real switches; lamps say their state; hazards can announce themselves; decorative screws, stripes and lamps are hidden.
- **Contrast:** text holds 4.5:1 in both themes — `ink` and `ink-muted` on plates, hull and wells, every `on-*` on its keycap, `phosphor` and `phosphor-dim` on the CRT, `title-red` on the letterbox.

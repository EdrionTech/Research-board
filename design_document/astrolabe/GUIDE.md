Astrolabe is a celestial interface style: an old star atlas meets a modern observatory console. Hairline panels drift over a living starfield, crosshairs and coordinate ticks frame the content, buttons wear orbit rings, and the accent colours come from real stars — blue giants, our own gold Sun, red dwarfs. It suits astronomy and space apps, science dashboards, games set among the stars and anything that should feel quiet, precise and vast.

## Principles

- **Space first.** The page is the sky: `space` scattered with stars of different sizes, brightness and colour: bright white (`star-1`), faint blue-white (`star-2`), warm gold (`star-3`), rare red giants (`star-4`) and teal (`star-5`). They sit on three tile sizes so the pattern never visibly repeats. The same field shows faintly through panels, the tab track, orbit buttons and the moon toggle (`--as-stars`, and `--as-stars-mini` for small controls). There are also faint `nebula-a` / `nebula-b` glows and concentric `orbit-line` rings. Leave plenty of it showing; panels float, they don't tile edge to edge.
- **Instruments, drawn in hairlines.** Structure is 1px `line` and `line-strong`: panel borders, crosshair corners, a ruler of tick marks under every panel header, constellation lines. No heavy borders, no hard shadows besides `shadow-panel`.
- **Everything is a body in orbit.** Buttons and the selected tab are lit planets (`*-body-hi` → `*-body` → `*-body-lo`), secondary buttons and knobs are dark spheres, and hover draws an orbit ring around them. Round things are celestial bodies: `radius-round` for orbit buttons, stars and planets; `radius-pill` for controls; `radius-lg` for panels. Tilted rings with a small moon mark the one hero action.
- **Light means importance.** Only lit things glow (`*-glow`): the current step, the selected tab, the hero button, a key readout.

## Voice

- Calm, precise and a little poetic: "Clear skies after 21:00. Saturn rises in the east." "Beyond the veil."
- Sentence case for buttons and headings; UPPERCASE only for small `label`s.
- Real data in mono: coordinates "RA 05h 35m · Dec −05° 23′", catalogue ids "M42", classes "G2V". Use proper minus signs (−) and degree/arcminute marks.
- No emoji; use the glyphs.

## Colour

- **Deep sky** (default): near-black space, starlight `ink`, panels in see-through `surface`.
- **Atlas**: the same chart printed on warm paper — navy ink, printed star dots, deeper accent colours. Good for print, docs and bright rooms.
- Star tones (the colour jobs):
  - `star` (blue-giant blue): primary action, selection, slider fills, links.
  - `sun` (gold): the current step, warm secondary actions, highlights, the full moon.
  - `aurora` (teal): success, confirm, online.
  - `nova` (red-dwarf red): danger, errors, abort. Error text is `nova-ink`.
  - `nebula` (violet): discovery and rare content, used sparingly.
- Spectral class colours (`spec-o` … `spec-m`) colour SpectralTag dots only, always next to the class letter.
- Text on solid tones uses `on-*` (dark at night, white on the atlas).
- Focus is a solid 2px `focus` ring (white at night, deep blue on the atlas), offset 3px.

## Type

- **Cormorant Garamond** (`--font-display`): the voice of the old atlases, for `display`, `title` and big `readout` numbers.
- **Manrope** (`--font-sans`): clean, open and very readable for the interface: `heading`, `body`, `small` and uppercase `label`s.
- **IBM Plex Mono** (`--font-mono`): `data` for coordinates, ids, times and spectral classes.
- All three ship as font files (SIL Open Font License, see `licenses/`).

## Layout

- Pad panels `space-5`; separate them by `space-5` in a `.as-grid` (auto-fill, minimum 280px), which collapses to one column on phones. Page gutter `space-6`.
- Put a mono `coords` line on panels that describe a real object; leave it off elsewhere.
- One featured object per screen gets a `halo` panel and the orbit button.

## States

- Hover: solid and secondary buttons grow an orbit ring (a gap the colour of the sky, then a 1px ring in their tone); ghost buttons underline; orbit rings start to turn.
- Pressed: down 1px. Selected: the tab becomes a lit blue planet with a small golden moon.
- Disabled: 45% opacity.
- Progress: done steps are lit stars on solid lines; the current step glows `sun`; future steps are hollow on dotted lines.

## Imagery

- Real astrophotography (nebulae, galaxies, planets), star charts, orbit diagrams and coordinate grids.
- Keep photos inside `radius-md` frames on panels, and never put small text straight over a bright nebula.

## Iconography

- 28 geometric glyphs on a 24px grid, built from true circles, ellipses and straight lines: 1.75px strokes, round ends, outlines only, with tiny solid moons, stars and nodes as the only fills. The planet's ring passes behind it; orbits are real ellipses: planet, star, stars, moon, sun, eclipse, comet, galaxy, orbit, constellation, telescope, rocket, satellite, astrolabe, compass, plus search, settings, menu, close, check, plus, arrows, chevron, play, pause, info and warning.
- In code use `Icon`; round icon buttons are `OrbitButton`. Assets › Orbs are ready-made planet icons for images and app icons; Assets › Glyphs are the bare starlight glyphs.
- No logo yet: set the name in `display` type.

## Screens and accessibility

- **Phones (< `bp-compact`, 600px):** gutters drop to `space-4`; `display` steps to 40/44, `title` to 28/34; readouts shrink; panels pad `space-4`. The Constellation stepper turns vertical in narrow containers.
- Coordinates and long labels truncate with an ellipsis; nothing scrolls sideways at 320px or at 200% zoom.
- **Touch:** every control is at least `target-min` (44px) on touch screens.
- **Keyboard:** tabs move with arrow keys, Home and End; MoonToggle is a real switch; everything shows the focus ring.
- **Reduced motion:** orbit rings stop turning and the moon slides without animation.
- **More contrast:** muted text becomes full ink and hairlines strengthen. **High contrast (forced colours):** rings, crosshairs and ticks drop away; controls get system borders.
- **Screen readers:** orbit buttons carry a `label`; the stepper announces done and current steps; decorative stars and rings are hidden.
- **Contrast:** text pairs hold 4.5:1 in both themes — `ink` and `ink-muted` on panels and wells, tone-coloured text on panels, and `on-*` on every solid tone.

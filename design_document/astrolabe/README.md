# Astrolabe — export

| File | Use it for |
|---|---|
| `demo.html` | Open in a browser: an observatory home page with a project cover, readouts, project cards, an observing plan and a profile, plus a Deep sky / Atlas switch. Needs internet for React only. |
| `tokens.css` | Fonts (`@font-face`), colours (including the `star-1` … `star-5` starfield), planet bodies, spacing, radii, shadows, tap size and type classes (`.display`, `.title`, `.readout`, `.heading`, `.body`…). Deep sky is the default; set `data-theme="atlas"` on `<html>` for Atlas. |
| `tokens.json` | The same tokens as data, for Tailwind, Figma, Unity/Godot UI themes, etc. |
| `components/astrolabe.js` + `.css` | React 18 components on `window.Astrolabe`: Panel, Button, OrbitButton, MoonToggle, Constellation, Tabs, SpectralTag, Readout, TextField, Slider, Icon. Load React 18 first. |
| `components/astrolabe.d.ts` | Props for every component. |
| `components/guidelines/` | When and how to use each component. |
| `images/placeholders/svg` · `png` · `png@2x` | Default images for anything that has no picture yet: `project-cover` (1600×900, room on the left for a title), `project-thumb` (800×800, crops cleanly to 4:3) and `avatar` (512×512, show in a circle). Each in `-deepsky` and `-atlas`. |
| `icons/orbs/svg` · `png/64·128·256` | Round icons on a dark planet disc with a gold orbit: app icons, launcher tiles, game sprites. |
| `icons/glyphs/svg-starlight` · `svg-ink` · `svg-star-blue` | The bare glyphs: starlight for Deep sky, ink for Atlas and print, star-blue for white pages. |
| `icons/glyphs/sky-tiles` | Each glyph on a small square of night sky, for use on any background. |
| `fonts/` + `licenses/` | Cormorant Garamond, Manrope and IBM Plex Mono (SIL Open Font License). Keep `fonts/` next to `tokens.css`. |
| `GUIDE.md` | The brand book: principles, voice, colour, type, layout, states, iconography, screens and accessibility. |

Notes
- Add `<meta name="viewport" content="width=device-width, initial-scale=1">` so phones get the responsive layout.
- `astrolabe.css` paints the starfield as a fixed layer behind `body`. Remove the `body::before` rule if you only want the components.
- The starfield is also available as CSS variables: `background-image: var(--as-stars); background-size: var(--as-stars-size);` for big areas, `var(--as-stars-mini)` for small controls.
- Orbit buttons and the hero orbit button draw their ring outside their edges; leave a little space around them.
- Placeholders are decoration: use `alt=""` on them unless the image itself means something.

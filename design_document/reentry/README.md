# Reentry — export

| File | Use it for |
|---|---|
| `demo.html` | Open in a browser: a mission console with a title card over the default cover, a CRT telemetry screen, gauges, controls, squad cards and a pilot profile, with a Cockpit / Hangar switch ("Hangar lights"). Needs internet for React only. |
| `tokens.css` | Fonts (`@font-face`), colours (hull, plates, CRT phosphor, keycap tones, hazard, lamps), spacing, radii, the hard cel shadow, tap size and type classes (`.display`, `.title`, `.plate-title`, `.heading`, `.body`, `.label`, `.button`, `.screen`, `.readout`, `.code`). Cockpit is default; set `data-theme="hangar"` on `<html>` for Hangar. |
| `tokens.json` | The same tokens as data, for Tailwind, Figma, Unity/Godot UI themes, etc. |
| `components/reentry.js` + `.css` | React 18 components on `window.Reentry`: Plate, Screen, Button, Switch, Gauge, SegmentBar, Tabs, TextField, Slider, Hazard, Lamp, TitleCard, Icon. Load React 18 first. |
| `components/reentry.d.ts` | Props for every component. |
| `components/guidelines/` | When and how to use each component. |
| `images/placeholders/svg` · `png` · `png@2x` | Default images: `project-cover` (1600×900, a pod burning through re-entry, space on the left for a title), `project-thumb` (800×800, crops cleanly to 4:3) and `avatar` (512×512, a pilot's helmet). Each in `-cockpit` and `-hangar`. |
| `icons/decals/svg` · `png/64·128·256` | Riveted gunmetal plates with the glyph lit amber: app icons, badges, game sprites. |
| `icons/stencils` | Each glyph in hazard yellow on a small gunmetal square, for any background. |
| `icons/glyphs/svg-light` · `svg-ink` · `svg-amber` · `svg-hazard` | The bare glyphs: light for Cockpit, ink for Hangar and print, amber for screens, hazard yellow for warnings. |
| `fonts/` + `licenses/` | Russo One, Barlow, Barlow Condensed and Share Tech Mono (SIL Open Font License). Keep `fonts/` next to `tokens.css`. |
| `GUIDE.md` | The brand book: principles, voice, colour jobs, type, layout, states, imagery, icons, screens and accessibility. |

Notes
- Add `<meta name="viewport" content="width=device-width, initial-scale=1">` so phones get the responsive layout.
- `reentry.css` paints the riveted hull as a fixed layer behind `body` (`body::before`). Remove that rule if you only want the components.
- Screens, keycaps, lamps, hazard stripes and the dark cel outline look the same in both themes; only the hull, plates, wells and text change.
- Keys sit 3px proud of the surface (their hard shadow); leave a little space under rows of buttons.

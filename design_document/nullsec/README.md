# Nullsec — export

| File | Use it for |
|---|---|
| `demo.html` | Open in a browser: a full HUD screen (side column on wide screens, one column on phones) with a Night / Paper switch. Needs internet for React and Google Fonts. |
| `tokens.css` | CSS variables for colours, glow, chamfer cuts, spacing, tap sizes and breakpoints, plus type classes (`.display`, `.title`, `.label`, `.body`, `.data`, `.readout`…). Night is default; set `data-theme="paper"` on `<html>` for Paper. |
| `tokens.json` | The same tokens as data, for Tailwind, Figma, Unity/Godot/Unreal UI themes, etc. |
| `components/nullsec.js` + `.css` | React 18 components on `window.Nullsec`: Frame, Button, IconButton, TextField, Checkbox, Meter, Readout, StatusTag, MenuList, Target, Divider, Icon. Load React 18 first. |
| `components/nullsec.d.ts` | Props for every component. |
| `components/guidelines/` | When and how to use each component. |
| `icons/chips/svg` · `png/64·128·256` | Self-contained neon HUD icon chips: app icons, game UI sprites, thumbnails. |
| `icons/glyphs/svg-red` · `svg-cyan` · `svg-white` · `svg-ink` | The bare angular glyphs in each neon colour, white for dark screens and ink for Paper. |
| `GUIDE.md` | The brand book: principles, voice, colour jobs, type, layout, states, imagery, icons, screens and accessibility. |

Fonts: Tektur, Rajdhani and Share Tech Mono are included in `fonts/` (SIL Open Font License, see `licenses/`) and load from `tokens.css` — no internet needed for them. Keep `fonts/` next to `tokens.css`.

Notes
- Add `<meta name="viewport" content="width=device-width, initial-scale=1">` to your pages so phones get the responsive layout.
- `nullsec.css` paints the dot-grid screen on `body`. Remove that rule if you only want the components.
- The PNG chips are smooth vector art: import them into game engines with normal (bilinear) filtering.

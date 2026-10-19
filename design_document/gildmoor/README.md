# Gildmoor — export

| File | Use it for |
|---|---|
| `demo.html` | Open in a browser: a title screen, character sheet, quest log and inventory, with a Midnight / Parchment switch. Needs internet for React only. |
| `tokens.css` | Fonts (`@font-face`), colours, gems, spacing, radii, shadows, tap size and type classes (`.display`, `.title`, `.heading`, `.body`, `.lore`…). Midnight is default; set `data-theme="parchment"` on `<html>` for Parchment. |
| `tokens.json` | The same tokens as data, for Tailwind, Figma, Unity/Godot/Unreal UI themes, etc. |
| `components/gildmoor.js` + `.css` | React 18 components on `window.Gildmoor`: Frame, Ribbon, Button, Medallion, ItemCard, RarityTag, Tabs, TextField, Checkbox, ProgressBar, Divider, Icon. Load React 18 first. |
| `components/gildmoor.d.ts` | Props for every component. |
| `components/guidelines/` | When and how to use each component. |
| `icons/medallions/svg` · `png/64·128·256` | Round gilded medallion icons: app icons, skill-tree nodes, inventory slots, game sprites. |
| `icons/glyphs/svg-gold` · `svg-dark-gold` · `svg-ink` · `svg-white` | The bare engraved glyphs: gold for Midnight, dark gold and ink for Parchment, white for photos. |
| `fonts/` + `licenses/` | Cinzel Decorative, Cinzel and Alegreya (SIL Open Font License). Keep `fonts/` next to `tokens.css`. |
| `GUIDE.md` | The brand book: principles, voice, gem jobs, type, layout, states, imagery, icons, screens and accessibility. |

Notes
- Add `<meta name="viewport" content="width=device-width, initial-scale=1">` so phones get the responsive layout.
- `gildmoor.css` paints the starry sky on `body`. Remove that rule if you only want the components.
- Buttons and medallions carry ornaments outside their edges (diamond caps and studs); leave a little space around them.

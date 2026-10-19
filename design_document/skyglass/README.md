# Skyglass — export

| File | Use it for |
|---|---|
| `demo.html` | Open in a browser: a full responsive app screen (sidebar on wide screens, single column on phones) with a Day sky / Deep sea switch. Needs internet for React and Google Fonts. |
| `tokens.css` | CSS variables for colours, glass, gloss, spacing, radii, blur, shadows, tap sizes and breakpoints, plus type classes (`.display`, `.title`, `.body`, `.meta`…). Day sky is default; set `data-theme="sea"` on `<html>` for Deep sea. |
| `tokens.json` | The same tokens as data, for Tailwind, Figma plugins, Flutter/Unity/Godot themes and so on. |
| `components/skyglass.js` + `.css` | Ready-made React 18 components on `window.Skyglass`: Window, GlassPanel, Button, OrbButton, TextField, Slider, MediaBar, TrackList, AppTile, Chip, Icon, IconBadge. Load React 18 first. |
| `components/skyglass.d.ts` | Props for every component. |
| `components/guidelines/` | When and how to use each component. |
| `icons/badges/svg` · `png/64·128·256` | Glossy icon badges: app icons, sidebar and menu icons, images. |
| `icons/glyphs/svg` · `svg-white` | Bare chunky glyphs in ink (for light glass) and white (for gloss or dark backgrounds), for inline use. |
| `GUIDE.md` | The brand book: principles, voice, colour jobs, type, layout, states, imagery, icons, screens and accessibility. |

Font (free on Google Fonts): Source Sans 3.

Notes
- Add `<meta name="viewport" content="width=device-width, initial-scale=1">` to your pages so phones use the responsive layout.
- `skyglass.css` paints the sky background (gradient, clouds, bubbles) on `body`. Glass needs something behind it to look like glass, so keep it, or put your own image behind the panels.
- Frosted blur uses `backdrop-filter`. Where it isn't supported, or when the user asks for reduced transparency, glass turns solid on its own.

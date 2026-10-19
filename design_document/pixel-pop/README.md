# Pixel Pop — export

| File | Use it for |
|---|---|
| `demo.html` | Open in a browser to see every component (needs internet for React + Google Fonts). |
| `tokens.css` | CSS variables for colours, spacing, borders, shadows and fonts, plus type-style classes (`.title`, `.body`, `.button`…). Light is default; set `data-theme="dark"` on `<html>` for Night. |
| `tokens.json` | The same tokens as data — for Figma plugins, Tailwind config, Unity/Godot scripts, etc. |
| `components/pixel-pop.js` + `.css` | Ready-made React 18 components on `window.PixelPop` (Window, Dialog, Button, TextField, Checkbox, ProgressBar, Slider, Badge, SpeechBubble, PixelIcon). Load React 18 first. |
| `components/pixel-pop.d.ts` | Component props, for reference. |
| `components/guidelines/` | When and how to use each component. |
| `icons/svg`, `icons/png/16·32·48` | The 16 pixel icons. PNGs are pre-scaled crisp for game engines; set filtering to "point / nearest". |
| `GUIDE.md` | The brand book: voice, colour roles, type, layout, states. |

Fonts (all free on Google Fonts): Pixelify Sans, Nunito, JetBrains Mono.

Note: `pixel-pop.css` styles `body` (grid desk background). Remove that rule if you only want the components.

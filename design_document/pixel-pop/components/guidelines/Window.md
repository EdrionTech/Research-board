# Window

Window is the basic container: a peach-cream sheet with a 2px outline and a coloured title strip.

- Provide `title` (sentence case, like a filename: "Your music"), `children` for the body, optional `footer`, `icon`, `controls` (default minimize, maximize, close) and `onControl`.
- `tone` picks the title strip: `teal` is the default; `orange` for anything that needs attention; `lavender`, `pink`, `green`, `yellow` to tell several windows apart.
- `striped` gives the classic ruled title bar for a calmer, document feel.
- Windows sit flat on the desk — no shadow. Only a Dialog floats (`shadow-pixel`).
- Don't nest windows; put a second window beside the first, `space-6` apart.

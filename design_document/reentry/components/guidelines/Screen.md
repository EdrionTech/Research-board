# Screen

Screen is an amber CRT monitor set into a bezel: glowing mono text, scanlines, a dark vignette at the edges. Screens stay dark in both themes.

- Provide `children` (lines of text; wrap secondary lines in `.re-dim`, warnings in `.re-hot`), optional `title` and `status` (the header line), `alert` (switches the whole screen to red phosphor), `cursor` (a blinking block) and `live` (announces changes to screen readers).

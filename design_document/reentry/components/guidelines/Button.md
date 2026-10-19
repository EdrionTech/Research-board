# Button

Button is a cel-shaded keycap: a flat colour face, a lit band on top, a hard shadow band at the bottom and a dark ink outline. It presses down 3px when clicked.

- Provide a short uppercase-style label (`children`: "Engage", "Abort"), optional `icon`, `tone`, `variant` and `size`.
- `tone`: `amber` the main action (one per view), `red` abort, eject or delete, `blue` secondary and navigation, `white` neutral on dark hulls, `steel` quiet, `green` go.
- `variant="ghost"` is a text-only link in the tone's ink colour. Disabled keys turn into a hatched, dashed outline.
- Every label is 4.5:1 or better on its keycap. Minimum height 44px (`sm` 36px, but 44px on touch screens).

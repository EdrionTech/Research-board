# Button

Button is a chunky pixel key: notched corners, a candy face, a darker 4px bottom lip and an uppercase label in a deep shade of the same colour.

- Provide a short uppercase-feeling verb as `children` ("PLAY", "CONTINUE") — the label is uppercased for you. Or give only an `icon` for a square key (always add `aria-label`).
- `tone` names the role, not decoration: `green` go / confirm, `lavender` navigate (Back, Menu), `orange` change settings or restart, `pink` store and extras, `teal` neutral-positive, `cream` (default) everything else, `danger` destroys.
- Pair a wide labelled button with a square icon key of the same tone for menus.
- `size`: `sm` in toolbars and dialogs, `md` default, `lg` on title and pause screens.
- Pressed state drops by one pixel and the lip shrinks; never animate it smoothly.

# Dialog

Dialog is a small Window that floats above the desk with a hard `shadow-pixel` to ask or tell one thing.

- Provide the message as `children` (one or two short sentences), `kind` (`info` teal, `warning` yellow, `error` orange, `success` green), `actions` (one to two Buttons) and `onClose`.
- The icon and the title word always carry the meaning, so colour is never the only signal.
- Put the safe action last and in `green`; a destructive one uses `danger`.
- One dialog at a time.

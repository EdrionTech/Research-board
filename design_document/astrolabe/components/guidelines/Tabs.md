# Tabs

Tabs sit in a dark segmented track; the selected tab is a lit blue planet with a small golden moon, the same body as the primary button.

- Provide `tabs` (strings, or `{label, icon}`), `value`/`defaultValue`, `onChange`, `label`, and `children` (or a function of the active index).
- Arrow keys, Home and End move between tabs. On narrow screens the track scrolls sideways inside itself; the page never does.
- Inactive labels are `ink-muted` (4.5:1 or better), the active label is white on the star body.

# MenuList

MenuList is a stack of numbered menu commands — the pause menu, a side nav, a list of options.

- Provide `items` (`{label, disabled}`), `active` index, `onSelect`, `label` for the nav.
- Indexes count up as 001, 002…; the active item is solid red with a clipped corner; locked items show a lock and can't be picked.

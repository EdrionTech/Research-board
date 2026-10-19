Gildmoor is a dark-fantasy interface: gilded frames with diamond corners on deep midnight enamel, jewel-toned buttons, round medallions and storybook type under a starry sky. It suits RPG menus, inventories, skill trees, card games and anything that should feel like an enchanted book.

## Principles

- **Gold draws the line.** Structure is drawn in fine `gold` lines: a frame is a gold border with an inner `gold-deep` hairline (the "double frame"), diamond corners and a diamond finial at the top centre. Never thick borders.
- **Jewels carry meaning.** Fills are gems — `sapphire`, `emerald`, `ruby`, `amethyst` — each a gradient from `*-light` (a glow at the top) through the gem to `*-deep`. Gold text (`on-gem`) sits on them.
- **Square, ornamented corners.** `radius-none` for frames, buttons and cards; the decoration is diamonds, not rounding. Curves only for arched frames (`radius-arch`) and medallions (`radius-round`).
- **Light glows softly.** `gold-glow` halos around frames, medallions and hovered buttons. No hard drop shadows besides `shadow-panel`.

## Voice

- Storybook and in-world: "Continue", "Enter thy name", "Find the lost bell of Varrow before the third moonrise."
- Titles and buttons in title case through the capitals typefaces. Lore and descriptions in italic `lore`.
- Numbers stay plain and clear: "240 / 300", "120 gold".
- No emoji; use the engraved glyphs.

## Colour

- **Midnight** (default): a night sky `bg` with `star`s and soft `bg-glow`s; frames in `surface-top` → `surface-bottom`; text `ink`, headings `title` (pale gold), labels `label`.
- **Parchment**: the same system printed in a spellbook — warm paper, brown ink, burgundy titles, darker gold lines. Gems and gem text stay the same.
- Gem jobs:
  - `sapphire`: primary (Continue), information.
  - `emerald`: go and accept (Play, Equip), healing, stamina.
  - `ruby`: danger and restart, health, the active tab.
  - `amethyst`: magic, mana, epic things.
  - `night`: the enamel of medallions.
- Rarity colours (`rarity-common`, `-rare`, `-epic`, `-legendary`) always come with the word.
- Focus is a solid 2px `focus` ring (pale cyan by night, deep blue on parchment), never gold, so it can't be mistaken for decoration.

## Type

- **Cinzel Decorative** (`--font-display`): flourished capitals for `display` and `title` — title screens, chapter and page titles.
- **Cinzel** (`--font-caps`): carved Roman capitals for `heading`, `button`, `label`, ribbons and tabs.
- **Alegreya** (`--font-serif`): a sturdy book serif for reading — `body` (18/28), `small`, and `lore` in italic.
- All three ship as font files (SIL Open Font License, see `licenses/`), so they look the same everywhere.

## Layout

- Pad frames `space-6` top, `space-5` sides; separate frames by `space-6`. Centre titles in frames.
- Lay frames and cards out with `.gm-grid` (auto-fill, minimum 260px), which collapses to one column on phones.
- Leave room around ornaments: buttons carry diamond caps outside their edges, frames carry corners and finials.

## States

- Hover: gold borders brighten and a soft `gold-glow` appears.
- Pressed: the gem darkens inward.
- Selected: ruby plate with a gold finial (tabs); a filled diamond (checkbox).
- Disabled: desaturated gem; sealed items show a lock.

## Imagery

- Night skies, nebulae, stars, crystals, potions, crowns, old maps and books. Objects glow softly from within.
- Show items centred in an ItemCard or Medallion, on the gem tint, never on a busy background.

## Iconography

- 28 engraved glyphs on a 24px grid, 1.6px strokes with round ends: sword, shield, potion, crown, helm, scroll, book, gem, key, coin, heart, star, moon, sun, map, chest, quill, flame, eye, lock, settings, menu, close, check, plus, arrows and chevron.
- In code use `Icon`; a standalone icon goes in a `Medallion`. Assets › Medallions are ready-made round icons for images and app icons; Assets › Glyphs are the bare gold glyphs.
- No logo yet: set the name in `display` type.

## Screens and accessibility

- **Phones (< `bp-compact`, 600px):** page padding `space-4`; `display` steps to 36/42 and `title` to 26/32; frames tighten; large buttons drop to 48px; item cards go full width.
- Long labels truncate with an ellipsis; nothing scrolls sideways at 320px or at 200% zoom.
- **Touch:** every control is at least `target-min` (44px) on touch screens.
- **Keyboard:** Tabs move with the arrow keys, Home and End; every control shows the `focus` ring.
- **Reduced motion:** glow transitions switch off. **More contrast:** muted text becomes full ink, glows switch off. **High contrast (forced colours):** gradients drop away and controls get plain system borders.
- **Screen readers:** medallions carry a `label`; progress bars are real progress bars; tabs are a real tablist; ornaments are hidden.
- **Contrast:** text pairs hold 4.5:1 in both themes — `ink`, `title` and `label` on frames and wells, `on-gem` on every gem's mid tone.

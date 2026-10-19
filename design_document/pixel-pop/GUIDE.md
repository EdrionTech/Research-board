Pixel Pop is a cheerful retro desktop: peach-cream windows on a pale blue grid desk, warm near-black pixel outlines, and pastel candy keys you want to press. It works for game UI (menus, HUDs, dialogue) and for playful web apps that want an old-computer feel without looking broken.

## Principles

- **Everything sits on the pixel grid.** One art pixel = `border-pixel` (2px). Outlines, dividers, focus rings and icon strokes are all that width. Sizes and gaps step in `space-1` (4px) multiples.
- **Square, never soft.** `radius-none` everywhere. Buttons suggest rounding with notched corners (the outline skips the corner pixel); only slider knobs and notification dots use `radius-round`.
- **Flat on the desk, hard when lifted.** Windows have no shadow. A Dialog, toast or dragged item gets a hard, unblurred `shadow-pixel` / `shadow-pixel-sm`. No blur, glow or gradient anywhere.
- **Colour means a role.** Candy colours are assigned to jobs (below), so a screen full of buttons still reads at a glance.

## Voice

- Short, game-like and friendly. System messages read like an old OS: "Loading...", "Connection lost. Your progress is saved.", "You have 1 unread message."
- Button labels are one or two uppercase words, verb first: PLAY, CONTINUE, RESTART, BACK. The component uppercases them; write them in sentence case in code.
- Window titles look like filenames or app names, sentence case: "Your music", "Notes.txt", "Photo".
- Address the player or user as "you". No emoji; use the pixel icons instead.

## Colour

- The desk is `surface-desktop` with a 1px `grid-line` grid every `space-6`. Windows are `surface-window`; wells inside them (inputs, tracks, checkboxes) are `surface-inset`.
- Text is `ink` on any surface, `ink-muted` for secondary text on `surface-window` and `surface-inset`. Every outline is `line`.
- Candy roles — the same in both themes, and text on any of them is `on-candy`:
  - `candy-teal` — default window title bars, info, search, your own chat bubbles.
  - `candy-green` — go / confirm: PLAY, CONTINUE, OK, checked boxes, success.
  - `candy-lavender` — navigation: BACK, MENU.
  - `candy-orange` — settings, restart, error and attention title bars.
  - `candy-pink` — store, favourites, extras, notification dots.
  - `candy-yellow` — warnings, badges, slider fills.
  - `candy-blue` — loading and progress fills.
- Candy buttons pair three tokens: the face (`candy-*`), a 4px bottom lip (`lip-*`) and the label (`deep-*`), e.g. `candy-green` + `lip-green` + `deep-green`. Every `deep-*` holds 4.5:1 on its face.
- Destructive actions use `danger` with `on-danger`; error text is `danger-ink`, always with the warning icon.
- Night theme swaps only the neutrals (desk, sheets, wells, ink, line). Candy stays bright, like backlit keys.

## Type

Pixel type is for show; everything you read for more than a glance is set in clean faces.

- `Pixelify Sans` (`--font-display`) carries the pixel personality, in short bursts only: `display` for splash screens, `title` and `heading`, and the `button` style (uppercase) on buttons. Never set a sentence or paragraph in it.
- `Nunito` (`--font-sans`) for all reading text: `body` for paragraphs, dialog messages and bubbles, `small` for hints and captions. Its rounded ends match the candy shapes.
- `Nunito` extra-bold uppercase (`--font-label`, the `label` style) for field labels, badges and bubble names.
- `JetBrains Mono` (`--font-mono`, the `system` style) for the old-computer layer: window titles, input text, status lines, numbers and timers.
- All three load from Google Fonts.

## Layout

- Pad window bodies with `space-4`; put `space-6` between windows on the desk; `space-3` between buttons in a row.
- Menus pair a wide labelled button with a square icon key of the same tone, as on a game's pause screen.
- Keep to one primary (`green`) action per view.

## States

- Hover: a 2px `bevel-light` highlight appears along a button's top edge.
- Pressed: the button drops one pixel and its lip shrinks from 4px to 2px. States switch instantly — no easing.
- Focus: a solid 2px `focus` ring, offset 4px, on every focusable control.
- Disabled: `surface-inset` face, `ink-muted` text, dashed outline on fields and boxes.

## Iconography

- 16×16 pixel icons, single ink, drawn as whole pixels only: close, minimize, maximize, check, info, warning, search, folder, mail, heart, star, sparkle, play, arrow-left, arrow-right, cursor.
- Show them at 16, 32 or 48px only. In React use `PixelIcon` (draws in `currentColor`); elsewhere use the SVGs in Assets › Icons (ink `#2a2421`; on dark grounds place them on a candy chip).
- No logo yet: set the name in `display` type.

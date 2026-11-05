# The look and feel: shared pieces and rules

Every page is built from the same few pieces, styled once in `src/style/base.css` (and `settings.css` for the settings-style pages). A page's own CSS only places them; it doesn't restyle them. When something needs to look or behave differently on one page, change the shared piece for every page, or add a variant of it here, so pages never drift apart.

`tests/layout.test.js` checks every page and every popup at phone widths (360 and 412 px): run it after any change to a page or its CSS.

## Colours, theme, style

- Colours come from the theme's variables only: `--bg`, `--surface`, `--text`, `--muted`, `--line`, `--accent`, `--danger`, plus `--radius` and `--shadow`. No colour written into a page's CSS, so every style (`src/style/themes/`) and light/dark, and the person's own colours and CSS (Settings → Appearance), apply everywhere.
- A page loads `core/settings.js` in its `<head>`, so it's drawn in the person's theme and style from the start. The appearance controls themselves are one shared piece, `core/appearance.js` (`Appearance.mount(section)`), used by the app's Settings and by the server's control page (its Appearance tab, saved in that server's data via the `settingssaved` event).

## The pieces

| Piece | Markup | Notes |
| --- | --- | --- |
| Top bar | `.bar` with `.brand`, buttons | Phones: it scrolls away with the page; buttons never wrap their words |
| Button | `.btn`, `.btn.primary` (one per group, the main action), `.btn.danger`, `.btn.small` | Phones: at least 40 px tall (36 px small) |
| Icon button | `.btn.has_i` with `<span class="i" data-i="…">` and `<span class="lbl">` | Phones: the icon alone, the words still read out. The page must load `style/icons.css` |
| Row of buttons | `.actions` (with `.spacer` to push some right) | Wraps when there's no room: never wider than its box |
| Popup | `<form class="modal">` (or `div.modal`) inside the page's one `#modals`, opened with `openModal(el)`, closed with `closeModals()` or a `[data-close]` button (`core/ui.js`) | One window system for every page. Its last child is its `.actions`. Desktop: centred, 520 px (`.wide`: 880 px). Phones: a sheet along the bottom, full width, its buttons pinned in view while the rest scrolls. Tidying up after one: listen for `modalclose` on it |
| Tabs | `nav.tabs` of `button[data-tab][aria-selected]`, panels `[data-panel]` (`.tab_badge` for a count) | Scroll sideways on their own on a narrow screen. The project dashboard and the server's control page |
| Dropdown / phone sheet | `dropDown()`, `sheetOnPhone()` (`core/ui.js`) | Toolbars' extra tools |
| Settings-style page | `.settings_section` with a `header h3`, rows `.setting` (`.stacked` for a full-width one), `.hint` under a label | Settings and the server's control page |
| List of things with actions | `ul.sync_list > li` with a `span` (name, `small` detail) then buttons; `li.empty` when there's none | Servers, devices, synced projects, invites |
| Status line | `.data_state` (`aria-live`), empty when there's nothing to say | One per section |
| Badges | `.sync_badge` (`.clash` for a problem), `.clash_count` on a button | |

## Rules for phones (≤ 700 px)

- Nothing scrolls sideways: long words and addresses wrap (`overflow-wrap: anywhere`), inputs and selects can shrink (`min-width: 0`), button rows wrap.
- A popup is a bottom sheet with its buttons always in view; never more than one open.
- Touch targets at least 36–40 px.
- Check it: `bun layout.test.js` in `tests/`, or `bun shots.js` for screenshots to look at.

## Words

- Say what a thing does in the person's terms ("Put on server", "Use the replaced one"), not the system's.
- Confirm before anything that can't be undone, saying what stays and what goes.
- A status line says what happened, and what to do if it didn't work.

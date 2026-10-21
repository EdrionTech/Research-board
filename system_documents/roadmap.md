# Roadmap

Everything still to do, by category. Details are in the linked plans. Done work isn't listed.

## 1. Next session (planned)

**Storage and clients** ([platforms/platforms.md](platforms/platforms.md), [apps/README.md](../apps/README.md)). Built: SQLite storage (the shared `place.js`), the boot loader that picks the client, the desktop app (Tauri) and the phone app (Capacitor, Android `.apk`), working offline, saving files and opening links in the apps, `devbuild`.
- [ ] Try the desktop installer and the `.apk` on real devices: the phone's storage, saving a backup (Documents/Research Board) and the status bar colour are untested on a phone; on the desktop, saving to Downloads and links opening in your browser
- [ ] **arXiv papers offline:** the HTML version is fetched from arXiv each time it's opened. Keep a copy with the material (like an uploaded PDF) so it opens without the internet
- [ ] Your own app icon when it's ready: `devbuild\build.ps1 icons <logo>` (desktop, phone launcher and splash)


**Citation style creator and editor** ([citation_styles/citation_styles.md](citation_styles/citation_styles.md))
- [ ] Styles as CSL, rendered by citeproc-js (kept in the app)
- [ ] Built in: APA 7, MLA 9, Harvard, IEEE, Chicago, Vancouver (plus BibTeX export)
- [ ] Import `.csl` files
- [ ] Visual editor with live preview, and a code view
- [ ] Styles from templates, guides or example references (closest built-in style, adjusted)
- [ ] Styles kept with your data, per user, selectable for any project

## 2. Setup and decisions
- [ ] Confirm npm only for building the phone app (used in `apps/phone` since 2026-10-21; the app code stays build-free)
- [ ] iOS: needs a Mac with Xcode (or a cloud build), plus an Apple developer account for real phones

## 3. Smaller features
- [ ] **Icons across the app** (the reader has them now: `src/style/icons.css`): the other pages' toolbars, the note toolbar, the dashboard
- [ ] **The reader on desktop:** what feels off there (still to be described)
- [ ] **Colour choices that change the style's whole mood** (Settings → Colours). Today a palette mostly recolours accents. It should reshape the style: for example, a Sunset palette in Skyglass should make the page look like a sunset (sky gradient, glass tint, glow), not just swap blue and green. How much each style gives depends on the style: some are fine as they are, some need a little influence, others need a lot. Decide per style which parts a palette drives (background, surfaces, bars, glows, illustrations).
- [ ] **The attach switch on phones** ("Attach notes to: Paragraph, Sentence…") is still a wide swipeable row
- [ ] **Library: tag filter** for materials
- [ ] **The note popup, small until needed.** When a selection in the material opens the pop-up note box, it opens **collapsed**: just what's attached (the words or place) and a few quick buttons, so it covers little of the page. It expands to the full note form when you click it or start typing, and can be collapsed again.
- [ ] **Marking without a note: underline, highlight, or both.** Mark a selection straight away, with no note to write, as an underline, a highlight or both, in a chosen colour (and its meaning, from the project's highlight colours). Marks are saved and shown like highlights, appear in the paper's notes list and "Highlights across papers", and can be turned into a note later.
- [ ] **The app's own right-click menu**, in the browser too: in the material reader (and elsewhere where it helps), right-click gives the app's actions (note, highlight, underline, bookmark, copy with citation, capture…) instead of the browser's menu. The browser's own menu stays reachable (e.g. Shift + right-click).
- [ ] **Citations in a paper link to its reference:** clicking an in-text citation in the material ("[12]", "(Smith et al., 2020)") jumps to that entry in its reference list, or opens its profile (the references panel). The HTML version partly does this already; the PDF needs its citations recognised.
- [ ] **Jump to page:** type a page number in the reader bar to go straight there (a line number in pasted text).
- [ ] **Read mode for PDFs:** the PDF's text reflowed as a clean, readable page (headings, paragraphs, figures where possible) with adjustable text size, instead of the printed pages; notes and highlights carry across.
- [ ] **Pen writing:** write or draw with a pen or finger (tablets, phones, touchscreens, drawing pads) in notes and other places you write: a handwriting or sketch area inside a note, kept as a drawing (and as an image when exported). Later: handwriting turned into text, and writing straight on the material's pages.
- [ ] **Dashboard "Writing" tab:** the tab exists but has no content yet
- [ ] Optional: a free colour picker in Settings → Colours, alongside the preset circles

## 4. Larger features (to discuss)
- [ ] **Moving between materials without leaving the reader:** going from one paper to another (a cited reference, a related paper, the next in the project) without going back to the Literature tab. Leaning towards (still to discuss): **a dropdown search** in the reader to find and open any material, and **opening a cited reference beside the current paper**. Other options noted: tabs of open materials, a side list of the project's materials, back and forward through what you've read.
- [ ] **A Milanote-like feature** (noted 2026-10-21; you'll define it better later). Milanote is a visual board where notes, images, links and files are laid out freely and grouped on a canvas. Exactly what it means for Research Board is still to be decided.

## 5. Tidy-ups and known issues
- [ ] `start.bat` opening the browser: the server side works (tested); confirm a tab opens
- [ ] Branch `feature/sqlite-and-apps` isn't pushed or merged yet

## 6. Development workflow
- [ ] Move the test suites into the repo (e.g. `tests/`) so anyone can run them
- [ ] Optional: a check that runs them on GitHub before merging
- [ ] Set up the branch layout discussed (`develop`, feature branches, `colab` later), if still wanted

## 7. On hold (recorded, not to be built yet)

**Online places** ([platforms/platforms.md](platforms/platforms.md))
- [ ] Places in Settings: our online service and private servers, reachable from every client
- [ ] Server sign-in: accounts, device tokens, invite links the host can revoke
- [ ] Phase B: synced offline copies of online places
- [ ] Desktop sharing on the local network (needs the server language chosen: Rust or Node)
- [ ] Online service: hosting, storage allowance per account, sign-in methods (proposal written)

**Collaboration** ([collaboration/collaboration.md](collaboration/collaboration.md))
- [ ] Collab button
- [ ] Members and roles; inviting people to a project
- [ ] Per-person state: reading status, where you are in each material (and possibly bookmarks)
- [ ] Live updates; live co-editing of the literature review (Yjs)
- [ ] Sharing libraries with other people
- [ ] Project file export and import

## 8. Future: AI ([ai/ai.md](ai/ai.md))
- [ ] Auto-tagging new papers (as suggestions)
- [ ] Tag clustering against tag sprawl (merges, catching duplicates as you type)
- [ ] An agent-usable platform: documented actions, MCP server, roles, undoable changes
- [ ] Draft summaries, related papers, questions over the project, review checks, highlight-colour suggestions, reading plans
- [ ] "From examples" citation styles for unusual cases

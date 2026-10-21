# Roadmap

Everything still to do, by category. Details are in the linked plans. Done work isn't listed.

## 1. Next session (planned)

**Storage and clients** ([platforms/platforms.md](platforms/platforms.md))
- [ ] SQLite storage, with the same tables everywhere (`projects`, `items`, `settings`, `files`, `changes`) and files named by their content
- [ ] Convert existing data on first run: today's `data/` folder, and anything still saved in a browser
- [ ] `Store` reads "this device" from SQLite through one interface (the shape online places will use later)
- [ ] Browser client served by the local server
- [ ] Desktop app (Tauri) wrapping the same `src/`
- [ ] Phone app (Capacitor), if time allows (the most setup-heavy)
- [ ] Remove the browser-only storage path once the apps or the server are the normal way to run

**Citation style creator and editor** ([citation_styles/citation_styles.md](citation_styles/citation_styles.md))
- [ ] Styles as CSL, rendered by citeproc-js (kept in the app)
- [ ] Built in: APA 7, MLA 9, Harvard, IEEE, Chicago, Vancouver (plus BibTeX export)
- [ ] Import `.csl` files
- [ ] Visual editor with live preview, and a code view
- [ ] Styles from templates, guides or example references (closest built-in style, adjusted)
- [ ] Styles kept with your data, per user, selectable for any project

## 2. Before next session: setup and decisions
- [ ] Install Node 22+ (the development machine has 20.19): needed for SQLite on the server side
- [ ] Decide whether npm is acceptable for building the apps (Tauri and Capacitor normally use it); the app code stays build-free
- [ ] Desktop app tools: Rust and Microsoft C++ Build Tools
- [ ] Phone app tools: Android Studio and its SDK (iOS needs a Mac)

## 3. Smaller features
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

## 5. Tidy-ups and known issues
- [ ] `assets/logo.svg` (the original) contains the logo twice; the app uses a fixed copy in `src/assets/`
- [ ] "+ New project" wraps onto two lines in Gildmoor and Pixel Pop at about 900 px width
- [ ] Untested so far: `start.bat` / `start.sh` opening the browser (`--open`), and resuming a video where you left off
- [ ] The YouTube player test fails in the test browser (only the test; worth a manual check)
- [ ] Not committed: everything since the last push

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

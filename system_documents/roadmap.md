# Roadmap

Everything still to do, by category. Details are in the linked plans. Done work isn't listed.

## 1. Next session (planned)

**Storage and clients** ([platforms/platforms.md](platforms/platforms.md), [apps/README.md](../apps/README.md)). Built: SQLite storage (the shared `place.js`), the boot loader that picks the client, the desktop app (Tauri) and the phone app (Capacitor, Android `.apk`), working offline, saving files and opening links in the apps, `build.bat` (builds into `builds/`, says which are out of date), the tests in `tests/`.
- [ ] **Install the new `.apk`** (`builds/ResearchBoard-0.1.0-debug.apk`, rebuilt 2026-10-29) and check the contents list, the note colour and the icons on the phone
- [ ] Try the desktop installer and the `.apk` on real devices: the phone's storage, saving a backup (Documents/Research Board) and the status bar colour are untested on a phone; on the desktop, saving to Downloads and links opening in your browser
- [ ] **arXiv papers offline:** the HTML version is fetched from arXiv each time it's opened. Keep a copy with the material (like an uploaded PDF) so it opens without the internet
- [ ] Your own app icon when it's ready: `build.bat icons <logo>` (desktop, phone launcher and splash)


**Citation style creator and editor** ([citation_styles/citation_styles.md](citation_styles/citation_styles.md))
- [ ] Styles as CSL, rendered by citeproc-js (kept in the app)
- [ ] Built in: APA 7, MLA 9, Harvard, IEEE, Chicago, Vancouver (plus BibTeX export)
- [ ] Import `.csl` files
- [ ] Visual editor with live preview, and a code view
- [ ] Styles from templates, guides or example references (closest built-in style, adjusted)
- [ ] Styles kept with your data, per user, selectable for any project

## 2. Setup and decisions
- [ ] Confirm Bun only for building the phone app (`apps/phone`, the app code stays build-free)
- [ ] iOS: needs a Mac with Xcode (or a cloud build), plus an Apple developer account for real phones

## 3. Smaller features
- [ ] **Icons across the app** (the reader has them now: `src/style/icons.css`): the other pages' toolbars, the note toolbar, the dashboard
- [ ] **The reader on desktop:** what feels off there (still to be described)
- [ ] **Colour choices that change the style's whole mood** (Settings → Colours). Today a palette mostly recolours accents. It should reshape the style: for example, a Sunset palette in Skyglass should make the page look like a sunset (sky gradient, glass tint, glow), not just swap blue and green. How much each style gives depends on the style: some are fine as they are, some need a little influence, others need a lot. Decide per style which parts a palette drives (background, surfaces, bars, glows, illustrations).

- [ ] **Follow-ups from the 2026-11-04 batch** (tag filter, compact note box, marks, right-click menu, citation links, jump to page, PDF read mode, pen writing, Writing tab, your own colours: all built)
  - Right-click menu beyond the reader (dashboard lists, notes, the editors), if wanted
  - PDF read mode: show figures (cropped from the page) between the paragraphs; for now they stay on the printed pages
  - Pen writing: handwriting turned into text; writing straight on a material's pages
  - Citations: author–year matching is by first surname and year; check it on real papers (and the arXiv HTML side, untested offline)

## 4. Larger features (to discuss)
- [ ] **Moving between materials without leaving the reader:** going from one paper to another (a cited reference, a related paper, the next in the project) without going back to the Literature tab. Leaning towards (still to discuss): **a dropdown search** in the reader to find and open any material, and **opening a cited reference beside the current paper**. Other options noted: tabs of open materials, a side list of the project's materials, back and forward through what you've read.
- [ ] **Authors you can follow up** (noted 2026-11-04): pick an author (in a material's author list, the Library, a reference) and find their papers: filtered in your Library and in the project, or searched online (arXiv, OpenAlex, Semantic Scholar…) to add new ones. Built: the author filter in the Library and the Literature tab (`sources/authorfilter.js`: a chip for anyone with 2+ papers or on a paper with under 10 authors, the rest under "Other authors"), search by any author's name, long author lists folded. Still to do: names you can click (opening that filter), and the online search.
- [ ] **A Milanote-like feature** (noted 2026-10-21; you'll define it better later). Milanote is a visual board where notes, images, links and files are laid out freely and grouped on a canvas. Exactly what it means for Research Board is still to be decided.

- [ ] **The Research tab** ([research_tab/research_tab.md](research_tab/research_tab.md)): planning and tracking the study itself: a workflow of stages per project, tasks with dependencies, research assets (datasets, scripts, logs), data and analysis, and a change log of methodological decisions and what they affect. Connected to the Writing tab so findings can be cited without copying.
- [ ] **Full screen for reading and writing**, with optional small focus tools: a clock in the corner that can be ignored, and a timer / alarm (e.g. for reading sessions). For the material reader and the editors (notes, review, writing). Still to describe: the second option (only the start was written down)

## 5. Tidy-ups and known issues
- [ ] `start.bat` opening the browser: the server side works (tested); confirm a tab opens
- [ ] Branch `feature/sqlite-and-apps` is pushed but not merged into `main` yet

- [ ] PDF.js logs "the `--scale-factor` CSS-variable must be set" when a PDF's pages are first added (harmless; the text layer renders before the page size is set)
- [ ] The PDF reference list needs 3+ "[n]" lines to split by number: a short list like "[1] … [2] …" becomes one reference

## 6. Development workflow
- [ ] Optional: a check that runs the tests (`tests/`) on GitHub before merging
- [ ] More tests as features change: the reader (notes, highlights, places), the library, backups from Settings
- [ ] Builds kept per version: `builds/` holds the latest of each (named by version); keep or prune older ones once the version number starts changing
- [ ] The server as a single file (`bun build --compile`, one per OS) for private servers, built by `build.bat host`: needs `src/` embedded or shipped beside it
- [ ] Set up the branch layout discussed (`develop`, feature branches, `colab` later), if still wanted

## 7. On hold (recorded, not to be built yet)

**Online places** ([platforms/platforms.md](platforms/platforms.md))
- [ ] Places in Settings: our online service and private servers, reachable from every client
- [ ] Server sign-in: accounts, device tokens, invite links the host can revoke
- [ ] Sync: each app keeps its own copy of server projects and syncs with the server when online (local-first; replaces desktop sharing on the local network, dropped 2026-11-04)
- [ ] The server as coordinator: checking roles on each change, numbering and fanning out changes, Yjs relay ([collaboration/collaboration.md](collaboration/collaboration.md))
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

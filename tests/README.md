# Research Board tests

```powershell
run test             # from the project folder (run.bat test / ./run.sh test): installs the test tools the first time, then runs them all
```

Or here: `bun install` once, then `bun run.js` (all), `bun run.js api` (only the files whose names include "api"), or `bun api.test.js` (one file). Needs Bun and Edge or Chrome (any other Chromium browser with `BROWSER=<path to it>`). Nothing is downloaded but `puppeteer-core` (not Playwright: it can't start a browser under Bun on Windows).

Each test file starts its own server on a spare port with a new, temporary data folder holding the sample in [helpers.js](helpers.js). Your `data/` folder is never used.

| File | Checks |
| --- | --- |
| `api.test.js` | The server API and its SQLite storage: saving, older saves and deletes, files kept once, the changes feed, restart, restore and clear |
| `pages.test.js` | Every page opens with no errors, shows the data and saves a change; without the server, the pages say how to start it |
| `sync.test.js` | Sync between a device and a server with a key: linking, edits both ways, newer wins, deletes, files, a second device, an unreachable server, restore; wrong keys and the upload limit; Settings (connecting, a saved server, the one line with its key, a server at a new address); a project's settings and a separate copy |
| `layout.test.js` | Every page and every popup at phone widths (360, 412 px): nothing scrolls sideways, popups fit, their buttons are in view ([system_documents/design/ui.md](../system_documents/design/ui.md)) |
| `passes.test.js` | Reading in passes on a material: section roles from headings, what each pass folds, peeking, the five Cs as sections of the Summary, a section edited in the notes side showing in the pass, reference marks on the paper's own list, the next pass, the main argument after the five Cs, the five Cs still editable in pass 2, the close-out and predictions as sections (a section of your own kept), evidence as a highlight colour, a captured figure's checks, a role changed in Contents, predicting in pass 3, leaving and resuming, finishing (status Done); an older Review box moved into the Summary (and the summary pad not saving over it); the pass bar at phone width |
| `survey.test.js` | The survey board: materials in columns by pass, the four steps, a seed starred and saved, the key papers (shared titles and DOIs) and recurring authors, one added; the venues cited most and a venue's recent papers, a survey paper's references used, papers found to start from (OpenAlex faked); a seed paper's related work open in pass 1; the parts folding and staying folded; each material's summary in the Summaries box, opened in a popup and edited by section; highlights across papers scrolling in their own box and searched; the view remembered; phone width |
| `wizard.test.js` | From your reading to a literature review: the papers chosen to start with, themes by shared citations and by tags, a paper moved, the skeleton (a theme's papers cited together, each argument, the gaps), written into the empty review; paper by paper as a new draft; phone width |
| `offline.test.js` | With the internet refused (as in the apps): the libraries, PDF.js and each style's font still load |

`bun shots.js` (or `bun run shots`) isn't a test: it saves phone-size (Pixel 7) and desktop screenshots of the main pages into `shots/` (not in git), for checking layouts by eye.

A new test file: name it `<topic>.test.js`, use `startServer`, `launchBrowser` and `tester` from `helpers.js`, and it's picked up by `run.js`. When a feature changes, update its test and delete checks that no longer describe the app.

# Research Board local server

`server.js` serves the app (`src/`) and keeps its data in files on this computer, so nothing depends on the browser's storage (which is kept per address, and can be cleared or evicted). It needs only Node.js 18 or newer, no packages.

## Starting it

| | |
| --- | --- |
| Windows | Double-click `start.bat` in the project folder |
| macOS, Linux | `./start.sh` in the project folder |
| Anywhere | `node server/server.js` from the project folder (add `--open` to open the browser) |

The app is at <http://127.0.0.1:5500/>. The starters open it in your browser once the server is ready. Stop the server with Ctrl + C or by closing its window: every change is already saved.

## Options

Set these as environment variables:

| Variable | Default | |
| --- | --- | --- |
| `PORT` | `5500` | Keep it the same between runs. Browsers keep anything they store per address, and a changing port is what made data "disappear" with Live Server. If the port is taken, the server stops instead of picking another one. |
| `HOST` | `127.0.0.1` | This computer only. Don't open it to the network (`0.0.0.0`) until there are logins: anyone on the same Wi-Fi could read and change everything. |
| `DATA` | `../data` | The data folder. |

## The data folder

| File | What it holds |
| --- | --- |
| `research-board.json` | Projects; materials, with where you are in each (`readingAt`) and their summaries and reviews; notes and highlights; bookmarks; figures; the literature review; the library's settings; the theme, style, colour choices and your own CSS. Rewritten whole about a second after changes, through a temporary file, so it's never left half-written. |
| `journal.ndjson` | Changes since that rewrite, one per line. Each is written before the app is told "saved", and replayed on start, so a crash or a closed window loses nothing. |
| `files/<id>`, `files/<id>.json` | Uploaded PDFs, videos and images (in notes, figures, project and material thumbnails), first-page previews; and each file's type and name. |

If `research-board.json` can't be read, it's copied aside (`.damaged-<time>`), never overwritten.

**Backing up:** copy the whole `data` folder, best while the server is stopped (then `journal.ndjson` is empty and everything is in `research-board.json`). Or download a backup from Settings, with files. To move to another computer, copy the folder into the project there (or point `DATA` at it).

## How the app uses it

Every page loads `/api/boot.js` first. When it answers, `src/script/core/store.js` reads from the copy it receives and sends each change back. Changes that can't be sent wait in the browser (one outbox per open page) and go once the server is back; a "Not saved yet" notice shows meanwhile. Other open tabs are told about each change. When `/api/boot.js` doesn't answer (the files opened directly, or Live Server), the app keeps its data in the browser as before. The first time the server runs, the app offers to copy in what the browser has.

Small per-device preferences (reader zoom, view modes, panel states, which shelf view) stay in each browser on purpose, so a phone and a PC can differ.

## API

This is everything the app needs. A desktop or mobile version, or another framework, can keep the app's data by reimplementing these requests, or by giving `Store` another backend that does the same.

| Request | |
| --- | --- |
| `GET /api/boot.js` | Everything, as `window.RB_SERVER = { data: { projects, items, library, settings }, empty, dataDir }` |
| `GET /api/health` | `{ ok: true }` when the server is up |
| `PUT /api/items/:id` | Save one item (the whole item). One older than the stored copy (`updatedAt`) is ignored: `{ ok, kept: "newer" }` |
| `DELETE /api/items/:id` | |
| `PUT /api/projects/:id` | Save one project; new ones go first |
| `DELETE /api/projects/:id` | |
| `PUT /api/kv/library`, `PUT /api/kv/settings` | The library's settings; the theme, style, colour choices and your own CSS (a whole object) |
| `PUT /api/files/:id` | Store a file: the body is the file, with `Content-Type` and `X-File-Name` (URI-encoded) |
| `GET /api/files/:id` | The file, with its type and `X-File-Name` |
| `DELETE /api/files/:id` | |
| `POST /api/restore` | Replace everything with a backup (Settings' backup format, files included) |
| `POST /api/clear` | Delete everything |

Items are anything in a project, told apart by `type`: `source` (a material), `source_note`, `bookmark`, `figure`, `lit_review`, and the dashboard's notes. Materials follow [model/literature material.json](../model/literature%20material.json).

## Later

Where this is going (SQLite, places, the desktop and phone apps, signing in, invite keys) is in [system_documents/platforms/platforms.md](../system_documents/platforms/platforms.md); working together in [system_documents/collaboration/collaboration.md](../system_documents/collaboration/collaboration.md). This server becomes the server program there: the same one for our online service and private servers. Where you are in each material and bookmarks are kept on the material for now; with collaboration they become per person.

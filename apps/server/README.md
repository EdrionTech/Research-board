# Research Board local server

`server.js` serves the app (`src/`) and keeps its data in files on this computer, so nothing depends on the browser's storage (which is kept per address, and can be cleared or evicted). It needs only [Bun](https://bun.sh) (for its built-in SQLite), no packages.

## Starting it

| | |
| --- | --- |
| Windows | Double-click `run.bat` in the project folder and choose **open** (or `run.bat open`) |
| macOS, Linux | `./run.sh open` in the project folder |
| Anywhere | `bun apps/server/server.js` from the project folder (add `--open` to open the browser) |

### As a server for other devices

For a lab server, or your own phone and laptop syncing with one computer: copy the project there (or the server version, `run build server`, unzipped), then one run:

| | |
| --- | --- |
| Windows | `run.bat host` (or double-click `run.bat` and choose **host**) |
| macOS, Linux | `./run.sh host` |

It installs Bun if it's missing, starts the server with the saved settings, and opens its **control page** in your browser (`page/server.html`, usable only with the server's main key, which the opening link carries). In tabs, while the server runs: **Overview** (running or not, the addresses with Copy, a QR code to add a device in one step, the projects on it); **Devices** (invites for one device or any number until they expire, the open ones, and the devices, each with its own key, when added and last seen, with **Remove**); **People** (accounts and sign-ups for a server open to the public: later work, shown so its place is clear); **Server** (reached from this network or any network, port, data folder, with **Save and restart**; **Start with the computer**; the **main key**). **Appearance** (the same controls as the app's Settings: theme, style, colours, your own CSS) sets the look of the page and of the app opened from this server, kept in the server's data. The settings are kept in `local/serve.json` (`hosting.js`). In the server's window: `i` + Enter for another invite, `a` + Enter to open the control page again. Options: `--start` (no page: what starting with the computer runs), `--public`, `--autostart` / `--no-autostart`. Starting with the computer: Windows, a launcher in your Startup folder (no administrator rights); Linux, a systemd user service; macOS, launchd (its messages in `local/serve.log`). Windows may ask whether Bun may use the network: allow it on private networks.

The addresses it prints work on the same network only. Many campus, office and guest Wi-Fi networks stop devices from reaching each other ("client isolation"), and a router won't pass connections from outside to this computer. For those, use one of the two below.

### From any network, for testing: `run host --public`

`run.bat host --public` (or `./run.sh host --public`) gives a temporary `https://<words>.trycloudflare.com` address that works from any network, mobile data included, through a free Cloudflare tunnel (`tunnel.js`; `cloudflared` is downloaded once into `local/tools/`). Nothing is opened on your router: the tunnel connects outwards, and closing the window closes it. It keeps its data in `data-public/`, apart from your own projects, and always asks for the key. The address changes each start.

Only the Research Board server is reachable through it, nothing else on the computer. Someone with the address and the key could read and change that data folder; run it while testing, not around the clock.

### On a VPS: `vps-setup.sh`

For a server that stays up, rent a small Ubuntu or Debian server, copy the server version to it (`run build server`, then `scp apps/builds/ResearchBoard-<version>-host.zip root@<server>:`), unzip it there, and run once:

```sh
unzip ResearchBoard-<version>-host.zip -d research-board
sudo sh research-board/apps/server/vps-setup.sh            # or: … vps-setup.sh your.domain
```

It installs Bun and Caddy, runs Research Board as its own user (it can write only `/var/lib/research-board`), started with the machine; Caddy in front gives HTTPS with a free certificate, at your domain or at `<ip>.sslip.io` if you give none; the firewall lets in only SSH and web traffic. It prints the https address and key. Running it again with a newer version updates it, keeping the data and key.

### Adding a device: a QR code or a link

When the server starts open to other devices, its window shows an **invite**: a QR code and a link (`https://…/#invite=…`) that adds one device within 20 minutes. More (for one device or any number, for up to 7 days) are made on the control page, or by a device already in (its saved server → **Invite a device**). In Research Board on the device, Settings → Sync with a server → **Scan QR code**, or paste the link there. Opened in a browser, the link signs that browser in to the server's own app.

**Each device gets its own key and id** (`access.js`): the server makes them when the invite is used (`POST /api/invite`, with the device's name) and keeps only a fingerprint (SHA-256) of the key, in `devices.json` in the data folder. So removing one device, or making a new main key, never disconnects the others. The **main key** (`server-key.txt`) is the host's: the control page needs it, and devices given it directly before invites existed still use it. A device's key can sync and invite another device, but not use the control page. A wrong invite counts as a wrong key. Invites are kept in memory: a restart ends the open ones.

### Safeguards in every mode

- Any server reachable from other machines asks for its key on every `/api/` request.
- After 10 wrong keys within 10 minutes, the server refuses that address for 15 minutes. Behind the tunnel or Caddy, it uses the visitor's real address.
- Uploads are limited to `MAX_UPLOAD_MB` (500).
- The app's own files are served only from `src/`.

The app is at <http://127.0.0.1:5500/>. The starters open it in your browser once the server is ready. Stop the server with Ctrl + C or by closing its window: every change is already saved.

## Options

Set these as environment variables:

| Variable | Default | |
| --- | --- | --- |
| `PORT` | `5500` | Keep it the same between runs. Browsers keep anything they store per address, and a changing port is what made data "disappear" with Live Server. If the port is taken, the server stops instead of picking another one. |
| `HOST` | `127.0.0.1` | This computer only. `0.0.0.0` opens it to other computers (a lab server, devices syncing with it): it then asks for its access key (below). |
| `DATA` | `data` in the project folder | The data folder. |
| `KEY` | made for you | The access key. Without it, a server open to other computers makes one on its first start and keeps it in `<DATA>/server-key.txt`; on this computer only, no key is asked for unless `KEY` is set. |

## Access

A server reachable from other computers asks for its key with every `/api/` request (`Authorization: Bearer <key>`), except `/api/health`. The key is printed when the server starts. Give it to the devices that sync with this server (Settings → Sync with a server); a browser opening the server's address asks for it once and keeps it. One key gives full access: accounts, roles and invite links come later ([platforms.md](../../system_documents/platforms/platforms.md), "Accounts and signing in"). Put the server behind HTTPS (a reverse proxy) before using it over the internet, so the key isn't sent in the clear.

Other web pages may call the API only when a key is needed (they must hold it), and the desktop and phone apps always may (their own addresses), so they can sync with a server on this computer. Other websites open in your browser can't reach a server that asks for no key.

## The data folder

| File | What it holds |
| --- | --- |
| `research-board.db` | Projects; materials, with where you are in each (`readingAt`) and their summaries and reviews; notes and highlights; bookmarks; figures; the literature review; the library's settings; the theme, style, colour choices and your own CSS; which uploaded file is which. A SQLite database: each change is saved whole or not at all, so a crash or a closed window loses nothing that was confirmed. |
| `research-board.db-wal`, `-shm` | SQLite's working files while the server runs. Folded back into the `.db` when it stops. |
| `files/<hash>` | The bytes of uploaded PDFs, videos and images (in notes, figures, project and material thumbnails) and first-page previews, named by their content: the same file added twice (say, a material copied into a project) is kept once, and removed when nothing uses it. |
| `before-sqlite/` | Left by the first run of this version: the old `research-board.json`, `journal.ndjson` and `files/`, after they were brought into `research-board.db`. Delete it once you're happy. |

The storage itself isn't in the server: it's [src/script/core/place/place.js](../../src/script/core/place/place.js), shared with the desktop and phone apps, with the tables described there. [place-bun.js](place-bun.js) gives it Bun's SQLite and the files folder.

**Backing up:** copy the whole `data` folder while the server is stopped. Or download a backup from Settings, with files. To move to another computer, copy the folder into the project there (or point `DATA` at it).

## How the app uses it

Every page starts with `src/script/core/boot.js`, which asks for `/api/boot` and then runs the page's scripts. `src/script/core/store.js` reads from the copy it receives and sends each change back. Changes that can't be sent wait in the browser (one outbox per open page) and go once the server is back; a "Not saved yet" notice shows meanwhile. Other open tabs are told about each change. Without the server (the files opened directly, or Live Server) the pages say how to start it: nothing is kept in the browser. The first time the server runs, the app offers to copy in what an older version kept in the browser.

Small per-device preferences (reader zoom, view modes, panel states, which shelf view) stay in each browser on purpose, so a phone and a PC can differ.

## API

This is everything the app needs. A desktop or mobile version, or another framework, can keep the app's data by reimplementing these requests, or by giving `Store` another backend that does the same.

| Request | |
| --- | --- |
| `GET /api/boot` | Everything: `{ data: { projects, items, library, settings }, empty, dataDir }` |
| `GET /api/health` | `{ ok: true }` when the server is up |
| `GET /api/changes?since=N` | What changed after change `N`: `{ changes: [{ seq, kind, id, op }] }` (for synced copies later) |
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
| `GET /api/sync` | The projects here, for a device to choose from: `{ projects: [{ id, title, updatedAt }] }` |
| `GET /api/sync/:project?since=N` | The project's records changed after change `N` (all of them from 0, deleted markers included): `{ seq, changes: [{ kind, id, op, updatedAt, record }] }`. `&origin=local`: only changes made here, not those sync brought |
| `POST /api/sync/:project` | `{ changes }` from another place: each kept if newer than what's here and if it belongs to the project: `{ applied }` |
| `GET /api/sync/:project/files` | The project's files kept here: `{ files: [ids] }` |
| `GET /api/events` | Live updates: a stream (Server-Sent Events) with `data: { project }` each time a project's records change here, so devices sync at once |
| `GET /api/links`, `PUT /api/links/:project`, `DELETE /api/links/:project` | Which projects here sync with which server (address, key, how far each way): used on a device, by sync.js |

## Sync

A project on a device (the desktop or phone app, or the data of a server on your own computer) can be kept in step with its copy on a server: [src/script/core/place/sync.js](../../src/script/core/place/sync.js), run by the app: within a second of a change being saved on the device, at once when the server announces a change (`/api/events`, a stream each device keeps open), and every minute in case the stream is down. Each sync fetches the server's changes since the last one, sends the changes made on the device since the last one, then copies the project's files either side lacks. The newer edit wins, record by record (by the time it was made); deletes leave a marker, so an older save can't bring a record back. Both sides are `place.js`, answering the requests above.

Items are anything in a project, told apart by `type`: `source` (a material), `source_note`, `bookmark`, `figure`, `lit_review`, and the dashboard's notes. Materials follow [system_documents/model/literature material.json](../system_documents/model/literature%20material.json).

## Later

Where this is going (places, the desktop and phone apps, signing in, invite keys) is in [system_documents/platforms/platforms.md](../system_documents/platforms/platforms.md); working together in [system_documents/collaboration/collaboration.md](../system_documents/collaboration/collaboration.md). This server becomes the server program there: the same one for our online service and private servers. Where you are in each material and bookmarks are kept on the material for now; with collaboration they become per person.

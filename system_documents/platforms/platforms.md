# Platforms and storage

Status: **SQLite storage built** (shared `place.js`, used by the local server; 2026-10-21). Next: the desktop app (Tauri). The local server in `apps/server/` keeps data in `data/research-board.db`. Online places (our service, private servers), signing in, invite links and syncing are **on hold**, along with collaboration. Decided 2026-11-04: every device keeps its own copy and syncs through a server; no device acts as a server (local-network sharing dropped).
How Research Board runs on desktop, phone and in a browser; where its data lives; how one app reaches local and online data. Working on projects together is in [../collaboration/collaboration.md](../collaboration/collaboration.md).

## Decisions

| Question | Decision |
| --- | --- |
| Storage | **One method everywhere: SQLite**, plus a files folder |
| Storage code | **Written once, in JavaScript** (`src/script/core/place/place.js`), run by the server and inside the apps; each platform only adds a small SQL and files adapter |
| Browser storage | **Dropped** unless necessary (see "What the browser may keep") |
| Where data can be | **Places**: this device, our online service, private servers. Every client has any mix of them at once: local projects beside projects on several servers |
| Clients | **Desktop app** (Tauri; Electron is too heavy), **phone app** (Capacitor), **browser** (a thin client, nothing installed) |
| Local network | **Dropped** (2026-11-04). No device acts as a server; your devices share through a server (ours or self-hosted) by syncing |
| Online places when offline | **Local-first in the apps:** each device keeps its own copy of the server projects it uses and syncs when online. The browser has no copy: online only, plus the outbox |
| Accounts | **Not needed to use the app.** Signing in to an online place is done in Settings |
| Joining a server | The host makes an **invite link**. Opening it adds your account and device; you keep access for as long as the host allows |
| Libraries | **Per user**, shareable with other people |

## Places

The app shows data from any number of places. Each project lives in one place.

| Place | Data lives in | Reached by |
| --- | --- | --- |
| **This device** | SQLite inside the app | This device only. No account, works offline |
| **Research Board online** (ours) | SQLite (Postgres later if needed) on our server | An account, from any device |
| **A private server** (yours, a lab's) | SQLite on that machine | Accounts on that server, joined with an invite link from its host |

- A client holds any mix at once: projects on this device beside projects on our service and on any number of private servers.
- The home screen groups projects by place ("On this device", "Online", "Lab server").
- Settings → **Places**: the places you've joined (open an invite link, or sign in to our online service), and leaving one.
- **Moving a project** to another place copies it there, then deletes the original.
- Our online service and private servers run **the same server program**. Ours is one particular address.
- **Anyone can host their own server**, and it serves the full app too: opening its address in a browser gives the client for that server's projects, nothing installed. The desktop and phone apps reach it as well, by adding it as a place.

### One interface to every place

Pages talk to `Store`. `Store` talks to a place through one set of actions:

> list · read · save · delete · files (put / get / delete) · changes since N · live updates

There are two implementations of those actions:

- **Remote place:** the actions over the network, which is the server API in `apps/server/README.md` plus sign-in.
- **This device:** the same actions run directly on the app's own SQLite (Tauri's and Capacitor's SQLite plugins), with no network. This is `place.js` itself: the code the server runs, in the app.

Because of this, pages never need to know where a project lives.

## Clients

| Client | What it is | Its own data | Reaches |
| --- | --- | --- | --- |
| **Desktop app** (Tauri) | Installed on Windows, macOS, Linux | "This device" (SQLite) | Every place |
| **Phone app** (Capacitor) | Installed on Android, iOS | "This device" (SQLite) | Every place |
| **Browser** | Nothing installed: open a place's address | None (see "The browser") | The place whose address it opened; other places you've joined |

All three are the same app (the code in `src/`), so a feature built once works in each. The installed apps add what a browser can't do: data kept on the device and working offline.

## No device acts as a server

Decided 2026-11-04, replacing the earlier idea of the desktop app sharing its data on the local network. Every device holds its own copy and syncs with a server when online; to use the same projects on your phone and laptop, put them on a server (ours, or one you host) and both devices sync with it. The apps never contain a server, so the server program's language is no longer tied to the apps: it stays Node.

## Storage: SQLite and a files folder

The tables are the same everywhere (device, our server, private servers):

- **`projects`**, **`items`**, **`settings`**, **`files`**, and **`changes`** (a sequence number per change, for "changes since N").
- **Items stay flexible.** Each item is one row: `id`, `project_id`, `type`, `created_by`, `updated_by`, `updated_at`, `deleted`, and the rest of the item as JSON. Fields searched often (title, source, citation key, tags) get indexes. New fields don't need a schema change.
- **Files are named by their content (a hash).** The same PDF is stored once, and "already have it" is a simple check.
- **Versioned data format**, with upgrade steps. Once copies exist on phones, an older app can meet newer data.
- **Backup or moving a place** means copying its `.db` file and `files/` folder.

### One storage code for every platform

`src/script/core/place/place.js` holds the tables, their upgrades, and every action (boot, save, delete, files, changes since N, replace everything). It never touches SQLite or the disk itself: it's given two adapters.

```
pages ─► Store ─┬─ browser: remote (HTTP) ─► server.js ─► place.js ─► sql/bun + files   (apps/server/place-bun.js)
                ├─ desktop: ──────────────────────────► place.js ─► sql/tauri + files     (later)
                └─ phone:   ──────────────────────────► place.js ─► sql/capacitor + files (later)
```

| Adapter | `sql`: exec, run, get, all | `blobs`: put, get, delete (by hash) |
| --- | --- | --- |
| Server | Bun's built-in `bun:sqlite` (no packages) | `files/` beside the database |
| Desktop app (Tauri) | Tauri's SQL plugin | the app's data folder (file system plugin) |
| Phone app (Capacitor) | Capacitor's SQLite plugin | the app's files folder (Filesystem plugin) |

`Store` tells the clients apart by what the page finds: `window.__TAURI_INTERNALS__` (desktop), `window.Capacitor.isNativePlatform()` (phone), `window.RB_SERVER` (a browser served by a server), checked in that order, and loads only that client's adapter.

**Files:** an uploaded file keeps its own id (`asset:<id>` in items, so copies of a material stay independent), and the `files` table points it at its bytes, `files/<sha-256>`. The same bytes are kept once, and removed when no file uses them.

`data/research-board.json` and `journal.ndjson` became `research-board.db`, with SQLite's own crash safety. The first run of the new server converts them and keeps the originals in `data/before-sqlite/`.

## The browser

The browser is one of the three clients, with nothing installed: opening a place's address (our online service, a private server) gives the full app, served by that place. There's no data in the browser; it needs a connection.

**What the browser may keep** (the "necessary" cases):
- **The places you've added and your sign-in tokens.** The apps keep these in the device's secure storage.
- **Per-device preferences**: reader zoom, view modes, panel states.
- **The outbox**: changes waiting for a connection that dropped, so an edit is never lost.

The browser-only mode in `Store` (localStorage, IndexedDB) was removed on 2026-10-21: opened without a server or app, the pages say how to start Research Board. What an older version kept in a browser is still offered for copying in, once, when a data folder is new.

## Offline

- **This device:** always works offline.
- **Server projects in the apps (local-first):** the app keeps a copy of each server place you use, a SQLite file per place with the same schema, run by the same `place.js`. You read and edit the copy, online or not; when online it syncs with the server: "changes since N" down, the outbox up, then live updates while open. The server decides the order of changes and checks each one against your role (see the coordinator in the collaboration document). Deletes leave a marker, and the literature review merges with Yjs. Big files come when opened, and stay for offline use if you ask.
- **The browser:** no copy (it keeps no data). It works online only; changes made while the connection drops wait in the outbox and go when it's back.

A first step can be online-only in the apps too (as the browser), as long as it uses the same schema, the `changes` feed and the outbox, so the local copy adds to it rather than replacing it.

## Accounts and signing in

- **Not needed to use the app.** "This device" works with no account, offline.
- **Signing in is per online place**, from Settings, and stays signed in there.
- **Joining a private server, by invite link:** the host (the server's admin) makes a link. Opening it, in a browser or the apps, adds your account and this device to that server. After that, that account on that device gets in whenever it connects, for as long as the host allows. The host sees who and which devices have access, and can remove any of them. A link works once (or for a set number of people) and can expire.
- **Collaboration** (sharing a project with people) needs an online place. A **Collab** button shows where it will go, so the ability is visible, and is built later (see the collaboration document).

## Libraries

- **A library belongs to a user** (on device: the device's owner). It holds materials that aren't in a project yet.
- **Shareable:** you can let other people see your library and take materials from it into theirs or into their projects. Taking a material copies it; the original stays in its owner's library.
- **Coming next:** a tag filter for materials on the Library page.

## Build order

1. **SQLite in the server (done).** The shared `place.js` with the tables above, the `changes` feed and content-named files; `apps/server/` runs it on `bun:sqlite` (on `node:sqlite` until the move to Bun, 2026-11-04). It converts the current data on first run. The API stayed the same for the app.
2. **Places in `Store`.** One interface; the remote implementation (today's server code, plus sign-in); the place list in Settings.
3. **Server sign-in.** Accounts, device tokens, invite links, the host's list of who has access. This one program serves both our online service and private servers.
4. **Desktop app (Tauri)** with "This device" on its own SQLite (no built-in server): `place.js` with a Tauri adapter, picked by `Store`.
5. **Phone app (Capacitor)** the same way as the desktop app.
6. **Sync:** each app's local copy of server projects, kept in step with the server.
7. **Collaboration** (see the collaboration document), behind the Collab button.

## Our online service (proposed, not decided)

- **The same server program** as private servers, on a small rented server to start (a VPS), so there's one code path to build and test.
- **A SQLite database per user** (and per shared project later), not one big database. Each person's data stays separate and can be exported as one file; this matches "one storage method".
- **Files in object storage** (Cloudflare R2 or Backblaze B2: cheap, and R2 charges nothing for downloads), with a storage allowance per account.
- **Backups:** the databases copied continuously to object storage (Litestream), files there already.
- **Signing in:** an email link (no password to forget), plus ORCID, the researcher ID many universities use, and Google.
- **Growing later:** a hosted SQLite service (Turso) instead of one server, without changing the storage method.

## Still open

- **Server runtime: Bun** (decided 2026-11-04, replacing Node). Built-in SQLite, a WebSocket server with publish/subscribe for live updates (no `ws` package), and `bun build --compile` for a one-file private server. The server stays JavaScript: with no server inside the apps, it never needs to be Rust.
- **Our online service:** the proposal above; where it's hosted; storage allowance per account.

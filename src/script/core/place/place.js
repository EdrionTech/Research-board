// A place's storage, written once for every platform: the server (apps/server/place-bun.js), the desktop app
// (Tauri) and the phone app (Capacitor) each give it two small adapters, and it does the rest.
//
//   sql:   { exec(sql), run(sql, params), get(sql, params), all(sql, params) }   each may return a promise
//   blobs: { put(hash, bytes), get(hash) → bytes | undefined, delete(hash) }    bytes: Uint8Array
//
// Tables (the same everywhere, see system_documents/platforms/platforms.md):
//   projects  id, position, updated_at, deleted, data          data: the whole project, as JSON
//   items     id, project_id, type, created_by, updated_by, updated_at, deleted, data
//   settings  key, value                                         'library', 'settings'
//   files     id, hash, type, name, size, created_at              the bytes are blobs/<hash>: a PDF added
//                                                                 twice is kept once, and removed when no
//                                                                 file uses it any more
//   changes   seq, kind, record_id, op, at, project_id, origin   "changes since N": origin 'local' (made here)
//                                                                 or 'sync' (brought from another place)
//   conflicts id, project_id, kind, record_id, kept, lost, lost_from, at
//                                                                 an edit made here and one made elsewhere, to the
//                                                                 same record before they could sync: the newer was
//                                                                 kept, the other is here to bring back if wanted
//   links     project_id, server, key, pulled, pushed, synced_at, error
//                                                                 projects here kept in step with a server
//                                                                 (sync.js): its address and key, and how
//                                                                 far each way has been synced
//
// Deletes leave a marker (deleted = 1, with the time), so a save sent late can't bring a record back, and a
// synced copy can learn of the delete. Every write goes through one queue, so a transaction never interleaves
// with another request's.

const SCHEMA = [
    // 1: the first version
    `CREATE TABLE projects (
        id TEXT PRIMARY KEY, position REAL NOT NULL, updated_at INTEGER NOT NULL DEFAULT 0,
        deleted INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
     CREATE TABLE items (
        id TEXT PRIMARY KEY, project_id TEXT, type TEXT, created_by TEXT, updated_by TEXT,
        updated_at INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
     CREATE INDEX items_project ON items (project_id, type);
     CREATE INDEX items_title ON items (json_extract(data, '$.title'));
     CREATE INDEX items_key ON items (json_extract(data, '$.citationKey'));
     CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
     CREATE TABLE files (
        id TEXT PRIMARY KEY, hash TEXT NOT NULL, type TEXT, name TEXT, size INTEGER, created_at INTEGER);
     CREATE INDEX files_hash ON files (hash);
     CREATE TABLE changes (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, record_id TEXT NOT NULL,
        op TEXT NOT NULL, at INTEGER NOT NULL);`,
    // 2: sync with servers: changes know their project and where they came from; the projects synced, and where to
    `ALTER TABLE changes ADD COLUMN project_id TEXT;
     ALTER TABLE changes ADD COLUMN origin TEXT NOT NULL DEFAULT 'local';
     UPDATE changes SET project_id = record_id WHERE kind = 'project';
     UPDATE changes SET project_id = (SELECT project_id FROM items WHERE items.id = changes.record_id) WHERE kind = 'item';
     CREATE INDEX changes_project ON changes (project_id, seq);
     CREATE TABLE links (
        project_id TEXT PRIMARY KEY, server TEXT NOT NULL, key TEXT, pulled INTEGER NOT NULL DEFAULT 0,
        pushed INTEGER NOT NULL DEFAULT 0, synced_at INTEGER, error TEXT);`,
    // 3: edits that clashed while two devices couldn't sync (the one not kept, to bring back)
    `CREATE TABLE conflicts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, kind TEXT NOT NULL, record_id TEXT NOT NULL,
        kept TEXT, lost TEXT, lost_from TEXT NOT NULL, at INTEGER NOT NULL);
     CREATE INDEX conflicts_project ON conflicts (project_id);`,
];
// Later versions are added to the end of SCHEMA, each as the step from the one before. A database newer than
// this code is left alone (it was opened by a newer app): see open().
export const VERSION = SCHEMA.length;

const SETTING_KEYS = new Set(['library', 'settings']);
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const OK = { status: 200, body: { ok: true } };

export async function hashOf(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createPlace(sql, blobs) {
    // ---- one write at a time ----
    let last = Promise.resolve();
    const exclusive = fn => {
        const run = last.then(fn);
        last = run.catch(() => { });
        return run;
    };
    async function transaction(fn) {
        await sql.exec('BEGIN IMMEDIATE');
        try {
            const result = await fn();
            await sql.exec('COMMIT');
            return result;
        } catch (err) {
            await sql.exec('ROLLBACK');
            throw err;
        }
    }
    const write = fn => exclusive(() => transaction(fn));
    const changed = (kind, id, op, projectId = null, origin = 'local') => sql.run(
        'INSERT INTO changes (kind, record_id, op, at, project_id, origin) VALUES (?, ?, ?, ?, ?, ?)', [kind, id, op, Date.now(), projectId, origin]);

    // ---- the tables, created or brought up to date ----
    const { user_version: version } = await sql.get('PRAGMA user_version');
    if (version > VERSION) throw new Error(`This data was saved by a newer version of Research Board (format ${version}; this one knows ${VERSION}). Update the app to open it.`);
    if (version < VERSION) {
        await exclusive(() => transaction(async () => {
            for (let v = version; v < VERSION; v++) await sql.exec(SCHEMA[v]);
            await sql.exec(`PRAGMA user_version = ${VERSION}`);
        }));
    }

    // ---- reading ----

    async function boot() {
        const projects = (await sql.all('SELECT data FROM projects WHERE deleted = 0 ORDER BY position')).map(r => JSON.parse(r.data));
        const items = (await sql.all('SELECT data FROM items WHERE deleted = 0 ORDER BY rowid')).map(r => JSON.parse(r.data));
        const settings = Object.fromEntries((await sql.all('SELECT key, value FROM settings')).map(r => [r.key, JSON.parse(r.value)]));
        return { projects, items, library: settings.library || {}, settings: settings.settings ?? null };
    }

    // nothing has ever been saved here (a new place: the app then offers to bring in a browser's data)
    async function isEmpty() {
        const row = await sql.get('SELECT (SELECT count(*) FROM projects) + (SELECT count(*) FROM items) + (SELECT count(*) FROM settings WHERE key = ?) AS n', ['settings']);
        return !row.n;
    }

    // what changed after `seq` (the last one a copy has seen): [{ seq, kind, id, op }]
    async function changesSince(seq = 0) {
        return (await sql.all('SELECT seq, kind, record_id AS id, op FROM changes WHERE seq > ? ORDER BY seq', [seq]));
    }

    // ---- items ----

    // the whole item; one older than what's here (sent late, e.g. by a page that was offline) is ignored
    const saveItem = item => write(async () => {
        const current = await sql.get('SELECT updated_at FROM items WHERE id = ?', [item.id]);
        if (current && current.updated_at > (item.updatedAt || 0)) return { kept: 'newer' };
        await sql.run(`INSERT INTO items (id, project_id, type, created_by, updated_by, updated_at, deleted, data)
                       VALUES (?, ?, ?, ?, ?, ?, 0, ?)
                       ON CONFLICT (id) DO UPDATE SET project_id = excluded.project_id, type = excluded.type,
                         updated_by = excluded.updated_by, updated_at = excluded.updated_at, deleted = 0, data = excluded.data`,
            [item.id, item.projectId ?? null, item.type ?? null, item.createdBy ?? null, item.updatedBy ?? null, item.updatedAt || 0, JSON.stringify(item)]);
        await changed('item', item.id, 'put', item.projectId ?? null);
        return {};
    });

    const deleteItem = id => write(async () => {
        const row = await sql.get('SELECT project_id FROM items WHERE id = ?', [id]);
        await sql.run('UPDATE items SET deleted = 1, updated_at = ?, data = ? WHERE id = ?', [Date.now(), '{}', id]);
        await changed('item', id, 'delete', row?.project_id ?? null);
    });

    // ---- projects (new ones go first) ----

    const saveProject = project => write(async () => {
        const current = await sql.get('SELECT position FROM projects WHERE id = ?', [project.id]);
        const position = current?.position ?? ((await sql.get('SELECT min(position) AS p FROM projects')).p ?? 1) - 1;
        await sql.run(`INSERT INTO projects (id, position, updated_at, deleted, data) VALUES (?, ?, ?, 0, ?)
                       ON CONFLICT (id) DO UPDATE SET updated_at = excluded.updated_at, deleted = 0, data = excluded.data`,
            [project.id, position, Date.now(), JSON.stringify(project)]);
        await changed('project', project.id, 'put', project.id);
    });

    const deleteProject = id => write(async () => {
        await sql.run('UPDATE projects SET deleted = 1, updated_at = ?, data = ? WHERE id = ?', [Date.now(), '{}', id]);
        await changed('project', id, 'delete', id);
    });

    // ---- settings: the library's, and the theme, style and colours ----

    const saveSetting = (key, value) => write(async () => {
        if (!SETTING_KEYS.has(key)) throw new Error('unknown setting ' + key);
        await sql.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [key, JSON.stringify(value ?? null)]);
        await changed('setting', key, 'put');
    });

    // ---- files ----

    // bytes first, then the record: a crash in between leaves an unused blob, never a record without its bytes
    async function putFile(id, bytes, { type = '', name = '' } = {}) {
        const hash = await hashOf(bytes);
        await blobs.put(hash, bytes);
        await write(async () => {
            const old = await sql.get('SELECT hash FROM files WHERE id = ?', [id]);
            await sql.run(`INSERT INTO files (id, hash, type, name, size, created_at) VALUES (?, ?, ?, ?, ?, ?)
                           ON CONFLICT (id) DO UPDATE SET hash = excluded.hash, type = excluded.type, name = excluded.name, size = excluded.size`,
                [id, hash, type || 'application/octet-stream', name || '', bytes.byteLength, Date.now()]);
            await changed('file', id, 'put');
            if (old && old.hash !== hash) await dropUnused(old.hash);
        });
        return hash;
    }

    // { bytes, type, name, hash } or undefined
    async function getFile(id) {
        const row = await sql.get('SELECT hash, type, name FROM files WHERE id = ?', [id]);
        if (!row) return undefined;
        const bytes = await blobs.get(row.hash);
        return bytes && { bytes, type: row.type, name: row.name, hash: row.hash };
    }

    const deleteFile = id => write(async () => {
        const row = await sql.get('SELECT hash FROM files WHERE id = ?', [id]);
        if (!row) return;
        await sql.run('DELETE FROM files WHERE id = ?', [id]);
        await changed('file', id, 'delete');
        await dropUnused(row.hash);
    });

    async function dropUnused(hash) {
        if (!(await sql.get('SELECT 1 AS used FROM files WHERE hash = ?', [hash]))) await blobs.delete(hash);
    }

    // ---- everything at once ----

    // Replaces everything with { projects, items, library, settings } (a backup without its files: those are
    // added with putFile). Files whose records go are removed too.
    async function replaceAll({ projects = [], items = [], library = {}, settings = null } = {}) {
        const hashes = (await sql.all('SELECT DISTINCT hash FROM files')).map(r => r.hash);
        await write(async () => {
            for (const table of ['projects', 'items', 'settings', 'files']) await sql.run(`DELETE FROM ${table}`);
            let position = 0;
            for (const p of projects) {
                await sql.run('INSERT INTO projects (id, position, updated_at, data) VALUES (?, ?, ?, ?)', [p.id, position++, Date.now(), JSON.stringify(p)]);
            }
            for (const i of items) {
                await sql.run('INSERT OR REPLACE INTO items (id, project_id, type, created_by, updated_by, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [i.id, i.projectId ?? null, i.type ?? null, i.createdBy ?? null, i.updatedBy ?? null, i.updatedAt || 0, JSON.stringify(i)]);
            }
            await sql.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['library', JSON.stringify(library || {})]);
            if (settings != null) await sql.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['settings', JSON.stringify(settings)]);
            await changed('all', '*', 'replace');
            // what synced projects had sent and seen no longer describes what's here: all of it goes again
            await sql.run('UPDATE links SET pulled = 0, pushed = 0');
        });
        for (const hash of hashes) await blobs.delete(hash);
    }

    const clearAll = () => replaceAll();

    // a backup in Settings' format, files included (as data: URLs)
    async function restore(backup) {
        if (backup?.app !== 'research-board' || !Array.isArray(backup.projects) || !Array.isArray(backup.items)) {
            return { status: 400, body: { error: 'this isn\'t a Research Board backup' } };
        }
        await replaceAll(backup);
        for (const [id, file] of Object.entries(backup.files || {})) {
            if (!ID.test(id)) continue;
            const base64 = String(file.data || '').replace(/^data:[^,]*,/, '');
            await putFile(id, Uint8Array.from(atob(base64), c => c.charCodeAt(0)), file);
        }
        return OK;
    }

    // ---- sync: a project kept in step between two places (sync.js runs it; both places answer the same) ----
    //
    // A change, as one place gives it to another: { kind: 'project' | 'item', id, op: 'put' | 'delete', updatedAt,
    // record } (record: the whole project or item; none for a delete). The newer edit wins, record by record.

    const fromRow = kind => row => ({
        kind, id: row.id, op: row.deleted ? 'delete' : 'put', updatedAt: row.updated_at,
        ...(row.deleted ? {} : { record: JSON.parse(row.data) }),
    });

    // the projects here (what a server offers to a device that connects)
    async function syncProjects() {
        return (await sql.all('SELECT id, updated_at, data FROM projects WHERE deleted = 0 ORDER BY position'))
            .map(row => ({ id: row.id, title: JSON.parse(row.data).title || '', updatedAt: row.updated_at }));
    }

    // The project's records changed after change `since` (all of them from 0, deleted markers included), and the
    // number of the last change looked at, for next time. onlyLocal: leave out what sync itself brought here (it
    // came from the server: sending it back is pointless).
    // skip: a place's id (placeId): changes it sent here itself are left out (they're its own, coming back).
    async function syncChanges(projectId, since = 0, onlyLocal = false, skip = '') {
        const seq = (await sql.get('SELECT coalesce(max(seq), 0) AS seq FROM changes')).seq;
        // everything here was replaced (a restore) after `since`: nothing older can be built on
        if (since && await sql.get("SELECT 1 AS reset FROM changes WHERE kind = 'all' AND seq > ?", [since])) since = 0;
        let projects, items;
        if (!since) {
            projects = await sql.all('SELECT id, updated_at, deleted, data FROM projects WHERE id = ?', [projectId]);
            items = await sql.all('SELECT id, updated_at, deleted, data FROM items WHERE project_id = ? ORDER BY rowid', [projectId]);
        } else {
            const rows = await sql.all(`SELECT DISTINCT kind, record_id AS id FROM changes
                                        WHERE project_id = ? AND seq > ? AND seq <= ? AND kind IN ('project', 'item')
                                        ${onlyLocal ? "AND origin = 'local'" : ''} ${skip ? 'AND origin != ?' : ''}`,
                [projectId, since, seq, ...(skip ? ['sync:' + skip] : [])]);
            projects = [];
            items = [];
            for (const { kind, id } of rows) {
                const row = kind === 'project'
                    ? await sql.get('SELECT id, updated_at, deleted, data, id AS project_id FROM projects WHERE id = ?', [id])
                    : await sql.get('SELECT id, updated_at, deleted, data, project_id FROM items WHERE id = ?', [id]);
                if (row && row.project_id === projectId) (kind === 'project' ? projects : items).push(row); // (an item since moved elsewhere: no)
            }
        }
        return { seq, changes: [...projects.map(fromRow('project')), ...items.map(fromRow('item'))] };
    }

    // a change from elsewhere, if it's newer than what's here (and not the same thing again)
    const isNewer = (current, change) => {
        if (!current) return true;
        const at = Number(change.updatedAt) || 0;
        if (current.updated_at !== at) return current.updated_at < at;
        return change.op === 'delete' ? !current.deleted : (!!current.deleted || current.data !== JSON.stringify(change.record));
    };

    // Takes another place's changes to the project (syncChanges' format). Each is checked: it must belong to this
    // project, and an item can't be taken over from another project here. Returns how many were newer and kept.
    // unsentSince (a device taking the server's changes: its link's `pushed`): a change to a record also edited
    // here since then, and not sent yet, is a clash. The newer edit still wins; the other is kept in `conflicts`.
    // source: the sending place's id, kept on each change (origin 'sync:<id>') so it isn't sent back to it.
    const applySync = (projectId, changes = [], unsentSince = null, source = '') => write(async () => {
        let applied = 0;
        const clash = async (kind, id, current, change) => {
            if (unsentSince == null || !current) return;
            const editedHere = await sql.get("SELECT 1 AS edited FROM changes WHERE kind = ? AND record_id = ? AND origin = 'local' AND seq > ?", [kind, id, unsentSince]);
            if (!editedHere) return;
            const here = current.deleted ? null : current.data;
            const there = change.op === 'delete' ? null : JSON.stringify(change.record);
            if (here === there) return;
            const theirsWins = isNewer(current, change);
            const [kept, lost] = theirsWins ? [there, here] : [here, there];
            if (await sql.get('SELECT 1 AS known FROM conflicts WHERE record_id = ? AND lost IS ?', [id, lost])) return;
            await sql.run('INSERT INTO conflicts (project_id, kind, record_id, kept, lost, lost_from, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [projectId, kind, id, kept, lost, theirsWins ? 'here' : 'elsewhere', Date.now()]);
        };
        for (const change of changes) {
            const { kind, id, op, record } = change || {};
            const at = Number(change?.updatedAt) || 0;
            if (!ID.test(id) || (op !== 'put' && op !== 'delete')) continue;
            if (op === 'put' && (typeof record !== 'object' || record?.id !== id)) continue;
            if (kind === 'project') {
                if (id !== projectId) continue;
                const current = await sql.get('SELECT position, updated_at, deleted, data FROM projects WHERE id = ?', [id]);
                await clash('project', id, current, change);
                if (!isNewer(current, change)) continue;
                const position = current?.position ?? ((await sql.get('SELECT min(position) AS p FROM projects')).p ?? 1) - 1;
                await sql.run(`INSERT INTO projects (id, position, updated_at, deleted, data) VALUES (?, ?, ?, ?, ?)
                               ON CONFLICT (id) DO UPDATE SET updated_at = excluded.updated_at, deleted = excluded.deleted, data = excluded.data`,
                    [id, position, at, op === 'delete' ? 1 : 0, op === 'delete' ? '{}' : JSON.stringify(record)]);
            } else if (kind === 'item') {
                if (op === 'put' && record.projectId !== projectId) continue;
                const current = await sql.get('SELECT project_id, updated_at, deleted, data FROM items WHERE id = ?', [id]);
                if (current && current.project_id !== projectId) continue;
                await clash('item', id, current, change);
                if (!isNewer(current, change)) continue;
                if (op === 'delete') {
                    await sql.run(`INSERT INTO items (id, project_id, updated_at, deleted, data) VALUES (?, ?, ?, 1, '{}')
                                   ON CONFLICT (id) DO UPDATE SET updated_at = excluded.updated_at, deleted = 1, data = '{}'`, [id, projectId, at]);
                } else {
                    await sql.run(`INSERT INTO items (id, project_id, type, created_by, updated_by, updated_at, deleted, data)
                                   VALUES (?, ?, ?, ?, ?, ?, 0, ?)
                                   ON CONFLICT (id) DO UPDATE SET type = excluded.type, updated_by = excluded.updated_by,
                                     updated_at = excluded.updated_at, deleted = 0, data = excluded.data`,
                        [id, projectId, record.type ?? null, record.createdBy ?? null, record.updatedBy ?? null, at, JSON.stringify(record)]);
                }
            } else continue;
            await changed(kind, id, op, projectId, source ? 'sync:' + source : 'sync');
            applied++;
        }
        return applied;
    });

    // the files the project uses (its picture, materials' PDFs, images in notes) that are kept here
    async function syncFiles(projectId) {
        const rows = [
            ...await sql.all('SELECT data FROM projects WHERE id = ? AND deleted = 0', [projectId]),
            ...await sql.all('SELECT data FROM items WHERE project_id = ? AND deleted = 0', [projectId]),
        ];
        const ids = new Set();
        for (const { data } of rows) {
            for (const [, id] of data.matchAll(/asset:([A-Za-z0-9_-]{1,64})/g)) ids.add(id);
            for (const [, id] of data.matchAll(/"assetId":"([A-Za-z0-9_-]{1,64})"/g)) ids.add(id);
        }
        const kept = [];
        for (const id of ids) if (await sql.get('SELECT 1 AS kept FROM files WHERE id = ?', [id])) kept.push(id);
        return kept;
    }

    // this place's lasting id (made the first time it's asked for): how a server tells its changes from others'
    async function placeId() {
        const row = await sql.get("SELECT value FROM settings WHERE key = 'place'");
        if (row) return JSON.parse(row.value);
        const id = [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('');
        await write(() => sql.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('place', ?)", [JSON.stringify(id)]));
        return JSON.parse((await sql.get("SELECT value FROM settings WHERE key = 'place'")).value);
    }

    // ---- conflicts: edits that clashed (see applySync) ----

    // [{ id, projectId, kind, recordId, kept, lost, lostFrom: 'here' | 'elsewhere', at }] (kept / lost: the record,
    // or null where that side was a delete); for one project, or all
    async function getConflicts(projectId) {
        const rows = projectId ? await sql.all('SELECT * FROM conflicts WHERE project_id = ? ORDER BY id', [projectId]) : await sql.all('SELECT * FROM conflicts ORDER BY id');
        return rows.map(r => ({
            id: r.id, projectId: r.project_id, kind: r.kind, recordId: r.record_id,
            kept: r.kept ? JSON.parse(r.kept) : null, lost: r.lost ? JSON.parse(r.lost) : null, lostFrom: r.lost_from, at: r.at,
        }));
    }

    // the version that wasn't kept brought back, as a new edit made here now (it then syncs like any edit)
    async function restoreConflict(conflictId) {
        const row = await sql.get('SELECT * FROM conflicts WHERE id = ?', [Number(conflictId)]);
        if (!row) return false;
        const lost = row.lost ? JSON.parse(row.lost) : null;
        if (row.kind === 'item') {
            if (lost) await saveItem({ ...lost, updatedAt: Math.max(Date.now(), (await sql.get('SELECT updated_at FROM items WHERE id = ?', [row.record_id]))?.updated_at + 1 || 0) });
            else await deleteItem(row.record_id);
        } else if (row.kind === 'project') {
            if (lost) await saveProject(lost);
            else await deleteProject(row.record_id);
        }
        await write(() => sql.run('DELETE FROM conflicts WHERE id = ?', [row.id]));
        return true;
    }

    const dismissConflict = conflictId => write(() => sql.run('DELETE FROM conflicts WHERE id = ?', [Number(conflictId)]));

    // ---- links: which projects here are synced with which server (kept on the device, for sync.js) ----

    async function getLinks() {
        return (await sql.all('SELECT * FROM links')).map(row => ({
            projectId: row.project_id, server: row.server, key: row.key || '', pulled: row.pulled, pushed: row.pushed,
            syncedAt: row.synced_at, error: row.error,
        }));
    }

    // fields: any of { server, key, pulled, pushed, syncedAt, error }; a new link needs `server`
    const setLink = (projectId, fields = {}) => write(async () => {
        const current = (await getLinks()).find(l => l.projectId === projectId);
        const link = { pulled: 0, pushed: 0, key: '', syncedAt: null, error: null, ...current, ...fields };
        if (!link.server) throw new Error("a link needs the server's address");
        await sql.run('INSERT OR REPLACE INTO links (project_id, server, key, pulled, pushed, synced_at, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [projectId, String(link.server), String(link.key || ''), Number(link.pulled) || 0, Number(link.pushed) || 0, link.syncedAt ?? null, link.error ?? null]);
    });

    const deleteLink = projectId => write(() => sql.run('DELETE FROM links WHERE project_id = ?', [projectId]));

    // ---- the API (apps/server/README.md), answered the same by the server and inside the apps ----

    // path: 'items/<id>', 'files/<id>'…, without /api/. body: the JSON sent, or for a file { bytes, type, name }.
    // Returns { status, body } (JSON) or { status, file: { bytes, type, name } }.
    async function request(method, path, body) {
        const [kind, id = '', sub = ''] = path.split('?')[0].split('/');
        const query = new URLSearchParams(path.split('?')[1] || '');
        const hasId = ID.test(id);
        const mismatch = what => ({ status: 400, body: { error: `the ${what}'s id must match the address` } });

        if (kind === 'boot' && method === 'GET') return { status: 200, body: { data: await boot(), empty: await isEmpty() } };
        if (kind === 'health') return OK;
        if (kind === 'changes' && method === 'GET') return { status: 200, body: { changes: await changesSince(Number(query.get('since')) || 0) } };
        if (kind === 'items' && hasId && method === 'PUT') {
            if (body?.id !== id) return mismatch('item');
            const { kept } = await saveItem(body);
            return kept ? { status: 200, body: { ok: true, kept } } : OK;
        }
        if (kind === 'items' && hasId && method === 'DELETE') return (await deleteItem(id), OK);
        if (kind === 'projects' && hasId && method === 'PUT') return body?.id !== id ? mismatch('project') : (await saveProject(body), OK);
        if (kind === 'projects' && hasId && method === 'DELETE') return (await deleteProject(id), OK);
        if (kind === 'kv' && SETTING_KEYS.has(id) && method === 'PUT') return (await saveSetting(id, body), OK);
        if (kind === 'files' && hasId && method === 'PUT') return (await putFile(id, body.bytes, body), OK);
        if (kind === 'files' && hasId && method === 'GET') {
            const file = await getFile(id);
            return file ? { status: 200, file } : { status: 404, body: { error: 'no such file' } };
        }
        if (kind === 'files' && hasId && method === 'DELETE') return (await deleteFile(id), OK);
        if (kind === 'sync' && !id && method === 'GET') return { status: 200, body: { projects: await syncProjects() } };
        if (kind === 'sync' && hasId && sub === 'files' && method === 'GET') return { status: 200, body: { files: await syncFiles(id) } };
        if (kind === 'sync' && hasId && !sub && method === 'GET') {
            return { status: 200, body: await syncChanges(id, Number(query.get('since')) || 0, query.get('origin') === 'local', ID.test(query.get('skip') || '') ? query.get('skip') : '') };
        }
        if (kind === 'sync' && hasId && !sub && method === 'POST') {
            if (!Array.isArray(body?.changes)) return { status: 400, body: { error: 'send { changes: [...] }' } };
            const unsentSince = Number.isInteger(body.unsentSince) ? body.unsentSince : null;
            const source = ID.test(body.source || '') ? body.source : '';
            return { status: 200, body: { applied: await applySync(id, body.changes, unsentSince, source) } };
        }
        if (kind === 'place' && method === 'GET') return { status: 200, body: { id: await placeId() } };
        if (kind === 'conflicts' && !id && method === 'GET') return { status: 200, body: { conflicts: await getConflicts(query.get('project') || '') } };
        if (kind === 'conflicts' && /^\d+$/.test(id) && method === 'POST') return { status: 200, body: { ok: await restoreConflict(id) } };
        if (kind === 'conflicts' && /^\d+$/.test(id) && method === 'DELETE') return (await dismissConflict(id), OK);
        if (kind === 'links' && !id && method === 'GET') return { status: 200, body: { links: await getLinks() } };
        if (kind === 'links' && hasId && method === 'PUT') return (await setLink(id, body), OK);
        if (kind === 'links' && hasId && method === 'DELETE') return (await deleteLink(id), OK);
        if (kind === 'restore' && method === 'POST') return restore(body);
        if (kind === 'clear' && method === 'POST') return (await clearAll(), OK);
        return { status: 404, body: { error: 'unknown request' } };
    }

    return {
        request,
        boot, isEmpty, changesSince,
        saveItem, deleteItem, saveProject, deleteProject, saveSetting,
        putFile, getFile, deleteFile,
        replaceAll, clearAll, restore,
        syncProjects, syncChanges, applySync, syncFiles, getLinks, setLink, deleteLink,
        getConflicts, restoreConflict, dismissConflict, placeId,
    };
}

// A place's storage, written once for every platform: the server (apps/server/place-node.js), the desktop app
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
//   changes   seq, kind, record_id, op, at                        "changes since N", for syncing later
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
    const changed = (kind, id, op) => sql.run('INSERT INTO changes (kind, record_id, op, at) VALUES (?, ?, ?, ?)', [kind, id, op, Date.now()]);

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
        await changed('item', item.id, 'put');
        return {};
    });

    const deleteItem = id => write(async () => {
        await sql.run('UPDATE items SET deleted = 1, updated_at = ?, data = ? WHERE id = ?', [Date.now(), '{}', id]);
        await changed('item', id, 'delete');
    });

    // ---- projects (new ones go first) ----

    const saveProject = project => write(async () => {
        const current = await sql.get('SELECT position FROM projects WHERE id = ?', [project.id]);
        const position = current?.position ?? ((await sql.get('SELECT min(position) AS p FROM projects')).p ?? 1) - 1;
        await sql.run(`INSERT INTO projects (id, position, updated_at, deleted, data) VALUES (?, ?, ?, 0, ?)
                       ON CONFLICT (id) DO UPDATE SET updated_at = excluded.updated_at, deleted = 0, data = excluded.data`,
            [project.id, position, Date.now(), JSON.stringify(project)]);
        await changed('project', project.id, 'put');
    });

    const deleteProject = id => write(async () => {
        await sql.run('UPDATE projects SET deleted = 1, updated_at = ?, data = ? WHERE id = ?', [Date.now(), '{}', id]);
        await changed('project', id, 'delete');
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

    // ---- the API (apps/server/README.md), answered the same by the server and inside the apps ----

    // path: 'items/<id>', 'files/<id>'…, without /api/. body: the JSON sent, or for a file { bytes, type, name }.
    // Returns { status, body } (JSON) or { status, file: { bytes, type, name } }.
    async function request(method, path, body) {
        const [kind, id = ''] = path.split('?')[0].split('/');
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
    };
}

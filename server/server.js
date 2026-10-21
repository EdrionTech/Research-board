// Research Board's local server: serves the app (src/) and keeps your data in files on this computer,
// so nothing depends on the browser's storage (which is per address, and can be cleared or evicted).
//
//   data/research-board.json   projects, materials, notes… (rewritten whole, safely, a second after changes)
//   data/journal.ndjson        each change since then, written before the app is told it's saved and replayed
//                              on start, so a crash or a killed window loses nothing
//   data/files/<id>            uploaded PDFs, images, videos; data/files/<id>.json has each one's type and name
//
// Only Node.js, no packages: `node server/server.js` (start.bat / start.sh add --open: the browser opens on the
// app once the server is ready). Options (environment): PORT (5500), HOST (127.0.0.1: this computer only),
// DATA (the data folder). The API below is all the app needs, so a desktop or mobile version can reimplement it
// (see server/README.md).
//
//   GET    /api/health             { ok: true } when the server is up
//   GET    /api/boot.js            everything, as a script the pages load first (window.RB_SERVER)
//   PUT    /api/items/:id          save one item (the whole item)       DELETE /api/items/:id
//   PUT    /api/projects/:id       save one project (new ones go first)  DELETE /api/projects/:id
//   PUT    /api/kv/:key            library | settings (a whole object)
//   PUT    /api/files/:id          store a file (body: the file; X-File-Name)
//   GET    /api/files/:id          DELETE /api/files/:id
//   POST   /api/restore            replace everything with a backup (Settings' backup format, files included)
//   POST   /api/clear              delete everything

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const PORT = Number(process.env.PORT) || 5500;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = path.resolve(__dirname, '..', 'src');
const DATA = path.resolve(process.env.DATA || path.join(__dirname, '..', 'data'));
const FILES = path.join(DATA, 'files');
const DB_FILE = path.join(DATA, 'research-board.json');
const JOURNAL = path.join(DATA, 'journal.ndjson');

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const KV_KEYS = new Set(['library', 'settings']);
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

// ---- the records ----

fs.mkdirSync(FILES, { recursive: true });
const empty = () => ({ version: 1, projects: [], items: [], library: {}, settings: null });
let db = empty();
try {
    db = { ...empty(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
} catch (err) {
    if (err.code !== 'ENOENT') {
        // a damaged file is kept aside, never overwritten
        const aside = DB_FILE + '.damaged-' + Date.now();
        fs.copyFileSync(DB_FILE, aside);
        console.error(`Couldn't read ${DB_FILE} (${err.message}). Kept a copy at ${aside}; starting empty.`);
    }
}
// a fresh install has no record of having been used: the app then offers to bring in the browser's data
const isEmpty = () => !db.projects.length && !db.items.length && !db.settings;

// one change to the records (what the journal holds)
function apply(change) {
    const { op } = change;
    if (op === 'putItem') {
        const at = db.items.findIndex(i => i.id === change.item.id);
        if (at >= 0) db.items[at] = change.item;
        else db.items.push(change.item);
    } else if (op === 'deleteItem') {
        db.items = db.items.filter(i => i.id !== change.id);
    } else if (op === 'putProject') {
        const at = db.projects.findIndex(p => p.id === change.project.id);
        if (at >= 0) db.projects[at] = change.project;
        else db.projects.unshift(change.project);
    } else if (op === 'deleteProject') {
        db.projects = db.projects.filter(p => p.id !== change.id);
    } else if (op === 'kv') {
        db[change.key] = change.value;
    }
}

// changes left from last time (the server stopped before rewriting the data file): applied, then folded in
try {
    const lines = fs.readFileSync(JOURNAL, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
        try { apply(JSON.parse(line)); } catch { /* a line cut short by a crash: that change was never confirmed */ }
    }
    if (lines.length) console.log(`Recovered ${lines.length} change${lines.length === 1 ? '' : 's'} from the journal.`);
} catch { /* no journal */ }

// The whole file, written to a temporary file and renamed over the old one (a crash mid-write can't leave half
// a file), then the journal emptied. All in one go, so no change can slip in between.
let snapshotTimer = null;
function snapshot() {
    clearTimeout(snapshotTimer);
    snapshotTimer = null;
    fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db));
    fs.renameSync(DB_FILE + '.tmp', DB_FILE);
    fs.writeFileSync(JOURNAL, '');
}
snapshot();

// a change: into the journal first (kept even if the server is killed right after), the whole file a moment later
function record(change) {
    fs.appendFileSync(JOURNAL, JSON.stringify(change) + '\n');
    apply(change);
    snapshotTimer ??= setTimeout(() => {
        try { snapshot(); } catch (err) { console.error('Saving failed:', err.message); }
    }, 1000);
}

// ---- requests ----

const send = (res, status, body, type = 'application/json') => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = req => new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
});
const readJson = async req => JSON.parse((await readBody(req)).toString('utf8') || 'null');
const filePath = id => path.join(FILES, id);

async function putFile(id, buffer, type, name) {
    await fsp.writeFile(filePath(id) + '.tmp', buffer);
    await fsp.rename(filePath(id) + '.tmp', filePath(id));
    await fsp.writeFile(filePath(id) + '.json', JSON.stringify({ type: type || 'application/octet-stream', name: name || '' }));
}
async function deleteFile(id) {
    await fsp.rm(filePath(id), { force: true });
    await fsp.rm(filePath(id) + '.json', { force: true });
}
async function clearAll() {
    db = empty();
    snapshot();
    for (const name of await fsp.readdir(FILES)) await fsp.rm(path.join(FILES, name), { force: true });
}

async function api(req, res, parts) {
    const [kind, id] = parts;
    const method = req.method;

    if (kind === 'boot.js' && method === 'GET') {
        const payload = JSON.stringify({ data: { projects: db.projects, items: db.items, library: db.library, settings: db.settings }, empty: isEmpty(), dataDir: DATA });
        // as JS: the pages need it before anything else runs (</script> can't appear in JSON strings this way)
        return send(res, 200, `window.RB_SERVER = ${payload.replace(/</g, '\\u003c')};\n`, TYPES['.js']);
    }
    if (kind === 'health') return send(res, 200, { ok: true });

    if (kind === 'items' && ID.test(id || '')) {
        if (method === 'PUT') {
            const item = await readJson(req);
            if (!item || item.id !== id) return send(res, 400, { error: 'the item\'s id must match the address' });
            // a save older than what's here (sent late, e.g. by a page that was offline) doesn't undo the newer one
            const current = db.items.find(i => i.id === id);
            if (current && (current.updatedAt || 0) > (item.updatedAt || 0)) return send(res, 200, { ok: true, kept: 'newer' });
            record({ op: 'putItem', item });
            return send(res, 200, { ok: true });
        }
        if (method === 'DELETE') {
            record({ op: 'deleteItem', id });
            return send(res, 200, { ok: true });
        }
    }
    if (kind === 'projects' && ID.test(id || '')) {
        if (method === 'PUT') {
            const project = await readJson(req);
            if (!project || project.id !== id) return send(res, 400, { error: 'the project\'s id must match the address' });
            record({ op: 'putProject', project });
            return send(res, 200, { ok: true });
        }
        if (method === 'DELETE') {
            record({ op: 'deleteProject', id });
            return send(res, 200, { ok: true });
        }
    }
    if (kind === 'kv' && KV_KEYS.has(id) && method === 'PUT') {
        record({ op: 'kv', key: id, value: await readJson(req) });
        return send(res, 200, { ok: true });
    }
    if (kind === 'files' && ID.test(id || '')) {
        if (method === 'PUT') {
            const name = decodeURIComponent(req.headers['x-file-name'] || '');
            await putFile(id, await readBody(req), req.headers['content-type'], name);
            return send(res, 200, { ok: true });
        }
        if (method === 'GET') {
            let meta = {};
            try { meta = JSON.parse(await fsp.readFile(filePath(id) + '.json', 'utf8')); } catch { }
            try {
                const body = await fsp.readFile(filePath(id));
                res.writeHead(200, { 'Content-Type': meta.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(meta.name || ''), 'Cache-Control': 'no-store' });
                return res.end(body);
            } catch {
                return send(res, 404, { error: 'no such file' });
            }
        }
        if (method === 'DELETE') {
            await deleteFile(id);
            return send(res, 200, { ok: true });
        }
    }
    if (kind === 'restore' && method === 'POST') {
        const data = await readJson(req);
        if (data?.app !== 'research-board' || !Array.isArray(data.projects) || !Array.isArray(data.items)) {
            return send(res, 400, { error: 'this isn\'t a Research Board backup' });
        }
        await clearAll();
        db.projects = data.projects;
        db.items = data.items;
        db.library = data.library || {};
        db.settings = data.settings || null;
        snapshot();
        for (const [fileId, file] of Object.entries(data.files || {})) {
            if (!ID.test(fileId)) continue;
            const base64 = String(file.data || '').replace(/^data:[^,]*,/, '');
            await putFile(fileId, Buffer.from(base64, 'base64'), file.type, file.name);
        }
        return send(res, 200, { ok: true });
    }
    if (kind === 'clear' && method === 'POST') {
        await clearAll();
        return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'unknown request' });
}

// the app's own files, from src/ (never outside it)
async function serveStatic(req, res, pathname) {
    let file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'Not allowed', 'text/plain');
    try {
        if ((await fsp.stat(file)).isDirectory()) file = path.join(file, 'index.html');
        const body = await fsp.readFile(file);
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
        send(res, 404, 'Not found', 'text/plain');
    }
}

const server = http.createServer(async (req, res) => {
    try {
        const { pathname } = new URL(req.url, 'http://localhost');
        if (pathname.startsWith('/api/')) return await api(req, res, pathname.slice(5).split('/'));
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Not allowed', 'text/plain');
        return await serveStatic(req, res, pathname);
    } catch (err) {
        console.error(req.method, req.url, err.message);
        send(res, 500, { error: err.message });
    }
});

// always the same address: the browser keeps data per address, so a changing port is what lost data before
server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is in use (is Live Server or another copy running?). Stop it and start again,`
            + ` or choose a port with PORT=…  (the address must stay the same between runs).`);
    } else console.error(err.message);
    process.exit(1);
});
server.listen(PORT, HOST, () => {
    const address = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`;
    console.log(`Research Board: ${address}`);
    console.log(`Your data: ${DATA}`);
    console.log('Stop it with Ctrl + C (your changes are already saved).');
    // --open: the browser, now that there's something to show (opening it first could show an error page)
    if (process.argv.includes('--open')) {
        const [command, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', address]]
            : process.platform === 'darwin' ? ['open', [address]] : ['xdg-open', [address]];
        spawn(command, args, { stdio: 'ignore', detached: true }).on('error', () => console.log(`Open ${address} in your browser.`)).unref();
    }
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
        try { snapshot(); } catch (err) { console.error('Saving failed:', err.message); }
        process.exit(0);
    });
}

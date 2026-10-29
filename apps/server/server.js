// Research Board's local server: serves the app (src/) and keeps your data on this computer, so nothing depends
// on the browser's storage (which is per address, and can be cleared or evicted).
//
//   data/research-board.db     projects, materials, notes, settings… (SQLite: each change is saved whole or not at all)
//   data/files/<hash>          the bytes of uploaded PDFs, images, videos, named by their content (kept once)
//
// The storage itself is shared with the desktop and phone apps: src/script/core/place/place.js, given Node's
// SQLite and the files folder by place-node.js. This file is only the requests.
//
// Node.js 22.13 or newer, no packages: `node apps/server/server.js` (start.bat / start.sh add --open: the browser
// opens on the app once the server is ready). Options (environment): PORT (5500), HOST (127.0.0.1: this computer
// only), DATA (the data folder). The API below is all the app needs (see README.md here).
//
//   GET    /api/health             { ok: true } when the server is up
//   GET    /api/boot               everything: { data: { projects, items, library, settings }, empty, dataDir }
//   GET    /api/changes?since=N    what changed after change N: { changes: [{ seq, kind, id, op }] }
//   PUT    /api/items/:id          save one item (the whole item)       DELETE /api/items/:id
//   PUT    /api/projects/:id       save one project (new ones go first)  DELETE /api/projects/:id
//   PUT    /api/kv/:key            library | settings (a whole object)
//   PUT    /api/files/:id          store a file (body: the file; X-File-Name)
//   GET    /api/files/:id          DELETE /api/files/:id
//   POST   /api/restore            replace everything with a backup (Settings' backup format, files included)
//   POST   /api/clear              delete everything

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
    console.error(`Research Board's server needs Node.js 22.13 or newer (this is ${process.versions.node}): https://nodejs.org`);
    process.exit(1);
}

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { APP, openNodePlace } = require('./place-node');

const PORT = Number(process.env.PORT) || 5500;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = path.join(APP, 'src');
const DATA = path.resolve(process.env.DATA || path.join(APP, 'data'));

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

// ---- the data kept before SQLite (research-board.json, journal.ndjson, files/<id> + .json) ----

// Brought into the new database once, then moved to data/before-sqlite/ (kept, never deleted).
async function convertOldData(place) {
    const oldFile = path.join(DATA, 'research-board.json');
    if (!fs.existsSync(oldFile)) return;
    if (!(await place.isEmpty())) {
        console.log(`Left ${oldFile} alone: research-board.db already has data. To bring it in instead, stop the server and move research-board.db aside.`);
        return;
    }
    const old = { projects: [], items: [], library: {}, settings: null, ...JSON.parse(await fsp.readFile(oldFile, 'utf8')) };

    // changes the old server hadn't folded into the file yet
    const journal = path.join(DATA, 'journal.ndjson');
    for (const line of (fs.existsSync(journal) ? await fsp.readFile(journal, 'utf8') : '').split('\n').filter(Boolean)) {
        let change;
        try { change = JSON.parse(line); } catch { continue; } // a line cut short by a crash was never confirmed
        const { op } = change;
        if (op === 'putItem') old.items = [...old.items.filter(i => i.id !== change.item.id), change.item];
        else if (op === 'deleteItem') old.items = old.items.filter(i => i.id !== change.id);
        else if (op === 'putProject') {
            const at = old.projects.findIndex(p => p.id === change.project.id);
            if (at >= 0) old.projects[at] = change.project;
            else old.projects.unshift(change.project);
        } else if (op === 'deleteProject') old.projects = old.projects.filter(p => p.id !== change.id);
        else if (op === 'kv') old[change.key] = change.value;
    }

    await place.replaceAll(old);
    const oldFiles = path.join(DATA, 'files');
    const names = fs.existsSync(oldFiles) ? await fsp.readdir(oldFiles) : [];
    const ids = names.filter(name => ID.test(name) && names.includes(name + '.json'));
    for (const id of ids) {
        let meta = {};
        try { meta = JSON.parse(await fsp.readFile(path.join(oldFiles, id + '.json'), 'utf8')); } catch { }
        await place.putFile(id, new Uint8Array(await fsp.readFile(path.join(oldFiles, id))), meta);
    }

    const aside = path.join(DATA, 'before-sqlite');
    await fsp.mkdir(path.join(aside, 'files'), { recursive: true });
    for (const name of ['research-board.json', 'journal.ndjson']) {
        if (fs.existsSync(path.join(DATA, name))) await fsp.rename(path.join(DATA, name), path.join(aside, name));
    }
    for (const id of ids) {
        for (const name of [id, id + '.json']) await fsp.rename(path.join(oldFiles, name), path.join(aside, 'files', name));
    }
    const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    console.log(`Moved your data into research-board.db (${count(old.projects.length, 'project')}, ${count(old.items.length, 'item')}, ${count(ids.length, 'file')}).`
        + ` The old files are kept in ${aside}.`);
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

// the requests are answered by place.js (the same code answers them inside the apps); this turns HTTP into its terms
async function api(place, req, res, route) {
    const method = req.method;
    let body;
    if (route.startsWith('files/') && method === 'PUT') {
        body = { bytes: new Uint8Array(await readBody(req)), type: req.headers['content-type'], name: decodeURIComponent(req.headers['x-file-name'] || '') };
    } else if (method === 'PUT' || method === 'POST') {
        body = await readJson(req);
    }
    const answer = await place.request(method, route, body);
    if (answer.file) {
        res.writeHead(200, { 'Content-Type': answer.file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(answer.file.name || ''), 'Cache-Control': 'no-store' });
        return res.end(answer.file.bytes);
    }
    if (route === 'boot' && answer.body?.data) answer.body.dataDir = DATA;
    return send(res, answer.status, answer.body);
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

async function start() {
    fs.mkdirSync(DATA, { recursive: true });
    const place = await openNodePlace(DATA);
    await convertOldData(place);

    const server = http.createServer(async (req, res) => {
        try {
            const { pathname, search } = new URL(req.url, 'http://localhost');
            if (pathname.startsWith('/api/')) return await api(place, req, res, pathname.slice(5) + search);
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

    // every change is already in the database; closing it folds the write-ahead log back in
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
        process.on(signal, () => {
            try { place.close(); } catch { }
            process.exit(0);
        });
    }
}

start().catch(err => {
    console.error(`Research Board couldn't start: ${err.message}`);
    process.exit(1);
});

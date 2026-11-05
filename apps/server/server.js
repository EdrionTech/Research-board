// Research Board's local server: serves the app (src/) and keeps your data on this computer, so nothing depends
// on the browser's storage (which is per address, and can be cleared or evicted).
//
//   data/research-board.db     projects, materials, notes, settings… (SQLite: each change is saved whole or not at all)
//   data/files/<hash>          the bytes of uploaded PDFs, images, videos, named by their content (kept once)
//
// The storage itself is shared with the desktop and phone apps: src/script/core/place/place.js, given Bun's
// SQLite and the files folder by place-bun.js. This file is only the requests.
//
// Bun (https://bun.sh), no packages: `bun apps/server/server.js` (start.bat / start.sh add --open: the browser
// opens on the app once the server is ready). Options (environment): PORT (5500), HOST (127.0.0.1: this computer
// only), DATA (the data folder), KEY (the server's access key: see "Access" below). The API below is all the app
// needs (see README.md here).
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
//   GET    /api/sync               the projects here, for a device to choose from: { projects: [{ id, title }] }
//   GET    /api/sync/:project?since=N   the project's records changed after change N: { seq, changes }
//   POST   /api/sync/:project      { changes }: another place's changes to the project, newer edits kept
//   GET    /api/sync/:project/files     the project's files kept here: { files: [ids] }
//
// Access (access.js): a server reachable from other computers (HOST other than 127.0.0.1, or --public / --proxy)
// needs a key with every /api/ request (Authorization: Bearer <key>), except /api/health and /api/invite: its main
// key (KEY, or made on the first such start and kept in <DATA>/server-key.txt), or a device's own key, which an
// invite gives it (POST /api/invite). On this computer only, no key is asked for unless KEY is set. The control
// page (src/page/server.html, /api/admin: the main key only) shows invites as QR codes, the devices (each can be
// removed), a new main key, and the settings (hosting.js). Accounts and roles come later (platforms.md).
// Wrong keys: an address that sends 10 within 10 minutes is refused for 15 minutes. Uploads: MAX_UPLOAD_MB (500).
//
// Reached from the internet:
//   --public   a temporary https://….trycloudflare.com address (tunnel.js), for testing from anywhere. Its data
//              folder is data-public/ unless DATA is given, so your own projects aren't on it.
//   --proxy    behind your own HTTPS proxy on this machine (a VPS: apps/server/vps-setup.sh puts Caddy in front).
// In both, the server listens on 127.0.0.1 only, always asks for the key, and takes the visitor's address from the
// proxy's header (for the wrong-key limit).

if (!process.versions.bun) {
    console.error("Research Board's server runs on Bun, not Node.js: bun apps/server/server.js (install Bun from https://bun.sh)");
    process.exit(1);
}

const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { APP, openServerPlace } = require('./place-bun');
const { createAccess } = require('./access');

const PUBLIC = process.argv.includes('--public'); // a tunnel (tunnel.js)
const PROXIED = PUBLIC || process.argv.includes('--proxy'); // requests come through a proxy on this machine
const PORT = Number(process.env.PORT) || 5500;
const HOST = PROXIED ? '127.0.0.1' : process.env.HOST || '127.0.0.1';
const ROOT = path.join(APP, 'src');
const DATA = path.resolve(process.env.DATA || path.join(APP, PUBLIC ? 'data-public' : 'data'));
const MAX_UPLOAD = (Number(process.env.MAX_UPLOAD_MB) || 500) * 1048576;

const LOCAL_ONLY = ['127.0.0.1', 'localhost', '::1'].includes(HOST) && !PROXIED;

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

// ---- access ----

// this server's lasting id (kept in its data folder) and a name to show
let identity = null;
function serverInfo() {
    if (!identity) {
        const file = path.join(DATA, 'server-id.txt');
        let id = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
        if (!id) fs.writeFileSync(file, (id = crypto.randomBytes(12).toString('base64url')) + '\n');
        identity = { id, name: require('os').hostname() };
    }
    return identity;
}

// Who may use it (access.js): the main key, a key per device, invites. Created in start(), once DATA exists.
let access = null;

// The addresses devices use (for invite links), found at start: [{ label, base }]
let addresses = [];

// an invite in the server's window: a QR code and the link (for the first address)
function showInvite() {
    if (!addresses.length) return console.log('(No address other devices can use: no invite to show.)');
    const { token, minutes } = access.newInvite({ uses: 1, minutes: 20, by: "the server's window" });
    const link = `${addresses[0].base}/#invite=${token}`;
    console.log('\nAdd a device: scan this in Research Board (Settings > Sync with a server > Scan QR code),');
    console.log(`or paste the link below there. It adds one device, within ${minutes} minutes.\n`);
    console.log(require('./qr').terminalQr(link));
    console.log(`\n  ${link}\n`);
    console.log('More devices, removing one, a new key, settings: the control page (a + Enter opens it). i + Enter: another invite.\n');
}

// the control page, in this computer's browser (its key in the address's #, which the browser never sends)
function openControlPage() {
    const page = `http://localhost:${PORT}/page/server.html#key=${encodeURIComponent(access.key)}`;
    const [command, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', page.replace(/&/g, '^&')]]
        : process.platform === 'darwin' ? ['open', [page]] : ['xdg-open', [page]];
    spawn(command, args, { stdio: 'ignore', detached: true }).on('error', () => console.log(`Open the control page: ${page}`)).unref();
}

// typed in the server's window: i + Enter, another invite; a + Enter, the control page
if (process.stdin.isTTY) {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', line => {
        if (!access?.required) return;
        if (/^\s*i\s*$/i.test(line)) showInvite();
        else if (/^\s*a\s*$/i.test(line)) openControlPage();
    });
}

// who's asking: behind a proxy on this machine, the address it passes on (Cloudflare's, or Caddy's header)
function clientOf(req) {
    const direct = req.socket.remoteAddress || '';
    if (!PROXIED || !/^(::ffff:)?127\.|^::1$/.test(direct)) return direct;
    // only the header that proxy sets itself (a visitor's own copy of the other one could be anything)
    const forwarded = PUBLIC ? req.headers['cf-connecting-ip'] : String(req.headers['x-forwarded-for'] || '').split(',').at(-1);
    return String(forwarded || direct).trim();
}

// wrong keys: 10 from one address within 10 minutes, and it's refused for 15 minutes
const wrongKeys = new Map(); // address → { count, since, blockedUntil }
function blocked(client) {
    const entry = wrongKeys.get(client);
    return !!entry && entry.blockedUntil > Date.now();
}
function wrongKey(client) {
    const now = Date.now();
    let entry = wrongKeys.get(client);
    if (!entry || now - entry.since > 10 * 60000) entry = { count: 0, since: now, blockedUntil: 0 };
    entry.count++;
    if (entry.count >= 10) {
        entry.blockedUntil = now + 15 * 60000;
        console.log(`Refusing ${client} for 15 minutes: 10 wrong keys.`);
    }
    wrongKeys.set(client, entry);
    if (wrongKeys.size > 10000) for (const [k, e] of wrongKeys) if (now - e.since > 30 * 60000) wrongKeys.delete(k);
}

// Pages from elsewhere may call the API: the desktop and phone apps (their own addresses), and, once a key is
// needed, any page holding the key. Without a key, other websites open in your browser can't.
const APP_ORIGINS = new Set(['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost', 'https://localhost', 'capacitor://localhost']);
function crossOrigin(req, res, keyed) {
    const origin = req.headers.origin;
    if (!origin || !(keyed || APP_ORIGINS.has(origin))) return;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-File-Name');
    res.setHeader('Access-Control-Expose-Headers', 'X-File-Name');
    res.setHeader('Access-Control-Max-Age', '600');
}

const { networkAddresses } = require('./network'); // this machine's addresses on its networks

// ---- requests ----

const send = (res, status, body, type = 'application/json') => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
class TooBig extends Error { }
// the body, up to MAX_UPLOAD (more: TooBig, answered 413)
const readBody = req => new Promise((resolve, reject) => {
    if (Number(req.headers['content-length']) > MAX_UPLOAD) return reject(new TooBig());
    const chunks = [];
    let size = 0;
    req.on('data', c => {
        size += c.length;
        if (size > MAX_UPLOAD) { req.destroy(); return reject(new TooBig()); }
        chunks.push(c);
    });
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
    if (answer.status < 300 && method !== 'GET') changedHere(route, body);
    if (answer.file) {
        res.writeHead(200, { 'Content-Type': answer.file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(answer.file.name || ''), 'Cache-Control': 'no-store' });
        return res.end(answer.file.bytes);
    }
    if (route === 'boot' && answer.body?.data) answer.body.dataDir = DATA;
    // which server this is, whatever address it was reached at (a device that knew it at an old address moves its
    // synced projects to the new one)
    if (route === 'sync' && answer.body) answer.body.server = serverInfo();
    return send(res, answer.status, answer.body);
}

// ---- live updates: devices told the moment something changes (Server-Sent Events) ----
//
//   GET /api/events     a stream that stays open: "data: { project }" whenever a project's records change here
//                       (project null: something else, a file, a restore…), and a comment every 25 s to keep it open
//
// A device that hears it syncs at once (sync.js watchServer), instead of waiting for its next minute. Plain HTTP:
// it passes through the Cloudflare tunnel and Caddy as it is.

const listeners = new Set();

function events(req, res) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(': connected\n\n');
    const listener = data => res.write(`data: ${JSON.stringify(data)}\n\n`);
    listeners.add(listener);
    const beat = setInterval(() => res.write(': still here\n\n'), 25000);
    const end = () => { clearInterval(beat); listeners.delete(listener); };
    req.on('close', end);
    res.on('error', end);
}

// after a change that other devices should hear about: which project, when it can be told from the request
function changedHere(route, body) {
    const [kind, id] = route.split('?')[0].split('/');
    if (!['items', 'projects', 'sync', 'files', 'restore', 'clear'].includes(kind)) return; // (kv: this place's own settings)
    const project = kind === 'projects' || kind === 'sync' ? id : kind === 'items' ? body?.projectId ?? null : null;
    for (const listener of listeners) {
        try { listener({ project }); } catch { listeners.delete(listener); }
    }
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

// ---- the control page's requests (src/page/server.html), with the main key ----
//
//   GET    /api/admin                 everything it shows
//   POST   /api/admin/invites         { uses: 1 | 0 (any number), minutes } → { token, id, uses, minutes }
//   DELETE /api/admin/invites/:id     DELETE /api/admin/devices/:id
//   POST   /api/admin/key             a new main key → { key } (devices keep their own)
//   PUT    /api/admin/settings        { mode, port, data } saved for the next start (hosting.js)
//   PUT    /api/admin/autostart       { on }
//   POST   /api/admin/restart         start again with the saved settings (when serve.js started it)

const hosting = require('./hosting');
const SUPERVISED = process.env.RB_SUPERVISED === '1';

async function admin(req, res, route) {
    const method = req.method;
    const [, kind = '', id = ''] = route.split('/');
    const body = method === 'POST' || method === 'PUT' ? (await readJson(req).catch(() => null)) || {} : {};
    if (!kind && method === 'GET') {
        return send(res, 200, {
            server: serverInfo(),
            running: { mode: PUBLIC ? 'public' : PROXIED ? 'proxy' : 'network', port: PORT, data: DATA },
            addresses,
            settings: hosting.loadSettings(),
            supervised: SUPERVISED,
            autostart: { available: !!hosting.autostart, on: hosting.startsWithComputer() },
            keyFromEnv: access.fromEnv,
            devices: access.listDevices(),
            invites: access.listInvites(),
        });
    }
    try {
        if (kind === 'invites' && method === 'POST') return send(res, 200, access.newInvite({ uses: body.uses ?? 1, minutes: body.minutes, by: 'the control page' }));
        if (kind === 'invites' && method === 'DELETE') return (access.cancelInvite(id), send(res, 200, { ok: true }));
        if (kind === 'devices' && method === 'DELETE') return send(res, 200, { ok: access.removeDevice(id) });
        if (kind === 'key' && method === 'POST') return send(res, 200, { key: access.newMainKey() });
        if (kind === 'settings' && method === 'PUT') return send(res, 200, { settings: hosting.saveSettings({ mode: body.mode, port: body.port, data: body.data }) });
        if (kind === 'autostart' && method === 'PUT') return send(res, 200, hosting.setStartsWithComputer(!!body.on));
        if (kind === 'restart' && method === 'POST') {
            if (!SUPERVISED) return send(res, 409, { error: 'started without serve.bat / serve.sh: stop it and start it again yourself' });
            send(res, 200, { ok: true });
            console.log('\nThe control page asked to start again with the saved settings.');
            return setTimeout(() => process.exit(75), 300); // serve.js starts it again
        }
    } catch (err) {
        return send(res, 400, { error: err.message });
    }
    return send(res, 404, { error: 'unknown request' });
}

async function start() {
    fs.mkdirSync(DATA, { recursive: true });
    const place = await openServerPlace(DATA);
    await convertOldData(place);

    access = createAccess({ data: DATA, required: !LOCAL_ONLY, envKey: process.env.KEY || '' });

    const server = http.createServer(async (req, res) => {
        try {
            const { pathname, search } = new URL(req.url, 'http://localhost');
            if (pathname.startsWith('/api/')) {
                crossOrigin(req, res, access.required);
                if (req.method === 'OPTIONS') return res.writeHead(204).end();
                // an invite, swapped for this device's own key (no key needed for this one: the invite is the proof)
                if (pathname === '/api/invite' && req.method === 'POST' && access.required) {
                    const client = clientOf(req);
                    if (blocked(client)) return send(res, 429, { error: 'too many wrong keys: try again in 15 minutes' });
                    const { token, name } = (await readJson(req)) || {};
                    const added = access.useInvite(token, name);
                    if (!added) {
                        wrongKey(client);
                        return send(res, 401, { error: "this invite was already used, has expired, or isn't one: make a new one on the server" });
                    }
                    console.log(`Added a device: ${added.device.name}`);
                    return send(res, 200, { key: added.token, device: { id: added.device.id, name: added.device.name }, server: serverInfo() });
                }
                let who = { main: true };
                if (pathname !== '/api/health' && access.required) {
                    const client = clientOf(req);
                    if (blocked(client)) return send(res, 429, { error: 'too many wrong keys: try again in 15 minutes' });
                    who = access.check(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
                    if (!who) {
                        if (req.headers.authorization) wrongKey(client); // (no key at all: a first visit, not a guess)
                        return send(res, 401, { error: 'this server needs its key' });
                    }
                }
                // a new invite for one device, asked for by a device already in (to add the next one)
                if (pathname === '/api/invites' && req.method === 'POST' && access.required) {
                    return send(res, 200, access.newInvite({ uses: 1, minutes: 20, by: who.device?.name || 'the control page' }));
                }
                // the control page's requests: the main key only
                if (pathname.startsWith('/api/admin')) {
                    if (!access.required) return send(res, 404, { error: 'a server for this computer only has no control page' });
                    if (!who.main) return send(res, 403, { error: "the control page needs the server's main key" });
                    return await admin(req, res, pathname.slice('/api/admin'.length));
                }
                if (pathname === '/api/events' && req.method === 'GET') return events(req, res);
                return await api(place, req, res, pathname.slice(5) + search);
            }
            if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Not allowed', 'text/plain');
            return await serveStatic(req, res, pathname);
        } catch (err) {
            if (err instanceof TooBig) return send(res, 413, { error: `too big: this server takes up to ${MAX_UPLOAD / 1048576} MB at once` });
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
    server.listen(PORT, HOST, async () => {
        const address = `http://${HOST === '0.0.0.0' || HOST === '::' ? 'localhost' : HOST}:${PORT}/`;
        console.log(`Research Board: ${address}`);
        if (HOST === '0.0.0.0' || HOST === '::') {
            const lan = await networkAddresses();
            addresses = lan.map(({ ip, name }) => ({ label: name, base: `http://${ip}:${PORT}` }));
            console.log('\nOther devices reach it at:');
            if (!lan.length) console.log('  (no network found: connect this machine to a network, then start it again)');
            for (const { ip, name, main } of lan) {
                console.log(`  http://${ip}:${PORT}/`.padEnd(32) + `${name}${main ? '   <- this network' : ''}`);
            }
            if (access.required) showInvite();
        } else if (PUBLIC) {
            try {
                console.log('Opening a public address through Cloudflare: this takes 10 to 30 seconds…');
                const waiting = setInterval(() => process.stdout.write('.'), 2000);
                const { url, ready } = await require('./tunnel').startTunnel(PORT, path.join(APP, 'tools')).finally(() => { clearInterval(waiting); console.log(''); });
                if (!ready) console.log("(It isn't answering yet from here: it can take a minute to be known on the internet. Try it from the device.)");
                addresses = [{ label: 'Any network (Cloudflare)', base: url }];
                console.log('\nPUBLIC: reachable from any network while this window is open, at:');
                console.log(`  ${url}/`);
                console.log('A device that connected before needs just this new address (Settings > Sync with a server).');
                showInvite();
                console.log('The address changes each start. Anyone with the address AND the key can read and change this');
                console.log('server\'s data (only this data folder, nothing else on this computer). Ctrl + C closes it.\n');
            } catch (err) {
                console.error(`\nCouldn't open the public address: ${err.message}\n`);
                process.exit(1);
            }
        }
        console.log(`Your data: ${DATA}`);
        if (access.required) console.log(`The control page (devices, invites, the key, settings): a + Enter here, or open http://localhost:${PORT}/page/server.html with the main key`);
        console.log('Stop it with Ctrl + C (your changes are already saved).');
        if (process.argv.includes('--admin') && access.required) openControlPage();
        // --open: the browser, now that there's something to show (opening it first could show an error page)
        if (process.argv.includes('--open')) {
            const [command, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', address]]
                : process.platform === 'darwin' ? ['open', [address]] : ['xdg-open', [address]];
            spawn(command, args, { stdio: 'ignore', detached: true }).on('error', () => console.log(`Open ${address} in your browser.`)).unref();
        }
    });

    // every change is already in the database; closing it folds the write-ahead log back in
    process.on('exit', () => { try { place.close(); } catch { } });
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

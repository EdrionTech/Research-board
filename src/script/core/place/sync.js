// Keeps a project here in step with its copy on a server (local-first: you always work on the copy here; this
// brings the two together whenever it runs). Written once for every client: the browser (its server's data),
// the desktop app and the phone app (their own SQLite), and the tests.
//
// Both sides are places (place.js) answering the same requests, so a side is just a request function:
//   request(method, path, body) → { status, body } | { status, file }       (RB_SERVER.request, or remotePlace)
//
// One sync of a project, linked here by place.js's `links` table (server address, key, how far each way went):
//   1. down:  the server's changes to the project since `pulled`  → applied here (newer edit wins)
//   2. up:    the changes made here since `pushed` (not those sync brought) → sent to the server (newer wins)
//   3. files: the project's files either side lacks are copied across
//   4. the link remembers both points, so the next sync sends and fetches only what's new
// A first sync (both points 0) sends and fetches everything, so linking a project here puts it on the server,
// and linking a server's project brings it here. Running it twice changes nothing the second time.

// a server's place over the network: the same API (apps/server/README.md), with its key
export function remotePlace(server, key = '') {
    const base = String(server).replace(/\/+$/, '') + '/api/';
    const auth = key ? { Authorization: 'Bearer ' + key } : {};
    return async function request(method, path, body) {
        // a file: a Blob/File (the browser and the apps), or { bytes, type, name } (place.js itself)
        if (body && !(body instanceof Blob) && body.bytes) body = new File([body.bytes], body.name || 'file', { type: body.type || '' });
        const file = body instanceof Blob;
        let res;
        try {
            res = await fetch(base + path, {
                method,
                headers: {
                    ...auth,
                    ...(file ? { 'Content-Type': body.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(body.name || '') }
                        : body === undefined ? {} : { 'Content-Type': 'application/json' }),
                },
                body: file || body === undefined ? body : JSON.stringify(body),
            });
        } catch {
            return { status: 0, body: { error: `can't reach ${server}` } };
        }
        if (res.ok && method === 'GET' && path.startsWith('files/')) {
            // the bytes copied out of the response (a Blob still tied to the response, sent on in another request,
            // crashes Bun 1.3 on Windows now and then)
            const bytes = await res.arrayBuffer();
            const type = res.headers.get('Content-Type') || '';
            const name = decodeURIComponent(res.headers.get('X-File-Name') || '');
            return { status: res.status, file: name ? new File([bytes], name, { type }) : new Blob([bytes], { type }) };
        }
        const answer = await res.json().catch(() => null);
        if (res.status === 401 && path !== 'invite') return { status: 401, body: { error: key ? "the server didn't accept this key" : 'the server needs its key' } };
        return { status: res.status, body: answer };
    };
}

async function call(side, method, path, body) {
    const answer = await side(method, path, body);
    if (!(answer.status >= 200 && answer.status < 300)) throw new Error(answer.body?.error || `the server said ${answer.status}`);
    return answer;
}

// What's on a server: [{ id, title, updatedAt }] (throws if it can't be reached or refuses the key)
export async function serverProjects(server, key) {
    return (await serverInfo(server, key)).projects;
}

// The server's projects, and which server it is: { projects, server: { id, name } } (id: the same whatever
// address it's reached at; older servers send none)
export async function serverInfo(server, key) {
    const body = (await call(remotePlace(server, key), 'GET', 'sync')).body;
    return { projects: body.projects, server: body.server || null };
}

// What was typed or pasted as a server's address: an address, or the one line the server prints holding both,
// "https://….trycloudflare.com/#key=…". → { server, key } (key '' when there's none in it)
// Also an invite link (or its QR code): "https://…/#invite=…" → { server, key: '', invite }.
export function parseAddress(text) {
    let value = String(text || '').trim();
    let key = '';
    let invite = '';
    const hash = value.indexOf('#');
    if (hash >= 0) {
        const params = new URLSearchParams(value.slice(hash + 1));
        key = (params.get('key') || '').trim();
        invite = (params.get('invite') || '').trim();
        value = value.slice(0, hash);
    }
    if (value && !/^https?:\/\//i.test(value)) value = 'http://' + value;
    return { server: value.replace(/\/+$/, ''), key, invite };
}

// An invite swapped for this device's own key on the server (`name`: how the server lists this device):
// → { key, device: { id, name }, server: { id, name } }
export async function redeemInvite(server, token, name = '') {
    return (await call(remotePlace(server), 'POST', 'invite', { token, name })).body;
}

// this device, as a server lists it: "Phone app on Android", "Edge on Windows"…
export function deviceName() {
    const ua = navigator.userAgent;
    const system = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone or iPad' : /Windows/.test(ua) ? 'Windows'
        : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'a device';
    const what = globalThis.__TAURI_INTERNALS__ ? 'Desktop app' : globalThis.Capacitor?.isNativePlatform?.() ? 'Phone app'
        : /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'A browser';
    return `${what} on ${system}`;
}

// A new invite for another device, from a device that has the key: → the link to give it (also as a QR code)
export async function createInvite(server, key) {
    const { token, minutes } = (await call(remotePlace(server, key), 'POST', 'invites')).body;
    return { link: `${String(server).replace(/\/+$/, '')}/#invite=${token}`, minutes };
}

// A server moved (a new tunnel address): its synced projects here follow it. Returns how many moved.
export async function moveServer(local, from, to, key) {
    const same = a => String(a).replace(/\/+$/, '') === String(from).replace(/\/+$/, '');
    let moved = 0;
    for (const link of await getLinks(local)) {
        if (!same(link.server)) continue;
        await call(local, 'PUT', 'links/' + link.projectId, { server: to, key: key ?? link.key, error: null });
        moved++;
    }
    return moved;
}

// Links a project here to a server, and syncs it: a project made here goes up, a server's project comes down.
export async function linkProject(local, projectId, { server, key = '' }) {
    await call(local, 'PUT', 'links/' + projectId, { server, key, pulled: 0, pushed: 0, error: null });
    return syncProject(local, projectId);
}

// Stops syncing: the copy here stays, as a project on this device only (the server's copy stays too).
export const unlinkProject = (local, projectId) => call(local, 'DELETE', 'links/' + projectId);

export async function getLinks(local) {
    return (await call(local, 'GET', 'links')).body.links;
}

// One sync of one linked project. Returns { pulled, pushed, files } (how many records came and went, files
// copied). A failure is kept on the link (link.error) and thrown.
export async function syncProject(local, projectId, { remote } = {}) {
    const link = (await getLinks(local)).find(l => l.projectId === projectId);
    if (!link) throw new Error('this project isn\'t synced with a server');
    remote ||= remotePlace(link.server, link.key);
    try {
        // this device's id: the server leaves out what came from here (its own changes, coming back) and marks what
        // it's sent from here
        const me = (await call(local, 'GET', 'place')).body.id;
        const down = (await call(remote, 'GET', `sync/${projectId}?since=${link.pulled}&skip=${me}`)).body;
        // (unsentSince: edits made here and not sent yet; one that clashes with these is kept aside, not lost)
        const pulled = down.changes.length ? (await call(local, 'POST', 'sync/' + projectId, { changes: down.changes, unsentSince: link.pushed })).body.applied : 0;

        const up = (await call(local, 'GET', `sync/${projectId}?since=${link.pushed}&origin=local`)).body;
        const pushed = up.changes.length ? (await call(remote, 'POST', 'sync/' + projectId, { changes: up.changes, source: me })).body.applied : 0;

        const [here, there] = await Promise.all([local, remote].map(async side => new Set((await call(side, 'GET', `sync/${projectId}/files`)).body.files)));
        let files = 0;
        for (const [from, to, has, lacks] of [[local, remote, here, there], [remote, local, there, here]]) {
            for (const id of has) {
                if (lacks.has(id)) continue;
                const { file } = await call(from, 'GET', 'files/' + id);
                await call(to, 'PUT', 'files/' + id, file);
                files++;
            }
        }

        await call(local, 'PUT', 'links/' + projectId, { pulled: down.seq, pushed: up.seq, syncedAt: Date.now(), error: null });
        return { pulled, pushed, files };
    } catch (err) {
        await local('PUT', 'links/' + projectId, { error: err.message }).catch(() => { });
        throw err;
    }
}

// Listens to a server's live updates (GET /api/events) and calls onChange({ project }) for each: what changed
// there, so it can be synced at once. Connects again by itself when the stream drops (2 s, then longer, up to a
// minute). → stop()
export function watchServer(server, key, onChange) {
    const url = String(server).replace(/\/+$/, '') + '/api/events';
    let controller = null;
    let stopped = false;
    let wait = 2000;
    (async function listen() {
        while (!stopped) {
            controller = new AbortController();
            try {
                const res = await fetch(url, { headers: key ? { Authorization: 'Bearer ' + key } : {}, signal: controller.signal });
                if (!res.ok || !res.body) throw new Error(`the server said ${res.status}`);
                wait = 2000;
                onChange({ project: null, connected: true }); // (anything missed while it wasn't listening)
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let text = '';
                for (; ;) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    text += decoder.decode(value, { stream: true });
                    let end;
                    while ((end = text.indexOf('\n\n')) >= 0) {
                        const message = text.slice(0, end);
                        text = text.slice(end + 2);
                        const data = message.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5)).join('\n');
                        if (data) { try { onChange(JSON.parse(data)); } catch { } }
                    }
                }
            } catch { /* dropped, or never reached: try again below */ }
            if (stopped) break;
            await new Promise(resolve => setTimeout(resolve, wait));
            wait = Math.min(wait * 2, 60000);
        }
    })();
    return () => { stopped = true; controller?.abort(); };
}

// Every linked project, one after another; a project that fails doesn't stop the others.
// Returns [{ projectId, server, pulled, pushed, files } | { projectId, server, error }].
export async function syncAll(local) {
    const results = [];
    for (const link of await getLinks(local)) {
        try {
            results.push({ projectId: link.projectId, server: link.server, ...await syncProject(local, link.projectId) });
        } catch (err) {
            results.push({ projectId: link.projectId, server: link.server, error: err.message });
        }
    }
    return results;
}

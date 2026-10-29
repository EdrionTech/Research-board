// Shared data layer for every page. Everything goes through here, so where the data lives can change
// without the pages knowing:
// the local server's data/ folder, or in the desktop and phone apps their own SQLite (boot.js → window.RB_SERVER).
// Every page is handed the records first; reads come from that copy and each change is sent back
// (RB_SERVER.request). Changes that couldn't be sent wait in this browser (the outbox) and go when the server is
// back. Nothing else is kept in the browser: without a server or app, boot.js says how to start one. (Older
// versions kept everything in the browser; that is brought in once, see browserData.)
//
// projects: [{ id, title, desc, image }]   image: a link, 'asset:<id>' (an uploaded picture) or '' (the style's own)
// items:    [{ id, projectId, type, title, body, ..., createdAt, updatedAt }]
//           `type` decides which section an item shows in (see dashboard.js);
//           sources follow model/literature material.json.

const Store = (() => {
    const PROJECTS_KEY = 'research_board_projects';
    const ITEMS_KEY = 'research_board_items';
    // Materials added in the Library belong to no project: projectId LIBRARY_ID. The library has its own
    // settings (citation style, highlight colours) like a project, kept under LIBRARY_KEY.
    const LIBRARY_ID = 'library';
    const LIBRARY_KEY = 'research_board_library';
    // Projects without a picture store image: ''; the page shows the style's default (Settings.defaultImage).
    // Older projects stored this stock photo as their picture: it is treated as "no picture" too.
    const DEFAULT_IMAGE = 'https://images.pexels.com/photos/6325886/pexels-photo-6325886.jpeg';

    const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const server = window.RB_SERVER; // always there: boot.js runs the page's scripts only once it is
    const remote = Remote(server);

    // ---- where records are read and written ----

    const SERVER_KEYS = { [PROJECTS_KEY]: 'projects', [ITEMS_KEY]: 'items', [LIBRARY_KEY]: 'library' };

    // a copy each time (pages change what they're given without it being saved)
    function read(key) {
        const value = server.data[SERVER_KEYS[key]];
        return value == null ? null : structuredClone(value);
    }

    // `change` says what changed, for the server: { item }, { deleted: [ids] }, { project }, { deletedProject }
    function write(key, value, change) {
        server.data[SERVER_KEYS[key]] = structuredClone(value);
        remote.send(key, change, value);
    }

    // ---- projects ----

    function getProjects() {
        const saved = read(PROJECTS_KEY);
        if (Array.isArray(saved)) return saved;
        const sample = { id: newId(), title: 'Project Title', desc: 'Project description goes here....', image: '' };
        write(PROJECTS_KEY, [sample], { project: sample });
        return [sample];
    }

    function getProject(id) {
        if (id === LIBRARY_ID) return { ...(read(LIBRARY_KEY) || {}), id: LIBRARY_ID, title: 'Library', library: true };
        return getProjects().find(p => p.id === id);
    }

    function saveProject(data) {
        if (data.id === LIBRARY_ID) {
            const { id, title, library, ...settings } = data;
            write(LIBRARY_KEY, { ...(read(LIBRARY_KEY) || {}), ...settings }, {});
            return;
        }
        const projects = getProjects();
        let project = projects.find(p => p.id === data.id);
        if (project) Object.assign(project, data);
        else projects.unshift(project = { ...data, id: newId() });
        write(PROJECTS_KEY, projects, { project });
    }

    // files an item uses: its uploaded PDF and images written into its text as ![…](asset:ID)
    function deleteItemAssets(item) {
        if (item.file?.assetId) deleteAsset(item.file.assetId);
        for (const ref of JSON.stringify(item).match(/asset:[a-z0-9]+/g) || []) deleteAsset(ref.slice(6));
    }

    function deleteProject(id) {
        const items = allItems();
        for (const item of items) if (item.projectId === id) deleteItemAssets(item);
        deleteItemAssets(getProject(id) || {});
        write(ITEMS_KEY, items.filter(i => i.projectId !== id), { deleted: items.filter(i => i.projectId === id).map(i => i.id) });
        write(PROJECTS_KEY, getProjects().filter(p => p.id !== id), { deletedProject: id });
    }

    // ---- items (sources, notes, observations...) ----

    function allItems() {
        const saved = read(ITEMS_KEY);
        return Array.isArray(saved) ? saved : [];
    }

    function getItems(projectId) {
        return allItems().filter(i => i.projectId === projectId);
    }

    function getItem(id) {
        return allItems().find(i => i.id === id);
    }

    // Creates the item, or merges `data` into the existing one with the same id. Returns the id.
    // touch: false leaves "last edited" alone (for bookkeeping changes the user didn't make).
    function saveItem(data, { touch = true } = {}) {
        const items = allItems();
        const now = Date.now();
        let item = items.find(i => i.id === data.id);
        if (item) Object.assign(item, data, touch ? { updatedAt: now } : {});
        else items.push(item = { ...data, id: newId(), createdAt: now, updatedAt: now });
        write(ITEMS_KEY, items, { item });
        return item.id;
    }

    // keepAssets: leave its files (e.g. a figure's image that your writing still shows)
    function deleteItem(id, { keepAssets = false } = {}) {
        const items = allItems();
        const item = items.find(i => i.id === id);
        if (item && !keepAssets) deleteItemAssets(item);
        write(ITEMS_KEY, items.filter(i => i.id !== id), { deleted: [id] });
    }

    // the theme and style (settings.js), kept with the rest of the data
    function saveSettings(settings) {
        server.data.settings = settings;
        remote.queue({ method: 'PUT', path: 'kv/settings', body: settings });
    }

    // ---- files ----

    // Saves a File/Blob and returns its id.
    async function putAsset(blob) {
        const id = newId();
        await remote.putFile(id, blob);
        return id;
    }

    const getAsset = id => remote.getFile(id);
    const deleteAsset = id => remote.deleteFile(id).catch(() => { });

    // files older versions kept in this browser (IndexedDB), read once to bring them in (browserData)
    let dbPromise = null;

    function db() {
        dbPromise ??= new Promise((resolve, reject) => {
            const req = indexedDB.open('research_board', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('assets');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }

    function oldBrowserFile(id) {
        return db().then(base => new Promise((resolve, reject) => {
            const req = base.transaction('assets', 'readonly').objectStore('assets').get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }));
    }

    // ---- backup (Settings page) ----

    // ids of the files an item uses
    function assetIdsOf(item) {
        const ids = item.file?.assetId ? [item.file.assetId] : [];
        for (const ref of JSON.stringify(item).match(/asset:[a-z0-9]+/g) || []) ids.push(ref.slice(6));
        return ids;
    }

    const toDataUrl = blob => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });

    // Everything as one object (for a .json file). With files: PDFs, images and videos are included too.
    async function backup({ includeFiles = false } = {}) {
        const items = allItems();
        const data = { app: 'research-board', version: 1, exported: new Date().toISOString(), projects: getProjects(), library: read(LIBRARY_KEY) || {}, items, files: {} };
        if (server.data.settings) data.settings = server.data.settings;
        if (includeFiles) {
            for (const id of new Set([...items, ...getProjects()].flatMap(assetIdsOf))) {
                const blob = await getAsset(id).catch(() => null);
                if (blob) data.files[id] = { type: blob.type, name: blob.name || '', data: await toDataUrl(blob) };
            }
        }
        return data;
    }

    // Replaces everything with a backup made by backup().
    async function restore(data) {
        if (data?.app !== 'research-board' || !Array.isArray(data.projects) || !Array.isArray(data.items)) {
            throw new Error("this isn't a Research Board backup");
        }
        await remote.call('POST', 'restore', data);
        Object.assign(server.data, { projects: data.projects, items: data.items, library: data.library || {}, settings: data.settings || server.data.settings });
    }

    // Deletes every project, item and file.
    async function clearAll() {
        await remote.call('POST', 'clear');
        Object.assign(server.data, { projects: [], items: [], library: {} });
    }

    // What an older version kept in this browser (at this address: localStorage and IndexedDB), as a backup with
    // its files, or null when there's nothing: offered once, when the data folder is new (below).
    async function browserData() {
        const local = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
        const items = local(ITEMS_KEY) || [];
        const projects = local(PROJECTS_KEY) || [];
        if (!items.length && !projects.some(p => p.title !== 'Project Title')) return null;
        const data = { app: 'research-board', version: 1, exported: new Date().toISOString(), projects, items, library: local(LIBRARY_KEY) || {}, files: {} };
        const settings = local('research_board_settings');
        if (settings) data.settings = settings;
        for (const id of new Set([...items, ...projects].flatMap(assetIdsOf))) {
            const blob = await oldBrowserFile(id).catch(() => null);
            if (blob) data.files[id] = { type: blob.type, name: blob.name || '', data: await toDataUrl(blob) };
        }
        return data;
    }

    return {
        DEFAULT_IMAGE, LIBRARY_ID,
        mode: server.app ? 'app' : 'server',
        getProjects, getProject, saveProject, deleteProject,
        getItems, getItem, saveItem, deleteItem,
        saveSettings,
        putAsset, getAsset, deleteAsset,
        backup, restore, clearAll, browserData,
    };

    // ---- talking to the server ----

    // Changes go out one at a time, in order. Each waits in localStorage (the page's outbox) until the server has
    // it, so closing the page or the server being down loses nothing: the next page sends what's left. Other open
    // tabs are told (BroadcastChannel) and refresh as they would for a localStorage change. The server keeps the
    // newer of two saves of an item (updatedAt), so a late one can't undo a later edit.
    function Remote(server) {
        // each open page has its own outbox, and holds a lock (Web Locks) on it while it's open; a page takes over
        // the outboxes of pages that have closed, never one another page is still sending
        const OUTBOX_PREFIX = 'research_board_outbox';
        const OUTBOX = OUTBOX_PREFIX + ':' + newId();
        navigator.locks?.request(OUTBOX, () => new Promise(() => { }));
        const channel = 'BroadcastChannel' in window ? new BroadcastChannel('research_board') : null;
        const outboxKeys = () => {
            try { return Object.keys(localStorage).filter(k => k.startsWith(OUTBOX_PREFIX) && k !== OUTBOX); } catch { return []; }
        };
        const waiting = key => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
        let outbox = [];
        let sending = false;
        let retry = null;
        let kept = true; // the outbox fits in localStorage (else waiting changes live only in this page)

        const keep = () => {
            try {
                if (outbox.length) localStorage.setItem(OUTBOX, JSON.stringify(outbox));
                else localStorage.removeItem(OUTBOX);
                kept = true;
            } catch {
                kept = false;
            }
        };

        // to the server, or in the apps to their own storage (boot.js); a file goes and comes as a Blob
        async function call(method, path, body) {
            const answer = await server.request(method, path, body);
            if (answer.status >= 400) throw new Error(answer.body?.error || `the server said ${answer.status}`);
            return answer;
        }

        // what changed in records → requests
        function send(key, change, value) {
            if (key === ITEMS_KEY && change?.item) queue({ method: 'PUT', path: 'items/' + change.item.id, body: change.item });
            for (const id of change?.deleted || []) queue({ method: 'DELETE', path: 'items/' + id });
            if (key === PROJECTS_KEY && change?.project) queue({ method: 'PUT', path: 'projects/' + change.project.id, body: change.project });
            if (change?.deletedProject) queue({ method: 'DELETE', path: 'projects/' + change.deletedProject });
            if (key === LIBRARY_KEY) queue({ method: 'PUT', path: 'kv/library', body: value });
            channel?.postMessage({ key, change, value: key === LIBRARY_KEY ? value : undefined });
        }

        function queue(request) {
            // a newer save of the same thing replaces one still waiting
            if (request.method === 'PUT') outbox = outbox.filter(r => !(r.method === 'PUT' && r.path === request.path));
            outbox.push(request);
            keep();
            flush();
        }

        async function flush() {
            if (sending || !outbox.length) return;
            sending = true;
            clearTimeout(retry);
            try {
                while (outbox.length) {
                    const request = outbox[0];
                    await call(request.method, request.path, request.body);
                    if (outbox[0] === request) outbox.shift();
                    keep();
                }
                notice(false);
            } catch {
                notice(true);
                retry = setTimeout(flush, 4000);
            } finally {
                sending = false;
            }
        }

        // a waiting change, applied to this page's copy (the server doesn't have it yet)
        function applyWaiting(request) {
            const [kind, id] = request.path.split('/');
            if (kind === 'items') {
                const current = server.data.items.find(i => i.id === id);
                if (request.method === 'PUT' && current && (current.updatedAt || 0) > (request.body.updatedAt || 0)) return; // older
                server.data.items = server.data.items.filter(i => i.id !== id);
                if (request.method === 'PUT') server.data.items.push(request.body);
            } else if (kind === 'projects') {
                const at = server.data.projects.findIndex(p => p.id === id);
                if (request.method === 'DELETE') { if (at >= 0) server.data.projects.splice(at, 1); }
                else if (at >= 0) server.data.projects[at] = request.body;
                else server.data.projects.unshift(request.body);
            } else if (kind === 'kv') server.data[id] = request.body;
        }

        // changes still waiting in other pages' outboxes are the newest there are: this page shows them too
        for (const key of outboxKeys()) waiting(key).forEach(applyWaiting);

        // the outboxes of pages that have closed (nobody holds their lock): this page sends them
        async function adopt() {
            let busy = new Set();
            if (navigator.locks?.query) {
                const { held = [], pending = [] } = await navigator.locks.query();
                busy = new Set([...held, ...pending].map(l => l.name));
            } else if (outboxKeys().some(k => k !== OUTBOX_PREFIX)) {
                return; // without locks it can't tell open pages from closed ones: leave them
            }
            for (const key of outboxKeys().filter(k => !busy.has(k))) {
                outbox.unshift(...waiting(key)); // theirs came first
                try { localStorage.removeItem(key); } catch { }
            }
            keep();
            flush();
            // a page that was just closing may still hold its lock for a moment: look again while any are left
            if (outboxKeys().length) setTimeout(adopt, 3000);
        }
        adopt();

        // another tab changed something: take the change, and let the page refresh as for a localStorage change
        channel?.addEventListener('message', ({ data }) => {
            const { key, change, value } = data;
            if (key === ITEMS_KEY) {
                const gone = new Set([...(change.deleted || []), ...(change.item ? [change.item.id] : [])]);
                server.data.items = server.data.items.filter(i => !gone.has(i.id));
                if (change.item) server.data.items.push(change.item);
            } else if (key === PROJECTS_KEY) {
                if (change.deletedProject) server.data.projects = server.data.projects.filter(p => p.id !== change.deletedProject);
                if (change.project) {
                    const at = server.data.projects.findIndex(p => p.id === change.project.id);
                    if (at >= 0) server.data.projects[at] = change.project;
                    else server.data.projects.unshift(change.project);
                }
            } else if (key === LIBRARY_KEY) server.data.library = value;
            window.dispatchEvent(new StorageEvent('storage', { key }));
        });

        // "not saved yet": shown while the server can't be reached
        function notice(show) {
            let bar = document.getElementById('save_notice');
            if (!show) return bar?.remove();
            if (bar || !document.body) return;
            bar = document.createElement('div');
            bar.id = 'save_notice';
            bar.className = 'save_notice';
            bar.setAttribute('role', 'status');
            bar.textContent = 'Not saved yet: the Research Board server isn\'t answering. Your changes are kept in this browser and will be saved when it\'s back (start.bat, or node apps/server/server.js).';
            document.body.append(bar);
        }
        // leaving with changes that are neither sent nor kept in the outbox: ask first
        addEventListener('beforeunload', e => {
            if (outbox.length && !kept) e.preventDefault();
        });

        async function putFile(id, blob) {
            await call('PUT', 'files/' + id, blob);
        }

        async function getFile(id) {
            const answer = await server.request('GET', 'files/' + id);
            if (answer.status === 404) return undefined;
            if (answer.status >= 400) throw new Error(`the server said ${answer.status}`);
            return answer.file;
        }

        const deleteFile = id => call('DELETE', 'files/' + id);

        return { send, queue, call, putFile, getFile, deleteFile };
    }
})();

// The first time the server is used (its data folder is empty), what this browser kept so far can be brought in.
if (Store.mode === 'server' && window.RB_SERVER.empty) { // (the apps have no browser data to bring in)
    Store.browserData().then(async data => {
        if (!data) return;
        const count = data.items.filter(i => i.type === 'source').length;
        if (!confirm(`This browser has Research Board data saved in it (${data.projects.length} project${data.projects.length === 1 ? '' : 's'}, ${count} material${count === 1 ? '' : 's'}). Copy it into the data folder, so it's kept on this computer?`)) return;
        await Store.restore(data);
        location.reload();
    }).catch(err => alert(`Couldn't copy this browser's data (${err.message}). It's still in this browser; you can also move it with a backup from Settings.`));
}

// Shared data layer for every page. Prototype only: records live in localStorage,
// files (uploaded PDFs, later images/audio) live in IndexedDB.
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

    function read(key) {
        try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    }

    function write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    }

    // ---- projects ----

    function getProjects() {
        const saved = read(PROJECTS_KEY);
        if (Array.isArray(saved)) return saved;
        const sample = [{
            id: newId(),
            title: 'Project Title',
            desc: 'Project description goes here....',
            image: '',
        }];
        write(PROJECTS_KEY, sample);
        return sample;
    }

    function getProject(id) {
        if (id === LIBRARY_ID) return { ...(read(LIBRARY_KEY) || {}), id: LIBRARY_ID, title: 'Library', library: true };
        return getProjects().find(p => p.id === id);
    }

    function saveProject(data) {
        if (data.id === LIBRARY_ID) {
            const { id, title, library, ...settings } = data;
            write(LIBRARY_KEY, { ...(read(LIBRARY_KEY) || {}), ...settings });
            return;
        }
        const projects = getProjects();
        const existing = projects.find(p => p.id === data.id);
        if (existing) Object.assign(existing, data);
        else projects.unshift({ ...data, id: newId() });
        write(PROJECTS_KEY, projects);
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
        write(PROJECTS_KEY, getProjects().filter(p => p.id !== id));
        write(ITEMS_KEY, items.filter(i => i.projectId !== id));
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
        write(ITEMS_KEY, items);
        return item.id;
    }

    // keepAssets: leave its files (e.g. a figure's image that your writing still shows)
    function deleteItem(id, { keepAssets = false } = {}) {
        const items = allItems();
        const item = items.find(i => i.id === id);
        if (item && !keepAssets) deleteItemAssets(item);
        write(ITEMS_KEY, items.filter(i => i.id !== id));
    }

    // ---- files (IndexedDB) ----

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

    // a write resolves once it's committed (not just requested), so leaving the page right after can't lose it
    async function assetRequest(mode, makeRequest) {
        const tx = (await db()).transaction('assets', mode);
        return new Promise((resolve, reject) => {
            const req = makeRequest(tx.objectStore('assets'));
            if (mode === 'readwrite') tx.oncomplete = () => resolve(req.result);
            else req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
            tx.onabort = () => reject(tx.error || new Error('not saved'));
        });
    }

    // Saves a File/Blob and returns its id.
    async function putAsset(blob) {
        const id = newId();
        await assetRequest('readwrite', store => store.put(blob, id));
        return id;
    }

    const getAsset = id => assetRequest('readonly', store => store.get(id));
    const deleteAsset = id => assetRequest('readwrite', store => store.delete(id)).catch(() => { });

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
        await clearAll();
        write(PROJECTS_KEY, data.projects);
        write(ITEMS_KEY, data.items);
        if (data.library) write(LIBRARY_KEY, data.library);
        for (const [id, file] of Object.entries(data.files || {})) {
            const blob = await (await fetch(file.data)).blob();
            const stored = file.name ? new File([blob], file.name, { type: file.type }) : blob;
            await assetRequest('readwrite', store => store.put(stored, id));
        }
    }

    // Deletes every project, item and file in this browser.
    async function clearAll() {
        try {
            localStorage.removeItem(PROJECTS_KEY);
            localStorage.removeItem(ITEMS_KEY);
            localStorage.removeItem(LIBRARY_KEY);
        } catch { /* storage unavailable */ }
        await assetRequest('readwrite', store => store.clear()).catch(() => { });
    }

    return {
        DEFAULT_IMAGE, LIBRARY_ID,
        getProjects, getProject, saveProject, deleteProject,
        getItems, getItem, saveItem, deleteItem,
        putAsset, getAsset, deleteAsset,
        backup, restore, clearAll,
    };
})();

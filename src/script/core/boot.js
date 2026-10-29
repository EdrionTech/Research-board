// Starts every page, in every client: finds where the data is, then runs the page's own scripts.
//
//   desktop app (Tauri)      window.__TAURI_INTERNALS__          place.js on the app's own SQLite
//   phone app (Capacitor)    window.Capacitor.isNativePlatform()  place.js on the app's own SQLite
//   browser                  the server that served the page      GET /api/boot, then each change sent to it
//   browser, no server       (files opened directly, Live Server) a page saying how to start Research Board
//
// The page's scripts are written <script data-src="…">: they do nothing until the data is here, then run in
// order. Theme and style (settings.js, nav.js) stay ordinary scripts in the <head>, so the page never flashes.
//
// window.RB_SERVER = { data: { projects, items, library, settings }, empty, dataDir, app,
//                      request(method, path, body) → { status, body } | { status, file } }
// `path` is the server API's (apps/server/README.md) without /api/; a file is sent and received as a Blob.

(() => {
    const placeDir = new URL('place/', document.currentScript.src).href;

    // ---- the browser, talking to a server ----

    async function remoteRequest(method, path, body) {
        const file = body instanceof Blob;
        const res = await fetch('/api/' + path, {
            method,
            headers: file ? { 'Content-Type': body.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(body.name || '') }
                : body === undefined ? {} : { 'Content-Type': 'application/json' },
            body: file || body === undefined ? body : JSON.stringify(body),
        });
        if (res.ok && method === 'GET' && path.startsWith('files/')) {
            const blob = await res.blob();
            const name = decodeURIComponent(res.headers.get('X-File-Name') || '');
            return { status: res.status, file: name ? new File([blob], name, { type: blob.type }) : blob };
        }
        return { status: res.status, body: await res.json().catch(() => null) };
    }

    async function fromServer() {
        let res;
        try { res = await fetch('/api/boot', { cache: 'no-store' }); } catch { return null; }
        if (!res.ok) return null; // not our server (Live Server)
        return { ...(await res.json()), request: remoteRequest };
    }

    // ---- the apps: the same storage the server runs (place.js), on this device ----

    async function onDevice(adapterFile) {
        const [{ createPlace }, adapter] = await Promise.all([import(placeDir + 'place.js'), import(placeDir + adapterFile)]);
        const { sql, blobs, dataDir } = await adapter.open();
        const place = await createPlace(sql, blobs);
        async function request(method, path, body) {
            if (body instanceof Blob) body = { bytes: new Uint8Array(await body.arrayBuffer()), type: body.type, name: body.name || '' };
            const answer = await place.request(method, path, body);
            if (!answer.file) return answer;
            const { bytes, type, name } = answer.file;
            return { status: 200, file: name ? new File([bytes], name, { type }) : new Blob([bytes], { type }) };
        }
        const { body } = await request('GET', 'boot');
        return { ...body, dataDir, app: true, request };
    }

    function connect() {
        if (window.__TAURI_INTERNALS__) return onDevice('sql-tauri.js').then(desktopApp);
        if (window.Capacitor?.isNativePlatform?.()) return onDevice('sql-capacitor.js').then(phoneApp);
        if (location.protocol.startsWith('http')) return fromServer();
        return null;
    }

    // ---- what a browser does by itself, done for the apps: saving a file, opening a website ----
    // RB_SERVER.save(name, text) → where it went (ui.js downloadText); RB_SERVER.watchLinks(doc) for frames

    function desktopApp(server) {
        const { invoke } = window.__TAURI__.core;
        server.save = (name, contents) => invoke('save_download', { name, contents });
        // websites open in your browser (the app's window shows only the app); also in the paper's frame
        server.watchLinks = doc => doc.addEventListener('click', e => {
            const a = e.target.closest?.('a[href]');
            if (!a || e.defaultPrevented || !/^(https?:|mailto:)/.test(a.href)) return;
            if (new URL(a.href).origin === location.origin) return;
            e.preventDefault();
            invoke('plugin:opener|open_url', { url: a.href }).catch(() => { });
        });
        server.watchLinks(document);
        window.open = url => { if (url) invoke('plugin:opener|open_url', { url: String(new URL(url, location.href)) }).catch(() => { }); return null; };
        return server;
    }

    // (Android already hands links that leave the app to the phone's browser)
    function phoneApp(server) {
        const fs = (method, options) => window.Capacitor.nativePromise('Filesystem', method, options);
        server.save = async (name, contents) => {
            const dot = name.lastIndexOf('.');
            const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
            let path = 'Research Board/' + name;
            for (let n = 2; await fs('stat', { path, directory: 'DOCUMENTS' }).then(() => true, () => false); n++) {
                path = `Research Board/${stem} (${n})${ext}`;
            }
            await fs('writeFile', { path, data: contents, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
            return 'Documents/' + path;
        };
        server.watchLinks = () => { };
        return server;
    }

    // ---- then the page ----

    const parsed = new Promise(resolve => {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resolve, { once: true });
        else resolve();
    });

    function runScripts() {
        // fetched together, run in the order written (async = false)
        const scripts = [...document.querySelectorAll('script[data-src]')].map(placeholder => {
            const script = document.createElement('script');
            script.src = placeholder.dataset.src;
            script.async = false;
            placeholder.replaceWith(script);
            return new Promise(resolve => { script.onload = script.onerror = resolve; });
        });
        return Promise.all(scripts);
    }

    // the theme and style were applied from this browser's copy of the settings (settings.js, before the data
    // was here): the data's copy is the one kept, so it's applied if it differs
    function syncSettings(settings) {
        if (!settings) return;
        const text = JSON.stringify(settings);
        try {
            if (localStorage.getItem('research_board_settings') === text) return;
            localStorage.setItem('research_board_settings', text);
        } catch { /* storage unavailable */ }
        if (typeof Settings !== 'undefined') Settings.apply(); // (settings.js: a page-wide const, not on window)
    }

    (async () => {
        try {
            window.RB_SERVER = await connect();
        } catch (err) {
            // the apps keep nothing in the browser: without their storage there's nothing to show
            window.RB_SERVER = null;
            await parsed;
            document.body.innerHTML = `<p style="padding:2rem;font:1rem system-ui">Research Board couldn't open its data: ${String(err?.message || err).replace(/</g, '&lt;')}</p>`;
            return;
        }
        if (!window.RB_SERVER) {
            // opened as files, or from another server (Live Server): there's nowhere to keep your work
            await parsed;
            document.body.innerHTML = `<main style="max-width:36rem;margin:12vh auto;padding:0 1.5rem;font:1rem/1.6 system-ui">
                <h1 style="font-size:1.4rem">Start Research Board first</h1>
                <p>Research Board keeps your work in its own data folder, so it runs from its own small server.
                Double-click <b>start.bat</b> in the Research Board folder (on macOS or Linux, run <b>./start.sh</b>);
                it opens the app at <a href="http://127.0.0.1:5500/">http://127.0.0.1:5500/</a>.</p>
                <p>Or use the Research Board app for your computer or phone.</p></main>`;
            return;
        }
        syncSettings(window.RB_SERVER.data.settings);
        await parsed;
        await runScripts();
        // the page's scripts ran after the document's DOMContentLoaded: listeners they added wait for it
        document.dispatchEvent(new Event('DOMContentLoaded'));
    })();
})();

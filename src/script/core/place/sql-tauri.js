// The desktop app's adapters for place.js: SQLite and the files folder, answered by the app itself
// (apps/desktop/src-tauri/src/main.rs). Loaded by boot.js only inside the desktop app.

const { invoke } = window.__TAURI__.core;

export async function open() {
    const dataDir = await invoke('sql_open');
    const all = (sql, params = []) => invoke('sql_all', { sql, params });
    return {
        dataDir,
        sql: {
            exec: sql => invoke('sql_exec', { sql }),
            run: (sql, params = []) => invoke('sql_run', { sql, params }),
            get: async (sql, params) => (await all(sql, params))[0],
            all,
        },
        blobs: {
            put: (hash, bytes) => invoke('blob_put', bytes, { headers: { hash } }),
            get: async hash => {
                try { return new Uint8Array(await invoke('blob_get', { hash })); } catch { return undefined; }
            },
            delete: hash => invoke('blob_delete', { hash }),
        },
    };
}

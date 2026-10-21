// The phone app's adapters for place.js: SQLite from the @capacitor-community/sqlite plugin, and the files
// folder from @capacitor/filesystem (apps/phone). Loaded by boot.js only inside the phone app.
// Plugins are called through Capacitor's own bridge (no npm packages in the app code).

const call = (plugin, method, options) => window.Capacitor.nativePromise(plugin, method, options);
const DATABASE = 'research-board';
const sqlite = (method, options = {}) => call('CapacitorSQLite', method, { database: DATABASE, readonly: false, ...options });

// files travel to and from the plugin as base64
function toBase64(bytes) {
    let text = '';
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(text);
}
const fromBase64 = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

export async function open() {
    // the connection outlives a page (the app keeps it open between pages)
    try { await sqlite('createConnection', { version: 1, encrypted: false, mode: 'no-encryption' }); } catch { /* kept from an earlier page */ }
    const { result: isOpen } = await sqlite('isDBOpen').catch(() => ({ result: false }));
    if (!isOpen) {
        await sqlite('open');
    } else {
        // a write that a closed page left half done (never confirmed; still in that page's outbox) is undone
        try { await sqlite('execute', { statements: 'ROLLBACK', transaction: false }); } catch { /* none open */ }
    }
    const all = async (statement, values = []) => (await sqlite('query', { statement, values })).values || [];
    const file = hash => ({ path: 'files/' + hash, directory: 'DATA' });
    return {
        dataDir: null,
        sql: {
            exec: statements => sqlite('execute', { statements, transaction: false }),
            run: (statement, values = []) => sqlite('run', { statement, values, transaction: false }),
            get: async (statement, values) => (await all(statement, values))[0],
            all,
        },
        blobs: {
            async put(hash, bytes) {
                try { await call('Filesystem', 'stat', file(hash)); return; } catch { /* not there yet */ }
                await call('Filesystem', 'writeFile', { ...file(hash + '.tmp'), data: toBase64(bytes), recursive: true });
                await call('Filesystem', 'rename', { from: 'files/' + hash + '.tmp', to: 'files/' + hash, directory: 'DATA', toDirectory: 'DATA' });
            },
            async get(hash) {
                try { return fromBase64((await call('Filesystem', 'readFile', file(hash))).data); } catch { return undefined; }
            },
            async delete(hash) {
                try { await call('Filesystem', 'deleteFile', file(hash)); } catch { /* already gone */ }
            },
        },
    };
}

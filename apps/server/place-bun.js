// The server's adapters for the shared storage (src/script/core/place/place.js): SQLite from Bun's built-in
// bun:sqlite (no packages), and the files folder for the bytes of uploaded files.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { pathToFileURL } = require('url');

// the project folder (this file is in apps/server; a server build keeps the same layout)
const APP = path.resolve(__dirname, '..', '..');
const PLACE = path.join(APP, 'src', 'script', 'core', 'place', 'place.js');
const HASH = /^[0-9a-f]{64}$/;

function bunSql(file) {
    const { Database } = require('bun:sqlite');
    const db = new Database(file, { create: true });
    db.exec('PRAGMA journal_mode = WAL'); // readers don't wait for a write; a crash mid-write is rolled back on start
    // db.query() keeps each statement prepared for the next time it's asked for
    return {
        exec: q => { db.exec(q); },
        run: (q, params = []) => { db.query(q).run(...params); },
        get: (q, params = []) => db.query(q).get(...params) ?? undefined, // (no row: null in bun:sqlite)
        all: (q, params = []) => db.query(q).all(...params),
        close: () => db.close(),
    };
}

// written to a temporary file and renamed, so a file is whole or not there; the same bytes are written once
function fileBlobs(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const at = hash => {
        if (!HASH.test(hash)) throw new Error('not a file hash: ' + hash);
        return path.join(dir, hash);
    };
    return {
        async put(hash, bytes) {
            if (fs.existsSync(at(hash))) return;
            await fsp.writeFile(at(hash) + '.tmp', bytes);
            await fsp.rename(at(hash) + '.tmp', at(hash));
        },
        async get(hash) {
            try { return new Uint8Array(await fsp.readFile(at(hash))); } catch { return undefined; }
        },
        async delete(hash) {
            await fsp.rm(at(hash), { force: true });
        },
    };
}

// the place kept in `dir`: research-board.db and files/
async function openServerPlace(dir) {
    const { createPlace } = await import(pathToFileURL(PLACE).href);
    const sql = bunSql(path.join(dir, 'research-board.db'));
    const place = await createPlace(sql, fileBlobs(path.join(dir, 'files')));
    return { ...place, close: sql.close };
}

module.exports = { APP, openServerPlace, bunSql, fileBlobs };

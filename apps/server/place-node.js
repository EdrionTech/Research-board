// The server's adapters for the shared storage (src/script/core/place/place.js): SQLite from Node's built-in
// node:sqlite (Node 22.13 or newer, no packages), and the files folder for the bytes of uploaded files.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { pathToFileURL } = require('url');

// the project folder (this file is in apps/server; a server build keeps the same layout)
const APP = path.resolve(__dirname, '..', '..');
const PLACE = path.join(APP, 'src', 'script', 'core', 'place', 'place.js');
const HASH = /^[0-9a-f]{64}$/;

function nodeSql(file) {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(file);
    db.exec('PRAGMA journal_mode = WAL'); // readers don't wait for a write; a crash mid-write is rolled back on start
    const statements = new Map();
    const prepared = q => {
        let statement = statements.get(q);
        if (!statement) statements.set(q, statement = db.prepare(q));
        return statement;
    };
    return {
        exec: q => { db.exec(q); },
        run: (q, params = []) => { prepared(q).run(...params); },
        get: (q, params = []) => prepared(q).get(...params),
        all: (q, params = []) => prepared(q).all(...params),
        close: () => db.close(),
    };
}

// written to a temporary file and renamed, so a file is whole or not there; the same bytes are written once
function nodeBlobs(dir) {
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
async function openNodePlace(dir) {
    const { createPlace } = await import(pathToFileURL(PLACE).href);
    const sql = nodeSql(path.join(dir, 'research-board.db'));
    const place = await createPlace(sql, nodeBlobs(path.join(dir, 'files')));
    return { ...place, close: sql.close };
}

module.exports = { APP, openNodePlace, nodeSql, nodeBlobs };

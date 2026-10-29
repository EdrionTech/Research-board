// Shared by the tests: a Research Board server on a spare port with its own data folder, filled with the sample
// below (the real data/ folder is never touched), a headless browser, and ok / FAIL reporting.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '..');

const now = Date.now();
const SAMPLE = {
    projects: [{ id: 'p1', title: 'Sample project', desc: 'Made by the tests' }],
    items: [
        {
            id: 's1', projectId: 'p1', type: 'source', kind: 'article', title: 'A sample paper on testing',
            authors: [{ firstName: 'Ada', lastName: 'Lovelace', affiliation: '' }], published: '2024-01-01', venue: 'Test Journal',
            tags: ['testing'], keywords: [], status: 'reading', abstract: 'Why tests help.', createdAt: now, updatedAt: now,
            text: '# Introduction\n\nTests keep a project honest.\n\n## Method\n\nA server with made-up data.\n\n## Results\n\nIt works.',
        },
        {
            id: 'n1', projectId: 'p1', type: 'source_note', sourceId: 's1', kind: 'text', quote: 'Tests keep a project honest.',
            body: 'A sample note', color: '', createdAt: now, updatedAt: now,
        },
    ],
};

// the server on `port` with a new data folder: the sample in it unless { empty: true }
async function startServer(port, { empty = false } = {}) {
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-test-'));
    const base = `http://127.0.0.1:${port}/`;
    let server;
    const start = () => new Promise((resolve, reject) => {
        server = spawn(process.execPath, [path.join(REPO, 'apps', 'server', 'server.js')], { env: { ...process.env, PORT: port, DATA: data } });
        let out = '';
        server.stdout.on('data', d => { out += d; if (out.includes('Research Board:')) resolve(out); });
        server.stderr.on('data', d => { out += d; });
        server.on('exit', code => reject(new Error(`the server stopped (exit ${code}):\n${out}`)));
    });
    const stop = () => new Promise(r => { server.removeAllListeners('exit'); server.on('exit', r); server.kill(); });
    const api = (method, route, body) => fetch(base + 'api/' + route, {
        method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });

    await start();
    if (!empty) {
        for (const project of SAMPLE.projects) await api('PUT', 'projects/' + project.id, project);
        for (const item of SAMPLE.items) await api('PUT', 'items/' + item.id, item);
    }
    return {
        base, data, api, start, stop,
        async close() { await stop(); fs.rmSync(data, { recursive: true, force: true }); },
    };
}

// Edge or Chrome as installed (BROWSER=<path to the program> for another one); playwright-core downloads none
async function launchBrowser() {
    const { chromium } = require('playwright-core');
    if (process.env.BROWSER) return chromium.launch({ executablePath: process.env.BROWSER });
    for (const channel of ['msedge', 'chrome']) {
        try { return await chromium.launch({ channel }); } catch { }
    }
    throw new Error('Needs Edge or Chrome (or BROWSER=<path to a Chromium browser>)');
}

// await t.test(name, fn): fn throws (or returns a message) when something's wrong; t.finish() at the end
function tester() {
    let failed = 0;
    return {
        async test(name, fn) {
            let problem;
            try { problem = await fn(); } catch (e) { problem = e.message; }
            if (problem) failed++;
            console.log(problem ? 'FAIL' : 'ok  ', name, problem ? '\n      ' + String(problem).replace(/\n/g, '\n      ') : '');
        },
        finish() {
            console.log(failed ? `${failed} failed` : 'all passed');
            process.exitCode = failed ? 1 : 0;
        },
    };
}

module.exports = { REPO, SAMPLE, startServer, launchBrowser, tester };

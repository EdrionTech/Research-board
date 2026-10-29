// The server's API and its SQLite storage (apps/server, src/script/core/place/place.js): saving, the rules about
// older saves and deletes, files kept once by content, the changes feed, restarting, restore and clear.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { SAMPLE, startServer, tester } = require('./helpers');

(async () => {
    const t = tester();
    const server = await startServer(5591);
    const { api } = server;
    const boot = async () => {
        const { dataDir, ...rest } = await (await api('GET', 'boot')).json();
        assert.equal(dataDir, server.data);
        return rest;
    };
    const putFile = (id, bytes, type, name) => fetch(server.base + 'api/files/' + id, {
        method: 'PUT', headers: { 'Content-Type': type, 'X-File-Name': encodeURIComponent(name) }, body: bytes,
    });
    const blobs = () => fs.readdirSync(path.join(server.data, 'files')).length;

    await t.test('boot gives the saved data', async () => {
        const { data, empty } = await boot();
        assert.equal(empty, false);
        assert.deepEqual(data.projects, SAMPLE.projects);
        assert.deepEqual(data.items, SAMPLE.items);
    });
    await t.test('item save, older save ignored, delete', async () => {
        const item = { id: 'it1', projectId: 'p1', type: 'source', title: 'T', updatedAt: 100 };
        assert.deepEqual(await (await api('PUT', 'items/it1', item)).json(), { ok: true });
        assert.deepEqual(await (await api('PUT', 'items/it1', { ...item, title: 'old', updatedAt: 50 })).json(), { ok: true, kept: 'newer' });
        assert.equal((await boot()).data.items.find(i => i.id === 'it1').title, 'T');
        await api('DELETE', 'items/it1');
        assert.ok(!(await boot()).data.items.some(i => i.id === 'it1'));
        // a late save from before the delete doesn't bring it back
        assert.equal((await (await api('PUT', 'items/it1', item)).json()).kept, 'newer');
        assert.equal((await api('PUT', 'items/zzz', item)).status, 400);
    });
    await t.test('projects: new first, update keeps place, delete', async () => {
        await api('PUT', 'projects/pnew', { id: 'pnew', title: 'New' });
        let { projects } = (await boot()).data;
        assert.equal(projects[0].id, 'pnew');
        await api('PUT', 'projects/p1', { ...SAMPLE.projects[0], title: 'Renamed' });
        ({ projects } = (await boot()).data);
        assert.deepEqual(projects.map(p => p.title), ['New', 'Renamed']);
        await api('DELETE', 'projects/pnew');
        assert.equal((await boot()).data.projects.length, 1);
    });
    await t.test('kv settings and library', async () => {
        await api('PUT', 'kv/settings', { theme: 'dark' });
        await api('PUT', 'kv/library', { style: 'apa' });
        const { data } = await boot();
        assert.deepEqual(data.settings, { theme: 'dark' });
        assert.deepEqual(data.library, { style: 'apa' });
    });
    await t.test('same bytes stored once; removed when unused', async () => {
        const bytes = Buffer.from('%PDF-1.4 same content');
        await putFile('fa', bytes, 'application/pdf', 'paper é.pdf');
        await putFile('fb', bytes, 'application/pdf', 'paper é.pdf');
        const n = blobs();
        const res = await api('GET', 'files/fb');
        assert.equal(res.headers.get('content-type'), 'application/pdf');
        assert.equal(decodeURIComponent(res.headers.get('x-file-name')), 'paper é.pdf');
        assert.ok(Buffer.from(await res.arrayBuffer()).equals(bytes));
        await api('DELETE', 'files/fa');
        assert.equal(blobs(), n);
        assert.equal((await api('GET', 'files/fb')).status, 200);
        await api('DELETE', 'files/fb');
        assert.equal(blobs(), n - 1);
        assert.equal((await api('GET', 'files/fa')).status, 404);
    });
    await t.test('changes feed', async () => {
        const { changes } = await (await api('GET', 'changes?since=0')).json();
        assert.ok(changes.length > 5);
        const last = changes.at(-1).seq;
        await api('PUT', 'items/it2', { id: 'it2', updatedAt: Date.now() });
        const later = (await (await api('GET', 'changes?since=' + last)).json()).changes;
        assert.deepEqual(later.map(c => [c.kind, c.id, c.op]), [['item', 'it2', 'put']]);
    });
    await t.test('survives a restart', async () => {
        const was = await boot();
        await server.stop();
        await server.start();
        assert.deepEqual(await boot(), was);
    });
    await t.test('restore with files, then clear', async () => {
        await putFile('old', Buffer.from('replaced by the restore'), 'text/plain', 'old.txt');
        const backup = {
            app: 'research-board', projects: [{ id: 'r1', title: 'R' }], items: [{ id: 'ri', projectId: 'r1', updatedAt: 1 }],
            library: {}, settings: { theme: 'x' }, files: { rf: { type: 'text/plain', name: 'a.txt', data: 'data:text/plain;base64,' + Buffer.from('hi').toString('base64') } },
        };
        assert.equal((await api('POST', 'restore', backup)).status, 200);
        const { data } = await boot();
        assert.deepEqual(data.projects, backup.projects);
        assert.deepEqual(data.items, backup.items);
        assert.equal(await (await api('GET', 'files/rf')).text(), 'hi');
        assert.equal((await api('GET', 'files/old')).status, 404);
        assert.equal(blobs(), 1);
        await api('POST', 'clear');
        const after = await boot();
        assert.deepEqual(after.data, { projects: [], items: [], library: {}, settings: null });
        assert.equal(after.empty, true);
        assert.equal(blobs(), 0);
    });

    await server.close();
    t.finish();
})().catch(e => { console.error(e); process.exit(1); });

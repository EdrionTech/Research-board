// Sync between places (src/script/core/place/sync.js and place.js's sync requests): a project on a device kept in
// step with a server that needs its key: linking sends it up, edits go both ways, the newer edit wins, deletes
// stay deleted, files are copied, a second device brings the project down. Each "device" here is a local server,
// as for the browser; the apps run the same code on their own SQLite.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { REPO, SAMPLE, startServer, launchBrowser, text, tester } = require('./helpers');

(async () => {
    const t = tester();
    const { remotePlace, serverProjects, linkProject, syncProject, syncAll, getLinks } = await import(pathToFileURL(path.join(REPO, 'src', 'script', 'core', 'place', 'sync.js')).href);
    const KEY = 'test-key-123';
    const device = await startServer(5592);
    const server = await startServer(5593, { empty: true, env: { KEY } });
    const second = await startServer(5594, { empty: true });
    const here = remotePlace(device.base);
    const there = remotePlace(server.base, KEY);
    const link = { server: server.base, key: KEY };
    const data = async place => (await (await place.api('GET', 'boot')).json()).data;
    const item = async (place, id) => (await data(place)).items.find(i => i.id === id);

    await t.test('the server asks for its key, except for health', async () => {
        assert.equal((await fetch(server.base + 'api/boot')).status, 401);
        assert.equal((await fetch(server.base + 'api/boot', { headers: { Authorization: 'Bearer wrong' } })).status, 401);
        assert.equal((await fetch(server.base + 'api/health')).status, 200);
        await assert.rejects(serverProjects(server.base, ''), /needs its key/);
        assert.deepEqual(await serverProjects(server.base, KEY), []);
    });
    await t.test('other websites: allowed with a key; without one, only the apps', async () => {
        const preflight = (base, origin) => fetch(base + 'api/boot', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT' } });
        assert.equal((await preflight(server.base, 'https://example.org')).headers.get('access-control-allow-origin'), 'https://example.org');
        assert.equal((await preflight(device.base, 'https://example.org')).headers.get('access-control-allow-origin'), null);
        assert.equal((await preflight(device.base, 'http://tauri.localhost')).headers.get('access-control-allow-origin'), 'http://tauri.localhost');
    });
    await t.test('linking a project puts it on the server', async () => {
        const result = await linkProject(here, 'p1', link);
        assert.deepEqual(result, { pulled: 0, pushed: 1 + SAMPLE.items.length, files: 0 });
        const onServer = await data(server);
        assert.deepEqual(onServer.projects, SAMPLE.projects);
        assert.deepEqual(onServer.items, SAMPLE.items);
        assert.deepEqual((await serverProjects(server.base, KEY)).map(p => p.title), ['Sample project']);
    });
    await t.test('nothing new: nothing sent', async () => {
        assert.deepEqual(await syncProject(here, 'p1'), { pulled: 0, pushed: 0, files: 0 });
    });
    await t.test('an edit and a file made here go up', async () => {
        const at = Date.now() + 1000;
        await device.api('PUT', 'items/s1', { ...SAMPLE.items[0], title: 'Edited here', text: '![fig](asset:fig1)', updatedAt: at });
        await fetch(device.base + 'api/files/fig1', { method: 'PUT', headers: { 'Content-Type': 'image/png', 'X-File-Name': 'fig.png' }, body: 'PNGBYTES' });
        assert.deepEqual(await syncProject(here, 'p1'), { pulled: 0, pushed: 1, files: 1 });
        assert.equal((await item(server, 's1')).title, 'Edited here');
        const file = await fetch(server.base + 'api/files/fig1', { headers: { Authorization: 'Bearer ' + KEY } });
        assert.equal(await file.text(), 'PNGBYTES');
        assert.equal(file.headers.get('x-file-name'), 'fig.png');
    });
    await t.test('an edit on the server comes down', async () => {
        const s1 = await item(server, 's1');
        await server.api('PUT', 'items/s1', { ...s1, title: 'Edited there', updatedAt: s1.updatedAt + 1000 });
        assert.deepEqual(await syncProject(here, 'p1'), { pulled: 1, pushed: 0, files: 0 });
        assert.equal((await item(device, 's1')).title, 'Edited there');
    });
    await t.test('both edited: the newer edit wins on both sides', async () => {
        const s1 = await item(device, 's1');
        await server.api('PUT', 'items/s1', { ...s1, title: 'older, there', updatedAt: s1.updatedAt + 10 });
        await device.api('PUT', 'items/s1', { ...s1, title: 'newer, here', updatedAt: s1.updatedAt + 20 });
        await syncProject(here, 'p1');
        assert.equal((await item(device, 's1')).title, 'newer, here');
        assert.equal((await item(server, 's1')).title, 'newer, here');
    });
    await t.test('a delete here goes up and stays deleted', async () => {
        const n1 = await item(device, 'n1');
        await device.api('DELETE', 'items/n1');
        await syncProject(here, 'p1');
        assert.equal(await item(server, 'n1'), undefined);
        // an older save of it, sent late to the server, doesn't bring it back anywhere
        await server.api('PUT', 'items/n1', n1);
        await syncProject(here, 'p1');
        assert.equal(await item(server, 'n1'), undefined);
        assert.equal(await item(device, 'n1'), undefined);
    });
    await t.test('a second device brings the project down, files included', async () => {
        const other = remotePlace(second.base);
        const result = await linkProject(other, 'p1', link);
        assert.ok(result.pulled >= 2 && result.files === 1, JSON.stringify(result));
        const copy = await data(second);
        assert.deepEqual(copy.projects.map(p => p.title), ['Sample project']);
        assert.deepEqual(copy.items.map(i => i.id), ['s1']);
        assert.equal(await (await fetch(second.base + 'api/files/fig1')).text(), 'PNGBYTES');
        // its edit reaches the first device through the server
        const s1 = await item(second, 's1');
        await second.api('PUT', 'items/s1', { ...s1, title: 'from the second device', updatedAt: s1.updatedAt + 1 });
        await syncAll(other);
        await syncAll(here);
        assert.equal((await item(device, 's1')).title, 'from the second device');
    });
    await t.test('a sync can only change its own project', async () => {
        await device.api('PUT', 'projects/p2', { id: 'p2', title: 'Not synced' });
        await device.api('PUT', 'items/x1', { id: 'x1', projectId: 'p2', type: 'note', updatedAt: 1 });
        const answer = await (await fetch(device.base + 'api/sync/p1', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ changes: [{ kind: 'item', id: 'x1', op: 'put', updatedAt: Date.now() + 5000, record: { id: 'x1', projectId: 'p1' } }, { kind: 'project', id: 'p2', op: 'delete', updatedAt: Date.now() + 5000 }] }),
        })).json();
        assert.deepEqual(answer, { applied: 0 });
        assert.equal((await item(device, 'x1')).projectId, 'p2');
    });
    await t.test("the server unreachable: kept on the link, and the others still sync", async () => {
        await here('PUT', 'links/p2', { server: 'http://127.0.0.1:5599/', key: '' });
        const results = await syncAll(here);
        assert.equal(results.find(r => r.projectId === 'p1').pushed, 0);
        assert.match(results.find(r => r.projectId === 'p2').error, /can't reach/);
        assert.match((await getLinks(here)).find(l => l.projectId === 'p2').error, /can't reach/);
        await here('DELETE', 'links/p2');
    });
    await t.test('a restore here sends everything again', async () => {
        const backup = await data(device);
        await device.api('POST', 'restore', { app: 'research-board', ...backup });
        const link = (await getLinks(here)).find(l => l.projectId === 'p1');
        assert.equal(link.pushed, 0);
        assert.equal(link.pulled, 0);
        await syncProject(here, 'p1');
        assert.equal((await item(server, 's1')).title, 'from the second device');
    });
    await t.test('Settings: connect, put a project on the server, see it synced', async () => {
        const browser = await launchBrowser();
        try {
            const page = await browser.newPage();
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.goto(device.base + 'page/settings.html#sync');
            await page.waitForSelector('#sync_links li');
            assert.match(await text(page, '#sync_links'), /Sample project/);
            await page.type('#sync_address', server.base);
            await page.click('.sync_keybox summary'); // ("Have its key instead of an invite?")
            await page.type('#sync_key', KEY);
            await page.click('#sync_form button');
            await page.waitForFunction(() => /Connected/.test(document.querySelector('#sync_state').textContent));
            assert.match(await text(page, '#sync_up'), /Not synced/);
            await page.click('#sync_up button');
            await page.waitForFunction(() => /is on the server/.test(document.querySelector('#sync_state').textContent), { timeout: 10000 });
            assert.ok((await data(server)).projects.some(p => p.title === 'Not synced'));
            await page.waitForFunction(() => /Not synced/.test(document.querySelector('#sync_links').textContent));
            assert.deepEqual(errors, []);
        } finally {
            await browser.close();
        }
    });
    await t.test('Settings: the server is remembered; the one line with its key; a new address moves its projects', async () => {
        const browser = await launchBrowser();
        try {
            const page = await browser.newPage();
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            const connected = () => page.waitForFunction(() => /Connected/.test(document.querySelector('#sync_state').textContent), { timeout: 10000 });
            await page.goto(device.base + 'page/settings.html#sync');
            await page.waitForSelector('#sync_links li');
            await page.type('#sync_address', server.base + '#key=' + KEY); // the one line the server prints
            await page.click('#sync_form button');
            await connected();
            // opened again: connected by itself, nothing typed
            await page.reload();
            await connected();
            assert.match(await text(page, '#sync_saved'), /127\.0\.0\.1:5593/);
            // the same server at another address (as a tunnel's changes): only the address is given
            await page.$eval('#sync_address', e => { e.value = ''; });
            await page.type('#sync_address', 'localhost:5593');
            await page.click('#sync_form button');
            await page.waitForFunction(() => /now syncs \d+ project/.test(document.querySelector('#sync_state').textContent), { timeout: 10000 });
            const links = await getLinks(here);
            assert.ok(links.length >= 2 && links.every(l => l.server.includes('localhost:5593')), JSON.stringify(links));
            assert.doesNotMatch(await text(page, '#sync_saved'), /127\.0\.0\.1/); // one server, at its new address
            assert.deepEqual((await syncAll(here)).filter(r => r.error), []);
            assert.deepEqual(errors, []);
        } finally {
            await browser.close();
        }
    });
    await t.test("a project's settings on its dashboard: synced, and a separate copy with its own ids and files", async () => {
        const browser = await launchBrowser();
        try {
            const page = await browser.newPage();
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            page.on('dialog', d => (d.type() === 'prompt' ? d.accept('Forked copy') : d.dismiss()));
            await page.goto(device.base + 'page/project_dashboard.html?id=p1');
            await page.waitForFunction(() => document.querySelector('#project_title')?.textContent, { polling: 200 }); // (its scripts ran)
            await page.click('#project_settings');
            await page.waitForFunction(() => /Synced with/.test(document.querySelector('#project_sync_body').textContent));
            await page.evaluate(() => [...document.querySelectorAll('#project_sync_body button')].find(b => /separate copy/.test(b.textContent)).click());
            await page.waitForFunction(() => /Made "Forked copy"/.test(document.querySelector('#project_sync_body').textContent), { timeout: 10000 });
            await new Promise(r => setTimeout(r, 1500)); // (the page's changes reach its server)
            const after = await data(device);
            const copy = after.projects.find(p => p.title === 'Forked copy');
            assert.ok(copy && copy.id !== 'p1');
            const original = after.items.filter(i => i.projectId === 'p1');
            const copied = after.items.filter(i => i.projectId === copy.id);
            assert.equal(copied.length, original.length);
            assert.ok(copied.every(i => !original.some(o => o.id === i.id)));
            const fileRef = copied.find(i => /asset:/.test(i.text || '')).text.match(/asset:([A-Za-z0-9_-]+)/)[1];
            assert.notEqual(fileRef, 'fig1');
            assert.equal(await (await fetch(device.base + 'api/files/' + fileRef)).text(), 'PNGBYTES');
            assert.ok(!(await getLinks(here)).some(l => l.projectId === copy.id)); // here only, not synced
            assert.deepEqual(errors, []);
        } finally {
            await browser.close();
        }
    });

    const invite = async () => (await (await fetch(server.base + 'api/invites', { method: 'POST', headers: { Authorization: 'Bearer ' + KEY } })).json()).token;
    const redeem = token => fetch(server.base + 'api/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    const syncWith = key => fetch(server.base + 'api/sync', { headers: { Authorization: 'Bearer ' + key } });
    await t.test("an invite gives a device its own key and id, once; only a device that's in makes one", async () => {
        assert.equal((await fetch(server.base + 'api/invites', { method: 'POST' })).status, 401);
        const token = await invite();
        const first = await redeem(token);
        assert.equal(first.status, 200);
        const body = await first.json();
        assert.notEqual(body.key, KEY); // its own, not the main key
        assert.ok(body.device?.id && body.server?.id);
        assert.equal((await syncWith(body.key)).status, 200);
        assert.equal((await redeem(token)).status, 401); // used
        assert.match((await (await redeem('made-up')).json()).error, /already used, has expired/);
        // a device with its own key can invite the next one, but can't use the control page
        const next = await fetch(server.base + 'api/invites', { method: 'POST', headers: { Authorization: 'Bearer ' + body.key } });
        assert.equal(next.status, 200);
        assert.equal((await fetch(server.base + 'api/admin', { headers: { Authorization: 'Bearer ' + body.key } })).status, 403);
    });
    await t.test('Settings: an invite link pasted connects and saves the key; "Invite a device" shows a QR code', async () => {
        const browser = await launchBrowser();
        try {
            const page = await browser.newPage(); // (a new profile: nothing saved)
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.goto(device.base + 'page/settings.html#sync');
            await page.waitForSelector('#sync_links li');
            await page.$eval('#sync_address', e => { e.value = ''; });
            await page.type('#sync_address', `${server.base}#invite=${await invite()}`);
            await page.click('#sync_form button');
            await page.waitForFunction(() => /Connected/.test(document.querySelector('#sync_state').textContent), { timeout: 10000 });
            const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('research_board_servers')));
            assert.notEqual(saved[0].key, KEY); // this device's own key
            assert.equal((await syncWith(saved[0].key)).status, 200);
            assert.equal(await page.$eval('#sync_address', e => e.value), ''); // (the invite isn't kept: it's used up)
            assert.match(await text(page, '#sync_saved'), /127\.0\.0\.1:5593/);
            // this device invites the next one
            await page.evaluate(() => [...document.querySelectorAll('#sync_saved button')].find(b => /Invite a device/.test(b.textContent)).click());
            await page.waitForSelector('#sync_invite:not([hidden]) svg');
            const link = await page.$eval('#sync_invite_link', e => e.value);
            assert.match(link, /#invite=[A-Za-z0-9_-]{20,}$/);
            const token = new URLSearchParams(link.split('#')[1]).get('invite');
            assert.equal((await redeem(token)).status, 200); // a working invite
            assert.deepEqual(errors, []);
        } finally {
            await browser.close();
        }
    });
    await t.test('a browser opening an invite link on the server is signed in', async () => {
        const browser = await launchBrowser();
        try {
            const page = await browser.newPage();
            let asked = false;
            page.on('dialog', d => { asked = true; d.dismiss(); });
            await page.goto(`${server.base}index.html#invite=${await invite()}`);
            await page.waitForSelector('.project', { timeout: 10000 });
            assert.equal(asked, false); // no key typed
            assert.equal(await page.evaluate(() => location.hash), ''); // the used invite isn't left in the address
        } finally {
            await browser.close();
        }
    });

    await t.test('live: a note saved on one device shows on another within seconds, nobody pressing Sync', async () => {
        const browser = await launchBrowser();
        try {
            const [a, b] = [await browser.newPage(), await browser.newPage()];
            const errors = [];
            for (const page of [a, b]) page.on('pageerror', e => errors.push(e.message));
            await a.goto(device.base + 'page/project_dashboard.html?id=p1');
            await b.goto(second.base + 'page/project_dashboard.html?id=p1');
            await new Promise(r => setTimeout(r, 2500)); // (both listening to the server)
            const started = Date.now();
            const id = await a.evaluate(() => Store.saveItem({ projectId: 'p1', type: 'note', title: 'Live note', body: 'typed on the first device' }));
            await b.waitForFunction(id => !!Store.getItem(id), { timeout: 10000, polling: 250 }, id); // (polling: a tab behind another gets no animation frames)
            const took = Date.now() - started;
            assert.ok(took < 8000, `took ${took} ms`);
            // and back the other way
            await b.evaluate(id => Store.saveItem({ id, body: 'changed on the second device' }), id);
            await a.waitForFunction(id => Store.getItem(id)?.body === 'changed on the second device', { timeout: 10000, polling: 250 }, id);
            assert.deepEqual(errors, []);
        } finally {
            await browser.close();
        }
    });
    await t.test('a new project can be put on a saved server as it is made', async () => {
        const browser = await launchBrowser();
        try {
            const page = await browser.newPage();
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.goto(device.base + 'index.html');
            await page.evaluate((address, key) => localStorage.setItem('research_board_servers', JSON.stringify([{ id: 'x', name: 'Lab', address, key, usedAt: Date.now() }])), server.base.replace(/\/$/, ''), KEY);
            await page.reload();
            await page.waitForSelector('.project');
            await page.click('#new_project');
            assert.equal(await page.$eval('#project_place_label', e => e.hidden), false);
            await page.type('#project_form [name=title]', 'Made on the server');
            await page.select('#project_place', server.base.replace(/\/$/, ''));
            await page.click('#project_form button[type=submit]');
            await page.waitForFunction(() => !!document.querySelector('.project .sync_badge'), { timeout: 10000 });
            await new Promise(r => setTimeout(r, 2500)); // (the project itself follows within a second of being saved)
            assert.ok((await data(server)).projects.some(p => p.title === 'Made on the server'));
            assert.deepEqual(errors, []);
        } finally {
            await browser.close();
        }
    });

    await t.test('both devices edited the same thing while apart: the newer wins, the other is kept and can be brought back', async () => {
        const other = remotePlace(second.base);
        await syncAll(here);
        await syncAll(other);
        // (earlier tests' clashes: "both edited" above made one too)
        for (const c of (await here('GET', 'conflicts')).body.conflicts) await here('DELETE', 'conflicts/' + c.id);
        const s1 = await item(device, 's1');
        const t0 = Date.now() + 10000;
        // apart: each edits the same material
        await second.api('PUT', 'items/s1', { ...s1, title: 'Edited on the second, offline', updatedAt: t0 });
        await device.api('PUT', 'items/s1', { ...s1, title: 'Edited here, offline (later)', updatedAt: t0 + 5 });
        // together again: the second syncs first, then this one
        await syncAll(other);
        await syncAll(here);
        assert.equal((await item(server, 's1')).title, 'Edited here, offline (later)');
        const { conflicts } = (await here('GET', 'conflicts?project=p1')).body;
        assert.equal(conflicts.length, 1);
        assert.equal(conflicts[0].lostFrom, 'elsewhere');
        assert.equal(conflicts[0].lost.title, 'Edited on the second, offline');
        assert.equal(conflicts[0].kept.title, 'Edited here, offline (later)');
        // nothing to resolve twice: syncing again adds no more
        await syncAll(here);
        assert.equal((await here('GET', 'conflicts?project=p1')).body.conflicts.length, 1);
        // bring the other one back: it's the newest now, everywhere
        await here('POST', 'conflicts/' + conflicts[0].id);
        await syncAll(here);
        await syncAll(other);
        assert.equal((await item(server, 's1')).title, 'Edited on the second, offline');
        assert.equal((await item(second, 's1')).title, 'Edited on the second, offline');
        assert.equal((await here('GET', 'conflicts?project=p1')).body.conflicts.length, 0);

        // the other way round: this device's unsent edit is the older one, so it's the one kept aside
        const now = await item(device, 's1');
        await second.api('PUT', 'items/s1', { ...now, title: 'Newer, on the second', updatedAt: t0 + 100 });
        await device.api('PUT', 'items/s1', { ...now, title: 'Older, here', updatedAt: t0 + 50 });
        await syncAll(other);
        await syncAll(here);
        const again = (await here('GET', 'conflicts?project=p1')).body.conflicts;
        assert.equal(again.length, 1);
        assert.equal(again[0].lostFrom, 'here');
        assert.equal(again[0].lost.title, 'Older, here');
        assert.equal((await item(device, 's1')).title, 'Newer, on the second');
        await here('DELETE', 'conflicts/' + again[0].id); // kept as it is
        assert.equal((await here('GET', 'conflicts?project=p1')).body.conflicts.length, 0);
    });

    await t.test('a clash shows on the Project button; its window brings the replaced version back', async () => {
        const other = remotePlace(second.base);
        const now = await item(device, 's1');
        const t0 = Date.now() + 20000;
        await second.api('PUT', 'items/s1', { ...now, title: 'Typed on the phone', updatedAt: t0 });
        await device.api('PUT', 'items/s1', { ...now, title: 'Typed on the laptop', updatedAt: t0 + 5 });
        await syncAll(other);
        await syncAll(here);
        const browser = await launchBrowser();
        try {
            const page = await browser.newPage();
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.setViewport({ width: 412, height: 915 });
            await page.goto(device.base + 'page/project_dashboard.html?id=p1');
            await page.waitForFunction(() => document.querySelector('#project_settings .clash_count')?.textContent === '1', { polling: 200, timeout: 10000 });
            await page.click('#project_settings');
            await page.waitForFunction(() => /1 edit clashed/.test(document.querySelector('#project_sync_body').textContent), { polling: 200, timeout: 10000 });
            assert.match(await text(page, '.sync_clash'), /Typed on the phone/);
            await page.screenshot({ path: path.join(REPO, 'tests', 'shots', 'clash-phone.png') }).catch(() => { });
            await page.evaluate(() => [...document.querySelectorAll('.sync_clash button')].find(b => /replaced one/.test(b.textContent)).click());
            await page.waitForFunction(() => /Brought back/.test(document.querySelector('#project_sync_body').textContent), { polling: 200, timeout: 10000 });
            await page.waitForFunction(() => Store.getItem('s1')?.title === 'Typed on the phone', { polling: 200, timeout: 10000 });
            await page.waitForFunction(() => !document.querySelector('#project_settings .clash_count'), { polling: 200, timeout: 10000 });
            assert.deepEqual(errors, []);
        } finally {
            await browser.close();
        }
    });

    for (const s of [device, server, second]) await s.close();

    await t.test('the control page: an invite for several devices, removing one, a new main key', async () => {
        const host = await startServer(5596, { empty: true, env: { HOST: '0.0.0.0' } }); // (open to the network: a key is needed)
        try {
            const main = fs.readFileSync(path.join(host.data, 'server-key.txt'), 'utf8').trim();
            const admin = (method, route, body, key = main) => fetch(host.base + 'api/admin' + route, {
                method, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body),
            });
            const join = async (token, name) => (await (await fetch(host.base + 'api/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, name }) })).json()).key;
            const works = async key => (await fetch(host.base + 'api/sync', { headers: { Authorization: 'Bearer ' + key } })).status;
            const { token } = await (await admin('POST', '/invites', { uses: 0, minutes: 60 })).json();
            const phone = await join(token, 'Phone');
            const laptop = await join(token, 'Laptop'); // the same invite, another device
            assert.ok(phone && laptop && phone !== laptop);
            let status = await (await admin('GET', '')).json();
            assert.deepEqual(status.devices.map(d => d.name), ['Phone', 'Laptop']);
            assert.equal(status.invites.find(i => i.uses === 0).used, 2); // (the other one: the server window's own)
            // removing one leaves the other
            await admin('DELETE', '/devices/' + status.devices[0].id);
            assert.equal(await works(phone), 401);
            assert.equal(await works(laptop), 200);
            // a new main key: the old one stops, devices keep working
            const { key: fresh } = await (await admin('POST', '/key')).json();
            assert.equal(await works(main), 401);
            assert.equal(await works(fresh), 200);
            assert.equal(await works(laptop), 200);
            assert.equal((await admin('GET', '', undefined, fresh)).status, 200);
            // settings are checked before they're saved
            assert.equal((await admin('PUT', '/settings', { mode: 'network', port: 80, data: '' }, fresh)).status, 400);
            // the page itself
            assert.equal((await fetch(host.base + 'page/server.html')).status, 200);
        } finally {
            await host.close();
        }
    });
    await t.test('uploads over the limit refused; 10 wrong keys and that address waits', async () => {
        const guarded = await startServer(5595, { empty: true, env: { KEY, MAX_UPLOAD_MB: '1' } });
        try {
            const put = size => fetch(guarded.base + 'api/files/big', { method: 'PUT', headers: { Authorization: 'Bearer ' + KEY }, body: new Uint8Array(size) });
            assert.equal((await put(512 * 1024)).status, 200);
            assert.equal((await put(2 * 1048576)).status, 413);
            const boot = key => fetch(guarded.base + 'api/boot', { headers: key ? { Authorization: 'Bearer ' + key } : {} });
            for (let i = 0; i < 12; i++) assert.equal((await boot('')).status, 401); // no key at all: not counted
            assert.equal((await boot(KEY)).status, 200);
            const codes = [];
            for (let i = 0; i < 10; i++) codes.push((await boot('wrong' + i)).status);
            assert.deepEqual(codes, Array(10).fill(401)); // the 10th starts the wait
            assert.equal((await boot(KEY)).status, 429); // even with the right key, from that address
        } finally {
            await guarded.close();
        }
    });
    t.finish();
})().catch(e => { console.error(e); process.exit(1); });

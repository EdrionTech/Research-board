// Every page through the server: it starts with no errors, shows the data and saves a change. Also the no-server
// (file://) mode, which only says how to start Research Board.
const path = require('path');
const { REPO, SAMPLE, startServer, launchBrowser, tester } = require('./helpers');

(async () => {
    const t = tester();
    const server = await startServer(5592);
    const { base } = server;
    const browser = await launchBrowser();
    const [project] = SAMPLE.projects;
    const source = SAMPLE.items.find(i => i.type === 'source');

    // opens `url` in a new page; fails on page errors and console errors (other than the internet being out of reach)
    const page = (name, url, verify) => t.test(name, async () => {
        const tab = await browser.newPage();
        const errors = [];
        tab.on('pageerror', e => errors.push('pageerror: ' + e.message));
        tab.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_NAME|net::|youtube|pexels|arxiv/i.test(m.text())) errors.push('console: ' + m.text()); });
        try {
            await tab.goto(url, { waitUntil: 'networkidle' });
            await tab.waitForTimeout(500);
            const problem = await verify(tab);
            if (problem) errors.push(problem);
        } finally { await tab.close(); }
        return errors.join('\n');
    });
    const pending = tab => tab.evaluate(() => document.querySelectorAll('script[data-src]').length);

    await page('home', base, async tab => {
        if (await pending(tab)) return 'scripts not run';
        if (await tab.evaluate(() => Store.mode) !== 'server') return 'mode';
        if (!(await tab.textContent('body')).includes(project.title)) return 'project not shown';
    });
    await page('library', base + 'page/library.html', async tab => (await pending(tab)) ? 'scripts not run' : null);
    await page('dashboard lists the material', base + 'page/project_dashboard.html?id=' + project.id, async tab => {
        if (!(await tab.textContent('body')).includes(source.title)) return 'material not listed';
    });
    await page('material shows its text', base + 'page/material.html?id=' + source.id, async tab => {
        if ((await tab.textContent('#source_title')).trim() !== source.title) return 'title';
        if (!(await tab.textContent('body')).includes('Tests keep a project honest.')) return 'text not shown';
    });
    await page('review', base + 'page/review.html?id=' + project.id, async tab => (await pending(tab)) ? 'scripts not run' : null);
    await page('settings, and a change saved through the page', base + 'page/settings.html', async tab => {
        const info = await tab.textContent('#storage_info');
        if (!info.includes('data folder')) return 'storage info: ' + info;
        await tab.evaluate(() => Store.saveItem({ projectId: 'p1', type: 'source_note', text: 'from the page' }));
        await tab.waitForTimeout(800);
        const after = await (await server.api('GET', 'boot')).json();
        if (!after.data.items.some(i => i.text === 'from the page')) return 'change not saved to the server';
        const back = await tab.evaluate(async () => {
            const id = await Store.putAsset(new File(['hello pdf'], 'a.pdf', { type: 'application/pdf' }));
            const blob = await Store.getAsset(id);
            return [await blob.text(), blob.name, blob.type];
        });
        if (back.join('|') !== 'hello pdf|a.pdf|application/pdf') return 'file round trip: ' + back;
    });
    await page('settings from the data are applied', base, async tab => {
        await server.api('PUT', 'kv/settings', { theme: 'dark', style: 'pixel-pop' });
        await tab.reload({ waitUntil: 'networkidle' });
        const { style, theme } = await tab.evaluate(() => document.documentElement.dataset);
        if (style !== 'pixel-pop' || theme !== 'dark') return `style ${style} theme ${theme}`;
    });
    await page('no server (file://): says how to start it, runs nothing', 'file:///' + path.join(REPO, 'src', 'index.html').replace(/\\/g, '/'), async tab => {
        if (!(await tab.textContent('body')).includes('Start Research Board first')) return 'no message';
        if (await tab.evaluate(() => typeof Store !== 'undefined')) return 'the page scripts ran';
    });

    await browser.close();
    await server.close();
    t.finish();
})().catch(e => { console.error(e); process.exit(1); });

// Every page through the server: it starts with no errors, shows the data and saves a change. Also the no-server
// (file://) mode, which only says how to start Research Board.
const path = require('path');
const { REPO, SAMPLE, startServer, launchBrowser, tester, wait, text } = require('./helpers');

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
            await tab.goto(url, { waitUntil: 'networkidle0' });
            await wait(500);
            const problem = await verify(tab);
            if (problem) errors.push(problem);
        } finally { await tab.close(); }
        return errors.join('\n');
    });
    const pending = tab => tab.evaluate(() => document.querySelectorAll('script[data-src]').length);

    await page('home', base, async tab => {
        if (await pending(tab)) return 'scripts not run';
        if (await tab.evaluate(() => Store.mode) !== 'server') return 'mode';
        if (!(await text(tab, 'body')).includes(project.title)) return 'project not shown';
    });
    await page('library', base + 'page/library.html', async tab => (await pending(tab)) ? 'scripts not run' : null);
    await page('dashboard lists the material', base + 'page/project_dashboard.html?id=' + project.id, async tab => {
        if (!(await text(tab, 'body')).includes(source.title)) return 'material not listed';
    });
    await page('material shows its text', base + 'page/material.html?id=' + source.id, async tab => {
        if ((await text(tab, '#source_title')).trim() !== source.title) return 'title';
        if (!(await text(tab, 'body')).includes('Tests keep a project honest.')) return 'text not shown';
    });
    await page('review', base + 'page/review.html?id=' + project.id, async tab => (await pending(tab)) ? 'scripts not run' : null);
    await page('settings, and a change saved through the page', base + 'page/settings.html', async tab => {
        const info = await text(tab, '#storage_info');
        if (!info.includes('data folder')) return 'storage info: ' + info;
        await tab.evaluate(() => Store.saveItem({ projectId: 'p1', type: 'source_note', text: 'from the page' }));
        await wait(800);
        const after = await (await server.api('GET', 'boot')).json();
        if (!after.data.items.some(i => i.text === 'from the page')) return 'change not saved to the server';
        const back = await tab.evaluate(async () => {
            const id = await Store.putAsset(new File(['hello pdf'], 'a.pdf', { type: 'application/pdf' }));
            const blob = await Store.getAsset(id);
            return [await blob.text(), blob.name, blob.type];
        });
        if (back.join('|') !== 'hello pdf|a.pdf|application/pdf') return 'file round trip: ' + back;
    });
    await page('a note written on the formatted text (Visual) is saved as Markdown', base + 'page/material.html?id=' + source.id, async tab => {
        const box = '#note_form .md_visual';
        if (await tab.$eval(box, e => e.hidden)) return 'the Visual box is not shown';
        await tab.click(box);
        await tab.keyboard.type('Plain then ');
        await tab.keyboard.down('Control'); await tab.keyboard.press('b'); await tab.keyboard.up('Control');
        await tab.keyboard.type('bold');
        await tab.keyboard.down('Control'); await tab.keyboard.press('b'); await tab.keyboard.up('Control');
        await tab.keyboard.type(' [@key2024].');
        await tab.click('#note_form button[type="submit"]');
        await wait(800);
        const saved = (await (await server.api('GET', 'boot')).json()).data.items.find(i => i.type === 'source_note' && /Plain then/.test(i.body || ''));
        if (saved?.body !== 'Plain then **bold** [@key2024].') return 'saved as: ' + JSON.stringify(saved?.body);
    });
    await page('@ cites a paper while writing on the formatted text (Visual)', base + 'page/material.html?id=' + source.id, async tab => {
        await tab.click('#note_form .md_visual');
        await tab.keyboard.type('See @lovel');
        await wait(400);
        if (await tab.$eval('.cite_picker', e => e.hidden)) return 'the list of papers did not open';
        await tab.keyboard.press('Enter');
        await wait(400);
        const text = await tab.$eval('#note_form textarea[name="body"]', e => e.value);
        if (!/^See \[@lovelace\d{4}\w*\]$/.test(text)) return 'the text became: ' + JSON.stringify(text);
    });
    await page('the summary saves from Visual, with a citation chip, even typing right after it', base + 'page/material.html?id=' + source.id, async tab => {
        const field = '[data-field="summary"]';
        await tab.click(`${field} .edit_md`);
        await tab.click(`${field} .md_visual`);
        await tab.keyboard.type('Summary citing @lovel');
        await wait(400);
        await tab.keyboard.press('Enter');
        if (!(await tab.$(`${field} .md_visual .cite`))) return 'no citation chip';
        // the cursor put on the chip goes after it: what's typed there is kept
        const chip = await (await tab.$(`${field} .md_visual .cite`)).boundingBox();
        await tab.mouse.click(chip.x + chip.width / 2, chip.y + chip.height / 2);
        await tab.keyboard.type('done.');
        await tab.click(`${field} .save_md`);
        await wait(800);
        const saved = (await (await server.api('GET', 'boot')).json()).data.items.find(i => i.id === source.id)?.summary || '';
        if (!/^Summary citing \[@lovelace\d{4}\w*\]\s?done\.$/.test(saved)) return 'saved as: ' + JSON.stringify(saved);
    });
    await page('the Cite button puts in Author (year) or (Author, year)', base + 'page/material.html?id=' + source.id, async tab => {
        const field = '[data-field="summary"]';
        // (starts from an empty summary: the test before left one)
        await tab.evaluate(() => { Store.saveItem({ id: source.id, summary: '' }); refresh(); });
        await tab.click(`${field} .edit_md`);
        await tab.click(`${field} .md_visual`);
        await tab.keyboard.type('As ');
        await tab.click(`${field} .md_bar [data-act="cite"]`);
        await wait(300);
        if (await tab.$eval('.cite_picker', e => e.hidden)) return 'the list of papers did not open';
        await tab.keyboard.type('lovel');
        await tab.keyboard.down('Shift'); await tab.keyboard.press('Enter'); await tab.keyboard.up('Shift');
        await tab.keyboard.type('shows it ');
        await tab.click(`${field} .md_bar [data-act="cite"]`);
        await wait(300);
        await tab.click('.cite_form[data-form="parenthetical"]');
        await tab.click(`${field} .save_md`);
        await wait(800);
        const saved = (await (await server.api('GET', 'boot')).json()).data.items.find(i => i.id === source.id)?.summary || '';
        if (!/^As @lovelace\d{4}\w*\s?shows it \[@lovelace\d{4}\w*\]$/.test(saved)) return 'saved as: ' + JSON.stringify(saved);
    });
    await page('review: no Preview beside Visual; a Literature note inserted from the Notes tab', base + 'page/review.html?id=' + project.id, async tab => {
        await server.api('PUT', 'items/g1', { id: 'g1', projectId: project.id, type: 'note', title: 'A literature note', body: 'Notes reach the review.', updatedAt: Date.now() });
        await tab.reload({ waitUntil: 'networkidle0' });
        await wait(500);
        await tab.click('#mode_toggle [data-mode="visual"]');
        if (!(await tab.$eval('#tabs [data-tab="preview"]', b => b.hidden))) return 'Preview still shown in Visual';
        await tab.click('#tabs [data-tab="notes"]');
        await tab.click('#visual_editor');
        await tab.evaluate(() => [...document.querySelectorAll('.lit_note')].find(li => /A literature note/.test(li.textContent))?.querySelector('button').click());
        await wait(800);
        if (!(await tab.$eval('#review_text', e => e.value.includes('Notes reach the review.')))) return 'the note was not inserted';
        await tab.click('#mode_toggle [data-mode="markdown"]');
        if (await tab.$eval('#tabs [data-tab="preview"]', b => b.hidden)) return 'Preview missing in Markdown';
    });
    await page('settings from the data are applied', base, async tab => {
        await server.api('PUT', 'kv/settings', { theme: 'dark', style: 'pixel-pop' });
        await tab.reload({ waitUntil: 'networkidle0' });
        const { style, theme } = await tab.evaluate(() => ({ ...document.documentElement.dataset })); // (a plain object: Puppeteer sends a DOMStringMap as {})
        if (style !== 'pixel-pop' || theme !== 'dark') return `style ${style} theme ${theme}`;
    });
    await page('no server (file://): says how to start it, runs nothing', 'file:///' + path.join(REPO, 'src', 'index.html').replace(/\\/g, '/'), async tab => {
        if (!(await text(tab, 'body')).includes('Start Research Board first')) return 'no message';
        if (await tab.evaluate(() => typeof Store !== 'undefined')) return 'the page scripts ran';
    });

    await browser.close();
    await server.close();
    t.finish();
})().catch(e => { console.error(e); process.exit(1); });

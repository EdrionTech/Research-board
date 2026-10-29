// Without the internet (as in the apps): every request outside the server is refused, and the libraries in
// src/vendor, PDF.js with its worker, and each style's font still load.
const { SAMPLE, startServer, launchBrowser, tester } = require('./helpers');

// a one-page PDF with "Hello offline" on it
const PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 44>>stream
BT /F1 18 Tf 20 70 Td (Hello offline) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`;

(async () => {
    const t = tester();
    const server = await startServer(5594);
    const { base } = server;
    const browser = await launchBrowser();
    const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
    const blocked = new Set();
    await context.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith(base) || url.startsWith('blob:') || url.startsWith('data:')) return route.continue();
        blocked.add(new URL(url).host);
        return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await t.test('libraries load offline (marked, DOMPurify, Turndown)', async () => {
        await page.goto(base + 'page/review.html?id=' + SAMPLE.projects[0].id, { waitUntil: 'networkidle' });
        const ok = await page.evaluate(() => typeof marked === 'object' && typeof DOMPurify === 'function' && typeof TurndownService === 'function');
        if (!ok) return 'not loaded';
    });
    await t.test('PDF.js reads a PDF offline (its worker from src/vendor)', async () => {
        await page.goto(base + 'page/material.html?id=' + SAMPLE.items[0].id, { waitUntil: 'networkidle' });
        const read = await page.evaluate(async src => {
            const doc = await pdfjsLib.getDocument({ data: new TextEncoder().encode(src) }).promise;
            const content = await (await doc.getPage(1)).getTextContent();
            return { worker: pdfjsLib.GlobalWorkerOptions.workerSrc, text: content.items.map(i => i.str).join('') };
        }, PDF);
        if (read.text !== 'Hello offline' || !read.worker.includes('/vendor/pdfjs/')) return JSON.stringify(read);
    });
    await t.test('PDF.js loaded on demand (sources.js) offline', async () => {
        const ok = await page.evaluate(async () => { delete window.pdfjsLib; return !!(await ensurePdfJs()).getDocument; });
        if (!ok) return 'not loaded';
    });
    for (const [style, family] of [['pixel-pop', 'Pixelify Sans'], ['skyglass', 'Source Sans 3']]) {
        await t.test(`${style}: its font (${family}) loads offline`, async () => {
            await server.api('PUT', 'kv/settings', { style, theme: 'light' });
            await page.goto(base, { waitUntil: 'networkidle' });
            const ok = await page.evaluate(async family => {
                await document.fonts.load(`600 16px "${family}"`);
                return [...document.fonts].some(f => f.family.replace(/"/g, '') === family && f.status === 'loaded');
            }, family);
            if (!ok) return 'not loaded';
        });
    }
    await t.test('no page errors', () => errors.join('\n'));
    console.log('     (refused, would have needed the internet:', [...blocked].join(', ') || 'nothing', ')');

    await browser.close();
    await server.close();
    t.finish();
})().catch(e => { console.error(e); process.exit(1); });

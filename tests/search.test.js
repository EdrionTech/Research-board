// Find papers (sources/paper_search.js), wherever materials are added: a project's Literature tab and the Library.
// By subject (the most-cited papers, the last five years or any time), by title / reference / DOI, a paper added
// with its details, one already there shown as such; and the popup at phone width. OpenAlex is faked.
const { startServer, launchBrowser, tester, wait } = require('./helpers');

(async () => {
    const t = tester();
    const server = await startServer(5594);
    const { base, api } = server;
    const browser = await launchBrowser();
    const errors = [];
    const open = async (url, width = 1280) => {
        const tab = await browser.newPage();
        await tab.setViewport({ width, height: 900 });
        tab.on('pageerror', e => errors.push('pageerror: ' + e.message));
        tab.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_NAME|net::/i.test(m.text())) errors.push('console: ' + m.text()); });
        await tab.goto(base + url, { waitUntil: 'networkidle0' });
        await wait(400);
        // OpenAlex, faked: what was asked is kept
        await tab.evaluate(() => {
            const work = (title, doi, cited) => ({ id: doi, cited, fields: { title, kind: 'article', authors: [{ firstName: 'Mo', lastName: 'Reader' }], venue: 'A Journal', published: '2024-02-01', doi, keywords: [], abstract: 'What the paper does.', pdfUrl: '', url: 'https://doi.org/' + doi } });
            window.asked = [];
            PaperSearch.searchWorks = async (q, o) => { asked.push(['subject', q, o.years]); return [work('Reading at scale', '10.1/scale', 400), work('A sample paper on testing', '10.1/dup', 3)]; };
            PaperSearch.findTitle = async q => { asked.push(['title', q]); return [work('How to read a paper', '10.1/keshav', 900)]; };
        });
        return tab;
    };
    const items = async () => (await (await api('GET', 'boot')).json()).data.items;
    const rows = tab => tab.$$eval('#paper_search .works_list li', l => l.map(x => x.textContent));

    await t.test('Literature tab: Find papers by subject, the last five years or any time', async () => {
        const tab = await open('page/project_dashboard.html?id=p1#literature');
        await tab.click('#find_papers');
        await wait(200);
        if (await tab.$eval('#paper_search', m => m.hidden)) return 'no popup';
        await tab.type('#paper_search .works_query', 'reading');
        await tab.keyboard.press('Enter');
        await wait(300);
        const list = await rows(tab);
        if (!list[0]?.includes('Reading at scale') || !list[0].includes('cited 400 times') || !list[0].includes('Abstract')) return 'results: ' + list.join(' | ');
        if (!/In the project/.test(list[1])) return 'the paper already there: ' + list[1];
        await tab.click('#paper_search .works_recent input');
        await wait(300);
        const asked = await tab.evaluate(() => asked);
        if (JSON.stringify(asked.map(a => a[2])) !== '[5,0]') return 'years asked: ' + JSON.stringify(asked);
        await tab.click('#paper_search .works_list [data-pick="0"]');
        await wait(800);
        const added = (await items()).find(i => i.title === 'Reading at scale');
        if (added?.projectId !== 'p1' || added.doi !== '10.1/scale' || added.status !== 'to_read') return 'added: ' + JSON.stringify(added);
        if (!/In the project/.test((await rows(tab))[0])) return 'not shown as added';
        await tab.close();
    });

    await t.test('Literature tab: Find papers by title, reference or DOI', async () => {
        const tab = await open('page/project_dashboard.html?id=p1#literature');
        await tab.click('#find_papers');
        await wait(200);
        await tab.click('#paper_search [data-by="title"]');
        if (!(await tab.$eval('#paper_search .works_recent', r => r.hidden))) return 'the years option should be for subjects only';
        await tab.type('#paper_search .works_query', 'S. Keshav. How to read a paper. 2007.');
        await tab.keyboard.press('Enter');
        await wait(300);
        if (!(await rows(tab))[0]?.includes('How to read a paper')) return 'results: ' + (await rows(tab)).join(' | ');
        const asked = await tab.evaluate(() => asked);
        if (asked[0][0] !== 'title') return 'asked: ' + JSON.stringify(asked);
        await tab.close();
    });

    await t.test('Library: Find papers adds to the Library', async () => {
        const tab = await open('page/library.html');
        await tab.click('#find_papers');
        await wait(200);
        await tab.type('#paper_search .works_query', 'reading');
        await tab.keyboard.press('Enter');
        await wait(300);
        // "Reading at scale" is in project p1 now: still addable to the Library, with a word that it's elsewhere
        const first = (await rows(tab))[0];
        if (!/Add to Library/.test(first) || !/Already in a project/.test(first)) return 'the first result: ' + first;
        await tab.click('#paper_search .works_list [data-pick="0"]');
        await wait(800);
        const inLibrary = (await items()).filter(i => i.title === 'Reading at scale').map(i => i.projectId).sort();
        if (inLibrary.join() !== 'library,p1') return 'copies: ' + inLibrary;
        await tab.close();
    });

    await t.test('phone width: the popup fits', async () => {
        const tab = await open('page/library.html', 360);
        await tab.click('#find_papers');
        await wait(200);
        await tab.type('#paper_search .works_query', 'reading');
        await tab.keyboard.press('Enter');
        await wait(300);
        const wide = await tab.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        await tab.screenshot({ path: require('path').join(__dirname, 'shots', 'phone-find-papers.png') });
        await tab.close();
        if (wide > 1) return `too wide by ${wide}px`;
    });

    await t.test('no page errors', async () => errors.join('\n'));
    await browser.close();
    await server.close();
    t.finish();
})();

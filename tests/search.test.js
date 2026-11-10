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
        tab.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_NAME|net::/i.test(m.text()) && !/openalex|semanticscholar|crossref|unpaywall|arxiv/i.test(m.text() + ' ' + (m.location()?.url || ''))) errors.push('console: ' + m.text()); }); // (a made-up DOI isn't known out there: those 404s are fine)
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
    const rows = tab => tab.$$eval('#find_papers_popup .works_list li', l => l.map(x => x.textContent));

    await t.test('Literature tab: Find papers by subject, the last five years or any time', async () => {
        const tab = await open('page/project_dashboard.html?id=p1#literature');
        await tab.click('#find_papers');
        await wait(200);
        if (await tab.$eval('#find_papers_popup', m => m.hidden)) return 'no popup';
        await tab.type('#find_papers_popup .works_query', 'reading');
        await tab.keyboard.press('Enter');
        await wait(300);
        const list = await rows(tab);
        if (!list[0]?.includes('Reading at scale') || !list[0].includes('cited 400 times') || !list[0].includes('Abstract')) return 'results: ' + list.join(' | ');
        if (!/In the project/.test(list[1])) return 'the paper already there: ' + list[1];
        await tab.click('#find_papers_popup .works_recent input');
        await wait(300);
        const asked = await tab.evaluate(() => asked);
        if (JSON.stringify(asked.map(a => a[2])) !== '[5,0]') return 'years asked: ' + JSON.stringify(asked);
        await tab.click('#find_papers_popup .works_list [data-pick="0"]');
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
        await tab.click('#find_papers_popup [data-by="title"]');
        if (!(await tab.$eval('#find_papers_popup .works_recent', r => r.hidden))) return 'the years option should be for subjects only';
        await tab.type('#find_papers_popup .works_query', 'S. Keshav. How to read a paper. 2007.');
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
        await tab.type('#find_papers_popup .works_query', 'reading');
        await tab.keyboard.press('Enter');
        await wait(300);
        // "Reading at scale" is in project p1 now: still addable to the Library, with a word that it's elsewhere
        const first = (await rows(tab))[0];
        if (!/Add to Library/.test(first) || !/Already in a project/.test(first)) return 'the first result: ' + first;
        await tab.click('#find_papers_popup .works_list [data-pick="0"]');
        await wait(800);
        const inLibrary = (await items()).filter(i => i.title === 'Reading at scale').map(i => i.projectId).sort();
        if (inLibrary.join() !== 'library,p1') return 'copies: ' + inLibrary;
        await tab.close();
    });

    await t.test('+ Source: a title typed instead of a link can be searched for, and the paper picked opens', async () => {
        const tab = await open('page/project_dashboard.html?id=p1#literature');
        await tab.click('#add_source');
        await wait(200);
        if (!(await tab.$eval('.source_form .lookup_search', p => p.hidden))) return 'search links shown before typing';
        await tab.type('.source_form input[name="url"]', 'How to read a paper');
        await wait(100);
        if (await tab.$eval('.source_form .lookup_search', p => p.hidden)) return 'no search links for a title';
        await tab.click('.source_form [data-search="title"]');
        await wait(400);
        if (await tab.$eval('#find_papers_popup', m => m.hidden)) return 'no search popup';
        if (await tab.$eval('#find_papers_popup .works_query', q => q.value) !== 'How to read a paper') return 'not prefilled';
        if (!(await rows(tab))[0]?.includes('How to read a paper')) return 'not searched at once: ' + (await rows(tab)).join(' | ');
        await Promise.all([tab.waitForNavigation({ waitUntil: 'networkidle0' }), tab.click('#find_papers_popup .works_list [data-pick="0"]')]);
        if (!tab.url().includes('material.html')) return 'opened ' + tab.url();
        // a DOI typed: no search links (Look up finds it)
        await tab.goto(base + 'page/project_dashboard.html?id=p1#literature', { waitUntil: 'networkidle0' });
        await wait(300);
        await tab.click('#add_source');
        await tab.type('.source_form input[name="url"]', '10.1145/1273445.1273458');
        await wait(100);
        if (!(await tab.$eval('.source_form .lookup_search', p => p.hidden))) return 'search links for a DOI';
        await tab.close();
    });

    await t.test('a reference OpenAlex doesn’t know is found in Crossref', async () => {
        const tab = await open('page/library.html');
        const found = await tab.evaluate(async () => {
            // the real findTitle (not the fake), with both services answering from here
            const real = await fetch('../script/sources/paper_search.js').then(r => r.text());
            const P = new Function(real.replace(/^const PaperSearch = /m, 'return ').replace(/;\s*$/, ''))();
            window.fetch = async url => ({
                ok: true,
                json: async () => String(url).includes('openalex') ? { results: [{ id: 'W1', title: 'Something else entirely', cited_by_count: 9 }] }
                    : { message: { items: [{ DOI: '10.9/obscure', title: ['An obscure workshop paper on reading'], author: [{ given: 'Ada', family: 'Lovelace' }], issued: { 'date-parts': [[2019]] }, 'container-title': ['A Workshop'], 'is-referenced-by-count': 4, type: 'proceedings-article' }] } },
            });
            const list = await P.findTitle('A. Lovelace. An obscure workshop paper on reading. In A Workshop, 2019.');
            return list.map(r => `${r.fields.title} (${r.from || 'OpenAlex'})`);
        });
        await tab.close();
        if (found[0] !== 'An obscure workshop paper on reading (Crossref)') return 'found: ' + found.join(' | ');
    });

    await t.test('phone width: the popup fits', async () => {
        const tab = await open('page/library.html', 360);
        await tab.click('#find_papers');
        await wait(200);
        await tab.type('#find_papers_popup .works_query', 'reading');
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

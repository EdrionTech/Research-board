// The literature survey board (sources/survey.js, pages/dashboard/survey.js): materials in columns by how far
// they've been read, the survey's steps, seed papers starred, the key papers and authors the references of
// first-passed papers share, one added to the project; and the board at phone width.
const { startServer, launchBrowser, tester, wait } = require('./helpers');

(async () => {
    const t = tester();
    const server = await startServer(5596);
    const { base, api } = server;
    const now = Date.now();
    const ref = (n, text, extra = {}) => ({ n: String(n), text, ...extra });
    const shared = 'S. Keshav. How to read a paper. ACM SIGCOMM Computer Communication Review, 37(3), 2007.';
    const sharedDoi = 'A. Vaswani, N. Shazeer and N. Parmar. Attention is all you need. In NeurIPS, 2017.';
    const source = (id, title, references, extra = {}) => ({
        id, projectId: 'p1', type: 'source', kind: 'article', title, authors: [{ firstName: 'Ada', lastName: id.toUpperCase() }],
        published: '2024', status: 'reading', references, createdAt: now, updatedAt: now, ...extra,
    });
    const passes = (id, sourceId, extra) => ({ id, projectId: 'p1', type: 'passes', sourceId, on: true, roles: {}, marks: [], createdAt: now, updatedAt: now, ...extra });
    for (const item of [
        source('a', 'Paper A', [ref(1, shared), ref(2, sharedDoi, { doi: '10.5555/attn' }), ref(3, 'J. Doe. Something only A cites. 2019.')]),
        source('b', 'Paper B', [ref(1, shared), ref(2, sharedDoi, { doi: '10.5555/ATTN' }), ref(3, 'K. Lee. Another single citation here. 2020.')]),
        source('c', 'Paper C', [ref(1, shared)]),
        source('d', 'Paper D', []),
        passes('pa', 'a', { pass: 2, state: 'reading', passes: { 1: { doneAt: now, cs: { category: 'A measurement study' } }, 2: {} } }),
        passes('pb', 'b', { pass: 1, state: 'stopped', passes: { 1: { doneAt: now } } }),
        passes('pc', 'c', { pass: 1, state: 'reading', passes: { 1: { activeMs: 120000 } } }),
    ]) await api('PUT', 'items/' + item.id, item);
    await api('PUT', 'projects/p1', { id: 'p1', title: 'Sample project', desc: '', surveySeeds: ['a', 'b'] });

    const browser = await launchBrowser();
    const errors = [];
    const open = async (width = 1280) => {
        const tab = await browser.newPage();
        await tab.setViewport({ width, height: 900 });
        tab.on('pageerror', e => errors.push('pageerror: ' + e.message));
        tab.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_NAME|net::/i.test(m.text())) errors.push('console: ' + m.text()); });
        await tab.goto(base + 'page/project_dashboard.html?id=p1#literature', { waitUntil: 'networkidle0' });
        await wait(400);
        return tab;
    };
    const column = (tab, title) => tab.evaluate(t => [...document.querySelectorAll('.survey_card')].find(c => c.textContent.includes(t))?.closest('.survey_col').dataset.col, title);

    const tab = await open();
    await t.test('Survey shows the board: each material in its column', async () => {
        await tab.click('#lit_view [data-view="survey"]');
        await wait(300);
        if (await tab.$eval('#survey', s => s.hidden)) return 'no board';
        if (await tab.$eval('#source_list', l => l.offsetParent !== null)) return 'the list still shows';
        const where = { 'Paper A': 'p2', 'Paper B': 'stopped', 'Paper C': 'p1', 'Paper D': 'new' };
        for (const [title, col] of Object.entries(where)) {
            const got = await column(tab, title);
            if (got !== col) return `${title} in ${got}, not ${col}`;
        }
        if (!(await tab.evaluate(() => document.body.textContent.includes('A measurement study')))) return 'the five-Cs category is not on the card';
        await (await tab.$('.library')).screenshot({ path: require('path').join(__dirname, 'shots', 'desktop-survey.png') });
    });

    await t.test('the steps: seeds starred, both had a first pass, on to the key papers', async () => {
        const states = await tab.$$eval('.survey_step', s => s.map(x => x.dataset.state));
        if (states.join(',') !== 'done,done,current,') return 'steps: ' + states.join(',');
    });

    await t.test('the key papers: works cited by two first-passed papers, the same DOI in any case', async () => {
        const papers = await tab.$$eval('.survey_paper', list => list.map(p => p.querySelector('.survey_count').textContent + ' ' + p.querySelector('strong').textContent));
        if (papers.length !== 2) return 'papers: ' + papers.join(' | ');
        if (!papers.some(p => p.startsWith('2 ') && /read a paper/i.test(p))) return 'the shared title is missing: ' + papers.join(' | ');
        if (!papers.some(p => /attention/i.test(p))) return 'the shared DOI is missing: ' + papers.join(' | ');
        const authors = await tab.$$eval('.survey_author', a => a.map(x => x.textContent));
        if (!authors.some(a => a.includes('Keshav'))) return 'authors: ' + authors.join(', ');
    });

    await t.test('starring a seed is saved on the project', async () => {
        await tab.evaluate(() => [...document.querySelectorAll('.survey_card')].find(c => c.textContent.includes('Paper D')).querySelector('.survey_star').click());
        await wait(800);
        const project = (await (await api('GET', 'boot')).json()).data.projects.find(p => p.id === 'p1');
        if (!project.surveySeeds.includes('d')) return 'seeds: ' + project.surveySeeds;
        const states = await tab.$$eval('.survey_step', s => s.map(x => x.dataset.state));
        if (states[1] !== 'current') return 'a new seed without a first pass should make step 2 current: ' + states;
    });

    await t.test('+ Add makes a key paper, cited by both', async () => {
        await tab.evaluate(() => { References.lookup = async () => ({ fields: { title: 'How to read a paper', published: '2007' }, found: true }); });
        await tab.evaluate(() => [...document.querySelectorAll('.survey_paper')].find(p => /read a paper/i.test(p.textContent)).querySelector('[data-add]').click());
        await wait(1000);
        const added = (await (await api('GET', 'boot')).json()).data.items.find(i => i.type === 'source' && i.title === 'How to read a paper');
        if (!added?.surveyKey) return 'not added as a key paper';
        if ((added.citedIn || []).sort().join() !== 'a,b') return 'cited in ' + added.citedIn;
        if (await column(tab, 'How to read a paper') !== 'new') return 'not on the board';
        const left = await tab.$$eval('.survey_paper strong', s => s.map(x => x.textContent));
        if (left.some(x => /read a paper/i.test(x))) return 'still suggested after being added';
        if (!(await tab.$$eval('.survey_author', a => a.some(x => x.textContent.includes('Keshav'))))) return 'its author no longer counted';
    });

    await t.test('the view is remembered; List brings the list back', async () => {
        await tab.reload({ waitUntil: 'networkidle0' });
        await wait(400);
        if (await tab.$eval('#survey', s => s.hidden)) return 'survey view not remembered';
        await tab.click('#lit_view [data-view="list"]');
        await wait(200);
        if (!(await tab.$eval('#survey', s => s.hidden))) return 'board still shown';
    });
    await tab.close();

    await t.test('phone width: nothing scrolls sideways', async () => {
        const phone = await open(360);
        await phone.click('#lit_view [data-view="survey"]');
        await wait(300);
        const wide = await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        await phone.screenshot({ path: require('path').join(__dirname, 'shots', 'phone-survey.png'), fullPage: true });
        await phone.evaluate(() => document.querySelector('#lit_view [data-view="list"]').click());
        await phone.close();
        if (wide > 1) return `the page is ${wide}px too wide`;
    });

    await t.test('no page errors', async () => errors.join('\n'));
    await browser.close();
    await server.close();
    t.finish();
})();

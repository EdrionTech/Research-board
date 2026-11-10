// The literature survey board (sources/survey.js, pages/dashboard/survey.js): materials in columns by how far
// they've been read, the survey's steps, seed papers starred, the key papers and authors the references of
// first-passed papers share, one added to the project; the venues they cite and a venue's recent papers, a survey
// paper's references used, papers found to start from (OpenAlex faked); a reference marked to follow up as a key
// paper; a recurring author opening the author filter; a seed paper's related work open in pass 1;
// and the board at phone width.
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
        source('a', 'Paper A', [ref(1, shared), ref(2, sharedDoi, { doi: '10.5555/attn' }), ref(3, 'J. Doe. Something only A cites. 2019.')], { summary: '### Category\nA measurement study', sectioned: true }),
        source('b', 'Paper B', [ref(1, shared), ref(2, sharedDoi, { doi: '10.5555/ATTN' }), ref(3, 'K. Lee. Another single citation here. 2020.')]),
        source('c', 'Paper C', [ref(1, shared)]),
        source('d', 'Paper D', []),
        source('e', 'A survey of reading in passes', [ref(1, 'M. Adler. How to read a book. Simon and Schuster, 1972.')]),
        source('g', 'Paper G', [], { authors: [{ firstName: 'Ashish', lastName: 'Vaswani' }] }),
        source('f', 'Paper F', [], { text: ['# Introduction', '', 'Why it matters.', '', '## Related work', '', 'Others did this before.', '', '## Method', '', 'What we did.'].join('\n') }),
        passes('pe', 'e', { pass: 1, state: 'stopped', passes: { 1: { doneAt: now } } }),
        // highlights across papers: enough to need scrolling, one about timing
        ...Array.from({ length: 24 }, (_, i) => ({ id: 'h' + i, projectId: 'p1', type: 'source_note', sourceId: i % 2 ? 'a' : 'b', color: 'yellow',
            quote: i === 7 ? 'Each pass was timed carefully.' : `A highlighted passage number ${i}.`, body: '', page: String(i + 1), createdAt: now, updatedAt: now })),
        passes('pa', 'a', { pass: 2, state: 'reading', passes: { 1: { doneAt: now }, 2: {} } }),
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
        const papers = await tab.$$eval('.survey_papers .survey_paper', list => list.map(p => p.querySelector('.survey_count').textContent + ' ' + p.querySelector('strong').textContent));
        if (papers.length !== 2) return 'papers: ' + papers.join(' | ');
        if (!papers.some(p => p.startsWith('2 ') && /read a paper/i.test(p))) return 'the shared title is missing: ' + papers.join(' | ');
        if (!papers.some(p => /attention/i.test(p))) return 'the shared DOI is missing: ' + papers.join(' | ');
        const authors = await tab.$$eval('a.survey_chip', a => a.map(x => x.textContent));
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
        if (!(await tab.$$eval('a.survey_chip', a => a.some(x => x.textContent.includes('Keshav'))))) return 'its author no longer counted';
    });

    await t.test('the venues the references cite most, however they are written', async () => {
        const venues = await tab.$$eval('button.survey_chip', b => b.map(x => x.textContent));
        if (!venues.some(v => v.startsWith('NeurIPS')) || !venues.some(v => v.startsWith('SIGCOMM'))) return 'venues: ' + venues.join(', ');
    });

    await t.test('a survey paper lends its whole reference list', async () => {
        const used = await tab.evaluate(() => {
            const b = [...document.querySelectorAll('[data-survey]')].find(x => x.textContent === 'Use its references');
            b?.click();
            return !!b;
        });
        if (!used) return 'no survey paper offered';
        await wait(500);
        const papers = await tab.$$eval('.survey_papers strong', s => s.map(x => x.textContent));
        if (!papers.some(p => /read a book/i.test(p))) return 'its references are not key papers: ' + papers.join(' | ');
    });

    await t.test('a venue: its recent papers, one added to the survey', async () => {
        await tab.evaluate(() => {
            PaperSearch.findVenue = async () => ({ id: 'S1', name: 'Neural Information Processing Systems' });
            PaperSearch.venueWorks = async () => [{ id: 'W1', cited: 50, fields: { title: 'A recent NeurIPS paper', kind: 'article', authors: [{ firstName: 'Xu', lastName: 'Yi' }], venue: 'NeurIPS', published: '2025', doi: '10.1/recent', keywords: [], abstract: '', pdfUrl: '', url: '' } }];
            [...document.querySelectorAll('button.survey_chip')].find(b => b.textContent.startsWith('NeurIPS')).click();
        });
        await wait(400);
        if (await tab.$eval('#find_papers_popup', m => m.hidden)) return 'no popup';
        if (!/Neural Information Processing Systems/.test(await tab.$eval('#find_papers_popup .works_title', h => h.textContent))) return 'title';
        await tab.click('#find_papers_popup .works_list [data-pick="0"]');
        await wait(800);
        const added = (await (await api('GET', 'boot')).json()).data.items.find(i => i.title === 'A recent NeurIPS paper');
        if (!added?.surveyKey) return 'not added to the survey';
        if (!/In the project/.test(await tab.$eval('#find_papers_popup .works_list', l => l.textContent))) return 'not shown as added';
        await tab.click('#find_papers_popup [data-close]');
    });

    await t.test('papers to start from: found, one added as a seed', async () => {
        await tab.evaluate(() => {
            PaperSearch.searchWorks = async () => [{ id: 'W2', cited: 300, fields: { title: 'A much cited recent paper', kind: 'article', authors: [], venue: 'Nature', published: '2023', doi: '10.1/cited', keywords: [], abstract: '', pdfUrl: '', url: '' } }];
        });
        await tab.evaluate(() => { document.querySelector('.survey_fold[data-fold="steps"]').open = true; });
        await tab.click('[data-find]');
        await wait(200);
        await tab.type('#find_papers_popup .works_query', 'reading');
        await tab.keyboard.press('Enter');
        await wait(400);
        await tab.click('#find_papers_popup .works_list [data-pick="0"]');
        await wait(800);
        const data = (await (await api('GET', 'boot')).json()).data;
        const added = data.items.find(i => i.title === 'A much cited recent paper');
        if (!added) return 'not added';
        if (!data.projects.find(p => p.id === 'p1').surveySeeds.includes(added.id)) return 'not a seed';
        await tab.click('#find_papers_popup [data-close]');
    });

    await t.test('a reference marked to follow up on its paper is a key paper, even cited once', async () => {
        await tab.evaluate(() => {
            Passes.markReference(Store.getItem('a'), '3', 'followUp', true);
            window.render();
        });
        await wait(300);
        const row = await tab.evaluate(() => [...document.querySelectorAll('.survey_papers .survey_paper')].find(p => /only A cites/i.test(p.textContent))?.textContent || '');
        if (!/marked it to follow up/i.test(row)) return 'not a key paper: ' + row;
    });

    await t.test('a recurring author with papers here opens the author filter', async () => {
        await tab.$eval('#survey', s => s.scrollIntoView());
        const chip = await tab.evaluate(() => {
            const b = [...document.querySelectorAll('button.survey_chip[data-author]')].find(x => x.textContent.includes('Vaswani'));
            b?.click();
            return !!b;
        });
        if (!chip) return 'Vaswani (who has a paper here) is not a filter chip';
        await wait(400);
        const cards = await tab.$$eval('.survey_card strong', s => s.map(x => x.textContent));
        if (cards.join() !== 'Paper G') return 'the board shows ' + cards.join(', ');
        await tab.evaluate(() => document.querySelector('#author_filter .author_clear')?.click());
        await wait(300);
    });

    await t.test('the parts fold, and stay as you left them', async () => {
        const parts = await tab.$$eval('.survey_fold', f => f.map(x => x.dataset.fold));
        for (const part of ['steps', 'board', 'papers', 'authors', 'venues']) if (!parts.includes(part)) return 'no fold for ' + part + ': ' + parts;
        await tab.evaluate(() => { const f = document.querySelector('.survey_fold[data-fold="authors"]'); f.open = true; });
        await wait(100);
        await tab.evaluate(() => window.render());
        await wait(200);
        if (!(await tab.$eval('.survey_fold[data-fold="authors"]', f => f.open))) return 'not kept open';
        if (await tab.$('.survey_col .survey_empty')) return 'an empty column is still drawn';
    });

    await t.test('the Summaries box holds each material’s summary as its own item', async () => {
        const rows = await tab.$$eval('.section[data-type="summary"] .item.from_material', r => r.map(x => x.textContent));
        if (!rows.some(r => r.includes('Paper A') && r.includes('Category'))) return 'items: ' + rows.join(' | ');
    });

    await t.test('a material summary opens in a popup to read and edit, section by section', async () => {
        await tab.evaluate(() => [...document.querySelectorAll('.section[data-type="summary"] .item.from_material')].find(r => r.textContent.includes('Paper A')).click());
        await wait(300);
        if (await tab.$eval('#summary_modal', m => m.hidden)) return 'no popup';
        if (!/A measurement study/.test(await tab.$eval('#summary_modal_body', b => b.textContent))) return 'the summary is not shown';
        await tab.click('#summary_modal_body .sum_sec[data-title="Category"] [data-edit]');
        await wait(200);
        await tab.$eval('#summary_modal_body textarea', a => { a.value = 'A careful measurement study'; });
        await tab.click('#summary_modal_body [data-save]');
        await wait(800);
        const a = (await (await api('GET', 'boot')).json()).data.items.find(i => i.id === 'a');
        if (!/### Category\nA careful measurement study/.test(a.summary)) return 'not saved: ' + JSON.stringify(a.summary);
        if (!/A careful measurement study/.test(await tab.$eval('#summary_modal_body', b => b.textContent))) return 'the popup did not show the change';
        await tab.click('#summary_modal [data-close]');
    });

    await t.test('highlights across papers: a box of its own height, and searchable', async () => {
        const box = await tab.$eval('#highlight_list', l => ({ client: l.clientHeight, scroll: l.scrollHeight, overflow: getComputedStyle(l).overflowY }));
        if (box.overflow !== 'auto' || box.scroll <= box.client) return 'does not scroll inside its box: ' + JSON.stringify(box);
        await tab.type('#highlight_search', 'timed');
        await wait(200);
        const shown = await tab.$$eval('#highlight_list .highlight_text', b => b.map(x => x.textContent));
        if (shown.join() !== 'Each pass was timed carefully.') return 'the search shows: ' + shown.join(' | ');
        if (await tab.$eval('#highlight_count', c => c.textContent) !== '1 of 24') return 'count: ' + await tab.$eval('#highlight_count', c => c.textContent);
        // by the colour's name (yellow is "Important")
        await tab.$eval('#highlight_search', i => { i.value = 'important timed'; i.dispatchEvent(new Event('input')); });
        await wait(200);
        if ((await tab.$$('#highlight_list .highlight')).length !== 1) return 'every word must match: ' + (await tab.$$('#highlight_list .highlight')).length;
        await tab.$eval('#highlight_search', i => { i.value = ''; i.dispatchEvent(new Event('input')); });
    });

    await t.test('the view is remembered; List brings the list back', async () => {
        await tab.reload({ waitUntil: 'networkidle0' });
        await wait(400);
        if (await tab.$eval('#survey', s => s.hidden)) return 'survey view not remembered';
        await tab.$eval('#lit_view', b => b.scrollIntoView({ block: 'center' })); // (the page comes back scrolled: under the top bar)
        await tab.click('#lit_view [data-view="list"]');
        await wait(200);
        if (!(await tab.$eval('#survey', s => s.hidden))) return 'board still shown';
    });
    await tab.close();

    await t.test('a seed paper in pass 1: its related work is open too, with a step for it', async () => {
        await api('PUT', 'projects/p1', { ...(await (await api('GET', 'boot')).json()).data.projects.find(p => p.id === 'p1'), surveySeeds: ['a', 'b', 'f'] });
        const page = await browser.newPage();
        page.on('pageerror', e => errors.push('pageerror: ' + e.message));
        await page.goto(base + 'page/material.html?id=f', { waitUntil: 'networkidle0' });
        await wait(400);
        await page.click('#passes_btn');
        await wait(400);
        const state = w => page.evaluate(x => { const l = [...document.querySelectorAll('#reader_text .line')].find(l => l.dataset.text.includes(x)); return l && !!l.offsetParent; }, w);
        const problem = !(await state('Others did this before')) ? 'related work folded'
            : (await state('What we did')) ? 'method not folded'
            : !(await page.$('#pass_form [data-path="sec:field"]')) ? 'no step for the related work' : null;
        await page.close();
        return problem;
    });

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

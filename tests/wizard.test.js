// From your reading to a literature review (writing/review_plan.js, pages/dashboard/wizard.js): the papers chosen
// to start with, themes suggested by shared citations and by tags, a paper moved between themes, the skeleton
// built from the papers' summaries (a theme's papers cited together, each one's argument, the gaps), written into
// the empty literature review; a paper-by-paper review as a new draft; and the wizard at phone width.
const { startServer, launchBrowser, tester, wait } = require('./helpers');

(async () => {
    const t = tester();
    const server = await startServer(5595);
    const { base, api } = server;
    const now = Date.now();
    const ref = (n, text) => ({ n: String(n), text });
    const shared = [ref(1, 'S. Keshav. How to read a paper. ACM SIGCOMM Computer Communication Review, 2007.'), ref(2, 'M. Adler. How to read a book. Simon and Schuster, 1972.')];
    const summary = (category, argument, weak) => ['### Category', category, '', '### The main argument', argument, ...(weak ? ['', '### Weak spots', weak] : [])].join('\n');
    const paper = (id, title, extra) => ({
        id, projectId: 'p1', type: 'source', kind: 'article', title, authors: [{ firstName: 'Ada', lastName: id.toUpperCase() }],
        published: '202' + id.charCodeAt(0) % 10, status: 'reading', sectioned: true, createdAt: now, updatedAt: now, ...extra,
    });
    for (const item of [
        paper('a', 'Reading in passes', { tags: ['reading'], references: shared, summary: summary('A user study', 'Passes save time.', 'Only twelve readers.') }),
        paper('b', 'Skimming papers', { tags: ['reading'], references: shared, summary: summary('A user study', 'Skimming finds the gist.') }),
        paper('c', 'A new reader tool', { tags: ['tools'], references: [], summary: summary('A new system', 'A tool helps triage.') }),
    ]) await api('PUT', 'items/' + item.id, item);

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
    const boot = async () => (await (await api('GET', 'boot')).json()).data;
    const themes = tab => tab.$$eval('.wizard_theme', list => list.map(t => (t.querySelector('.wizard_theme_name')?.value || t.querySelector('strong')?.textContent) + ': '
        + [...t.querySelectorAll('.wizard_theme_papers li > span')].map(s => s.textContent.split(': ').pop()).join(', ')));

    let tab = await open();
    await t.test('the wizard opens with the papers that have a summary, by theme', async () => {
        await tab.click('[data-open-wizard]');
        await wait(300);
        if (await tab.$eval('#wizard_modal', m => m.hidden)) return 'no wizard';
        const checked = await tab.$$eval('#wizard_body [data-paper]', b => b.filter(x => x.checked).map(x => x.dataset.paper));
        if (checked.sort().join() !== 'a,b,c') return 'chosen: ' + checked; // (the sample paper has no summary)
        await tab.$eval('#wizard_body [data-field="question"]', q => { q.value = 'How do people decide what to read?'; q.dispatchEvent(new Event('input', { bubbles: true })); });
    });

    await t.test('themes by shared citations; then by tags; a paper moved', async () => {
        await tab.click('#wizard_next');
        await wait(200);
        let list = await themes(tab);
        if (!list.some(x => /^Around “How to read a/.test(x) && /Reading in passes/.test(x) && /Skimming papers/.test(x))) return 'by citations: ' + list.join(' | ');
        await tab.click('#wizard_body [data-basis="tags"]');
        await wait(200);
        list = await themes(tab);
        if (!list.includes('reading: Reading in passes, Skimming papers') || !list.includes('tools: A new reader tool')) return 'by tags: ' + list.join(' | ');
        await tab.select('#wizard_body [data-move="c"]', '0');
        await wait(200);
        list = await themes(tab);
        if (!list[0].includes('A new reader tool')) return 'not moved: ' + list.join(' | ');
    });

    await t.test('the skeleton: the theme’s papers cited together, each argument, the gaps', async () => {
        await tab.click('#wizard_next');
        await wait(300);
        const md = await tab.evaluate(() => document.querySelector('#wizard_body .wizard_preview').textContent);
        for (const want of ['How do people decide what to read?', 'reading', 'Passes save time.', 'A tool helps triage.', 'Weak spots', 'Only twelve readers.', 'Conclusion']) {
            if (!md.includes(want)) return 'missing “' + want + '” in: ' + md.slice(0, 400);
        }
    });

    await t.test('into the empty literature review, then it opens', async () => {
        await Promise.all([tab.waitForNavigation({ waitUntil: 'networkidle0' }), tab.click('#wizard_next')]);
        if (!tab.url().includes('review.html')) return 'opened ' + tab.url();
        const review = (await boot()).items.find(i => i.type === 'lit_review');
        if (!review) return 'no review';
        if (!/^# Literature review\n\n## Introduction\n\nHow do people decide what to read\?/.test(review.body)) return 'begins: ' + review.body.slice(0, 120);
        if (!/## reading\n\nPapers: \[@\w+; @\w+; @\w+\]/.test(review.body)) return 'the theme: ' + review.body;
    });
    await tab.close();

    await t.test('paper by paper, as a new draft (the review has text now)', async () => {
        tab = await open();
        await tab.click('[data-open-wizard]');
        await wait(300);
        await tab.click('#wizard_body [data-kind="paper"]');
        await tab.$eval('#wizard_body [data-field="title"]', i => { i.value = 'Three papers on reading'; i.dispatchEvent(new Event('input', { bubbles: true })); });
        await tab.click('#wizard_next');
        await wait(200);
        await tab.click('#wizard_next');
        await wait(200);
        if (!(await tab.$eval('#wizard_body [data-dest="draft"]', b => b.getAttribute('aria-pressed') === 'true'))) return 'a new draft should be the choice';
        await Promise.all([tab.waitForNavigation({ waitUntil: 'networkidle0' }), tab.click('#wizard_next')]);
        const draft = (await boot()).items.find(i => i.type === 'draft' && i.title === 'Three papers on reading');
        if (!draft) return 'no draft';
        if (!/## .*: Reading in passes\n\n\[@\w+\]\n\n\*\*What it is:\*\* A user study/.test(draft.body)) return 'the draft: ' + draft.body.slice(0, 300);
        if (!/## Comparing them/.test(draft.body)) return 'no comparison section';
        await tab.close();
    });

    await t.test('phone width: the wizard fits', async () => {
        const phone = await open(360);
        await phone.click('[data-open-wizard]');
        await wait(300);
        const wide = await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        await phone.click('#wizard_next');
        await wait(200);
        const wide2 = await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        await phone.screenshot({ path: require('path').join(__dirname, 'shots', 'phone-wizard.png') });
        await phone.close();
        if (wide > 1 || wide2 > 1) return `too wide by ${Math.max(wide, wide2)}px`;
    });

    await t.test('no page errors', async () => errors.join('\n'));
    await browser.close();
    await server.close();
    t.finish();
})();

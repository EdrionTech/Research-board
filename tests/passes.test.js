// Reading in passes (sources/passes.js, pages/material_passes.js): the sections each pass shows, peeking, the
// five Cs saved, going on to the next pass, skipping one (recorded), predicting in pass 3, a section's role
// changed in Contents, leaving and coming back; what the passes write being the paper's own (its status, the five Cs
// in the notes side, its Summary and Assessment, its reference marks, the evidence colour, a captured figure's
// checks); and the bar at phone width.
const { SAMPLE, startServer, launchBrowser, tester, wait } = require('./helpers');

(async () => {
    const t = tester();
    const server = await startServer(5597);
    const { base } = server;
    const browser = await launchBrowser();
    const source = SAMPLE.items.find(i => i.type === 'source');
    const url = base + 'page/material.html?id=' + source.id;

    const errors = [];
    const open = async (width = 1280) => {
        const tab = await browser.newPage();
        await tab.setViewport({ width, height: 800 });
        tab.on('pageerror', e => errors.push('pageerror: ' + e.message));
        tab.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_NAME|net::/i.test(m.text())) errors.push('console: ' + m.text()); });
        await tab.goto(url, { waitUntil: 'networkidle0' });
        await wait(400);
        return tab;
    };
    // is the line with these words shown, folded or blurred
    const lineState = (tab, words) => tab.evaluate(w => {
        const line = [...document.querySelectorAll('#reader_text .line')].find(l => l.dataset.text.includes(w));
        if (!line) return 'missing';
        if (!line.offsetParent) return 'folded';
        return line.classList.contains('pass_blur') ? 'blurred' : 'shown';
    }, words);
    const record = tab => tab.evaluate(() => Passes.of(source));
    const items = async () => (await (await server.api('GET', 'boot')).json()).data.items;
    const saved = async (id) => (await items()).find(i => (id ? i.id === id : i.type === 'passes'));
    // the sample paper gets a reference list (its References panel, the marks)
    const s1 = (await items()).find(i => i.id === source.id);
    await server.api('PUT', 'items/s1', { ...s1, references: [{ n: '1', text: 'S. Keshav. How to read a paper. 2007.' }, { n: '2', text: 'M. Adler. How to read a book. 1972.' }], updatedAt: Date.now() });

    await t.test('sections get their roles from their headings', async () => {
        const tab = await open();
        const roles = await tab.evaluate(() => {
            const e = (title, level, hint) => ({ title, level, hint, place: {} });
            const paper = Passes.sections([
                e('Attention is all you need', 1), e('Abstract', 2), e('1 Introduction', 2), e('2 Background', 2),
                e('3 Model Architecture', 2), e('3.1 Encoder and Decoder Stacks', 3), e('4 Why Self-Attention', 2),
                e('5 Conclusion', 2), e('Data availability', 2), e('References', 2), e('A Proofs', 2, 'appendix'), e('A.1 Lemma', 3),
            ]);
            return paper.map(s => `${s.title}=${s.role}`);
        });
        await tab.close();
        const want = ['Attention is all you need=front', 'Abstract=front', '1 Introduction=front', '2 Background=context',
            '3 Model Architecture=core', '3.1 Encoder and Decoder Stacks=core', '4 Why Self-Attention=core', '5 Conclusion=close',
            'Data availability=other', 'References=references', 'A Proofs=appendix', 'A.1 Lemma=appendix'];
        const wrong = want.filter((w, i) => roles[i] !== w);
        if (wrong.length) return 'got ' + roles.join(', ');
    });

    let tab = await open();
    await t.test('Passes turns on pass 1: the opening shows, the main work folds', async () => {
        const marked = () => tab.evaluate(() => document.querySelectorAll('#reader_text .noted, #reader_text .rb_mark, #reader_text mark').length);
        const before = await marked();
        await tab.click('#passes_btn');
        await wait(300);
        if (await tab.$eval('#pass_bar', b => b.hidden)) return 'no pass bar';
        if (await marked() !== before) return `highlights changed (${before} before, ${await marked()} after)`;
        if (!(await record(tab))?.on) return 'no record';
        if (await lineState(tab, 'Tests keep a project honest') !== 'shown') return 'introduction not shown';
        if (await lineState(tab, 'A server with made-up data') !== 'folded') return 'method not folded';
        if (await lineState(tab, 'It works') !== 'folded') return 'results not folded';
        if (!/min/.test(await tab.$eval('#pass_timer', p => p.textContent))) return 'no timer';
    });

    await t.test('a folded section opens with a click (a peek, recorded)', async () => {
        await tab.click('.pass_chip');
        await wait(200);
        if (await lineState(tab, 'A server with made-up data') !== 'shown') return 'method still folded';
        if (!(await record(tab)).passes[1].peeks?.length) return 'peek not recorded';
        await tab.click('.pass_chip.open');
        await wait(200);
        if (await lineState(tab, 'A server with made-up data') !== 'folded') return 'did not fold again';
    });

    await t.test('the five Cs are sections of the paper’s Summary', async () => {
        await tab.type('#pass_form [data-path="sec:category"]', 'A testing paper');
        await wait(1500);
        const summary = (await saved('s1')).summary || '';
        if (!/### Category\nA testing paper/.test(summary)) return 'not in the Summary: ' + JSON.stringify(summary);
    });

    await t.test('the Summary in the notes side shows each section, with its own Edit', async () => {
        const sections = await tab.$$eval('.md_field[data-field="summary"] .sum_sec', s => s.map(x => x.dataset.title + ': ' + x.querySelector('.md')?.textContent.trim()));
        if (!sections.some(x => x === 'Category: A testing paper')) return 'sections: ' + sections.join(' | ');
    });

    await t.test('a section edited in the notes side shows in the pass', async () => {
        await tab.evaluate(() => document.querySelector('.sum_sec[data-title="Category"] [data-edit]').click());
        await wait(200);
        await tab.evaluate(() => { const a = document.querySelector('.sum_sec[data-title="Category"] textarea'); a.value = 'A testing paper, edited'; });
        await tab.evaluate(() => document.querySelector('.sum_sec[data-title="Category"] [data-save]').click());
        await wait(600);
        if (!/A testing paper, edited/.test((await saved('s1')).summary)) return 'not saved';
        const box = await tab.$eval('#pass_form [data-path="sec:category"]', a => a.value);
        if (box !== 'A testing paper, edited') return 'the pass shows ' + box;
    });

    await t.test('a reference you know is marked on the paper itself, and in its References panel', async () => {
        await tab.click('#pass_form details.pass_refs summary');
        await tab.click('#pass_form [data-path="ref:known:1"]');
        await wait(800);
        const refs = (await saved('s1')).references;
        if (!refs[0].known || refs[1].known) return 'marks: ' + JSON.stringify(refs);
        const panel = await tab.$eval('#refs_list', l => l.textContent);
        if (!panel.includes('✓ Known')) return 'not shown in the References panel';
    });

    await t.test('Go to pass 2: everything shows, pass 1 is done', async () => {
        await tab.click('[data-decide="next"]');
        await wait(300);
        const r = await record(tab);
        if (r.pass !== 2 || !r.passes[1].doneAt) return 'pass ' + r.pass;
        if (await lineState(tab, 'A server with made-up data') !== 'shown') return 'method not shown';
        if (!(await tab.$('#pass_form [data-path="sec:argument"]'))) return 'no box for the main argument';
    });

    await t.test('pass 2: the main argument is a section of the Summary, after the five Cs', async () => {
        await tab.type('#pass_form [data-path="sec:argument"]', 'Tests keep projects honest.');
        await wait(1500);
        const summary = (await saved('s1')).summary || '';
        if (!/### Category\nA testing paper, edited\n\n### The main argument\nTests keep projects honest\./.test(summary)) return 'the Summary: ' + JSON.stringify(summary);
        const side = await tab.$eval('.md_field[data-field="summary"] .md', m => m.textContent);
        if (!side.includes('Tests keep projects honest.')) return 'the side panel does not show it';
    });

    await t.test('pass 2: the five Cs are still there to edit', async () => {
        await tab.evaluate(() => { document.querySelector('#pass_form .pass_earlier').open = true; });
        const box = '#pass_form .pass_earlier [data-path="sec:contributions"]';
        if (!(await tab.$(box))) return 'no box for an earlier pass';
        await tab.type(box, 'Shows tests help');
        await wait(1500);
        if (!/### Contributions\nShows tests help/.test((await saved('s1')).summary)) return 'not saved from pass 2';
    });

    await t.test('pass 2: evidence is a highlight colour', async () => {
        await tab.click('#pass_form [data-act="evidence_add"]');
        await wait(600);
        const project = (await (await server.api('GET', 'boot')).json()).data.projects.find(p => p.id === 'p1');
        const evidence = (project.colors || []).find(c => c.label === 'Evidence');
        if (!evidence || project.evidenceColor !== evidence.id) return 'no evidence colour: ' + JSON.stringify(project.colors);
        await tab.click('#pass_form [data-path="evidence:n1"]');
        await wait(800);
        if ((await saved('n1')).color !== evidence.id) return 'the note did not take the colour';
        await tab.click('#pass_form [data-path="evidence:n1"]');
        await wait(800);
        if ((await saved('n1')).color !== '') return 'unticking did not put its colour back';
    });

    await t.test('pass 2: a captured figure keeps its checks', async () => {
        const id = await tab.evaluate(() => {
            const id = Store.saveItem({ projectId: 'p1', type: 'figure', sourceId: 's1', kind: 'figure', locator: 'Figure 1', caption: 'A test figure' });
            refresh();
            return id;
        });
        await wait(300);
        const box = `#pass_form [data-path="figitem:${id}:axes"]`;
        if (!(await tab.$(box))) return 'the captured figure is not listed';
        await tab.click(box);
        await wait(800);
        if (!(await saved(id)).checks?.axes) return 'the check is not on the figure';
    });

    await t.test('a section tagged in Contents changes what the pass shows', async () => {
        await tab.click('#toc_btn');
        await wait(200);
        const changed = await tab.evaluate(() => {
            const row = [...document.querySelectorAll('#toc_drop .toc_row')].find(r => r.textContent.includes('Results'));
            const pick = row?.querySelector('select.toc_role');
            if (!pick) return false;
            pick.value = 'appendix';
            pick.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        });
        if (!changed) return 'no role picker in Contents';
        await tab.keyboard.press('Escape');
        await wait(300);
        if (await lineState(tab, 'It works') !== 'folded') return 'results (tagged appendix) not folded in pass 2';
        if (!Object.values((await record(tab)).roles).includes('appendix')) return 'tag not saved';
    });

    await t.test('pass 3: the main work waits behind a prediction', async () => {
        await tab.click('.pass_step[data-pass="3"]');
        await wait(300);
        if (await lineState(tab, 'A server with made-up data') !== 'blurred') return 'method not blurred';
        if (await tab.$('.pass_card textarea')) return 'the card should start as a slim strip';
        await tab.click('.pass_card [data-expand]');
        await wait(200);
        await tab.type('.pass_card textarea', 'They will use a fake server');
        await tab.click('.pass_card [data-reveal="revealed"]');
        await wait(300);
        if (await lineState(tab, 'A server with made-up data') !== 'shown') return 'not revealed';
        const p = Object.values((await record(tab)).passes[3].predictions)[0];
        if (p?.state !== 'revealed' || !p.predicted.includes('fake server')) return 'prediction not saved: ' + JSON.stringify(p);
        if (!(await tab.$('.pass_card.done textarea[data-predict="differs"]'))) return 'no box for how it differs';
    });

    await t.test('pass 3: the close-out and the predictions are sections of the Summary', async () => {
        await tab.type('#pass_form [data-path="sec:weaknesses"]', 'Only one server.');
        await wait(1500);
        const summary = (await saved('s1')).summary || '';
        if (!/### Weak spots\nOnly one server\./.test(summary)) return 'not in the Summary: ' + JSON.stringify(summary);
        if (!/### Predictions vs the paper\n- \*\*Method\*\*: expected They will use a fake server/.test(summary)) return 'no predictions: ' + JSON.stringify(summary);
        const side = await tab.$eval('.md_field[data-field="summary"] .md', m => m.textContent);
        if (!side.includes('Only one server.')) return 'the side panel does not show it';
        const kept = await tab.evaluate(md => Passes.setSection(md + '\n\n### Quotes\nKept.', 'weaknesses', 'Changed.'), summary);
        if (!kept.includes('### Quotes\nKept.')) return 'a section of your own is lost';
    });

    await t.test('leaving folds nothing; coming back resumes the pass', async () => {
        await tab.click('#pass_leave');
        await wait(200);
        if (await lineState(tab, 'It works') !== 'shown') return 'still folded after leaving';
        await tab.close();
        tab = await open();
        if (!(await tab.$eval('#pass_bar', b => b.hidden))) return 'on after reload';
        await tab.click('#passes_btn');
        await wait(300);
        if ((await record(tab)).pass !== 3) return 'did not resume pass 3';
        if (!(await tab.$('.pass_card.done textarea[data-predict="differs"]'))) return 'the prediction was lost';
    });

    await t.test('Enough after the last pass: finished', async () => {
        await tab.click('[data-decide="enough"]');
        await wait(300);
        const r = await record(tab);
        if (r.state !== 'finished') return 'state ' + r.state;
        if ((await saved('s1')).status !== 'done') return 'the paper is not Done: ' + (await saved('s1')).status;
        if (!/three passes/.test(await tab.$eval('#pass_state', s => s.textContent))) return 'not shown as finished';
    });
    await tab.close();

    // (closing the page also checks the summary pad, never opened, doesn't save its empty box over the Summary)
    await t.test('an older Review box: moved into the Summary, under its sections', async () => {
        const all = await items();
        const n1 = all.find(i => i.id === 's1');
        await server.api('PUT', 'items/s9', { ...n1, id: 's9', title: 'An older paper', summary: 'My old summary.', review: 'It was fine.\n\n### Weak spots\nSmall sample.', sectioned: undefined, references: [], createdAt: Date.now(), updatedAt: Date.now() });
        const page = await browser.newPage();
        await page.goto(base + 'page/material.html?id=s9', { waitUntil: 'networkidle0' });
        await wait(600);
        await page.close();
        const moved = await saved('s9');
        if ((moved.review || '') !== '') return 'the Review box was not emptied';
        if (!/^My old summary\./.test(moved.summary) || !/### Weak spots\nSmall sample\./.test(moved.summary) || !/### Other notes\nIt was fine\./.test(moved.summary)) return 'the Summary: ' + JSON.stringify(moved.summary);
    });

    await t.test('phone width: the pass bar fits, nothing scrolls sideways', async () => {
        const phone = await open(360);
        const problem = await phone.evaluate(() => {
            const bar = document.querySelector('#pass_bar');
            if (bar.hidden) return 'bar hidden';
            if (document.documentElement.scrollWidth > innerWidth + 1) return 'page scrolls sideways: ' + document.documentElement.scrollWidth;
            const r = bar.getBoundingClientRect();
            if (r.right > innerWidth + 1) return 'bar wider than the screen';
            return null;
        });
        await phone.screenshot({ path: require('path').join(__dirname, 'shots', 'phone-passes.png') });
        await phone.close();
        return problem;
    });

    await t.test('no page errors', async () => errors.join('\n'));

    await browser.close();
    await server.close();
    t.finish();
})();

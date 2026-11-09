// Reading in passes (sources/passes.js, pages/material_passes.js): the sections each pass shows, peeking, the
// five Cs saved, going on to the next pass, skipping one (recorded), predicting in pass 3, a section's role
// changed in Contents, leaving and coming back; and the bar at phone width.
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
    const saved = async () => (await (await server.api('GET', 'boot')).json()).data.items.find(i => i.type === 'passes');

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

    await t.test('the five Cs are saved', async () => {
        await tab.type('#pass_form [data-path="cs.category"]', 'A testing paper');
        await wait(1500);
        const kept = await saved();
        if (kept?.passes?.[1]?.cs?.category !== 'A testing paper') return 'not on the server: ' + JSON.stringify(kept?.passes);
    });

    await t.test('Go to pass 2: everything shows, pass 1 is done', async () => {
        await tab.click('[data-decide="next"]');
        await wait(300);
        const r = await record(tab);
        if (r.pass !== 2 || !r.passes[1].doneAt) return 'pass ' + r.pass;
        if (await lineState(tab, 'A server with made-up data') !== 'shown') return 'method not shown';
        if (!(await tab.$('#pass_form [data-path="summary"]'))) return 'no summary box';
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
        if (!/three passes/.test(await tab.$eval('#pass_state', s => s.textContent))) return 'not shown as finished';
    });
    await tab.close();

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

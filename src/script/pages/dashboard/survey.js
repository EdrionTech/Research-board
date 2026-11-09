// Literature tab: the survey board (sources/survey.js has the method). "List | Survey" above the sources switches
// to it: the survey's four steps, the project's materials in columns by how far each has been read (the search,
// status, tag and author filters still apply), and the key papers and authors found in the references of the
// papers you've had a first pass on, each a click from being added.
// Uses literature.js (shownSources, sourceItems, materialUrl) and dashboard.js (items, project, render).

const SurveyBoard = (() => {
    const VIEW_KEY = 'research_board_lit_view';
    const SHOW_PAPERS = 10;
    let morePapers = false;
    const busy = new Set(); // key papers being looked up

    const view = () => { try { return localStorage.getItem(VIEW_KEY + ':' + project.id) || 'list'; } catch { return 'list'; } };
    function setView(value) {
        try { localStorage.setItem(VIEW_KEY + ':' + project.id, value); } catch { }
        renderLiterature();
    }

    const seeds = () => project.surveySeeds || [];
    const minutes = record => Object.values(record?.passes || {}).reduce((ms, p) => ms + (p.activeMs || 0), 0);

    // ---- drawing ----

    function render() {
        const on = view() === 'survey';
        for (const btn of $$('#lit_view button')) btn.setAttribute('aria-pressed', btn.dataset.view === view());
        $('.library').classList.toggle('survey_on', on);
        $('#survey').hidden = !on;
        if (!on) return;

        const all = sourceItems();
        const records = Survey.recordsOf(items);
        const keys = Survey.keyPapers(all, records);
        const { list, current } = Survey.steps(all, records, seeds(), keys.papers.length);
        $('#survey').replaceChildren(stepsRow(list, current), board(shownSources(), records), keyPanel(keys, all));
    }

    function stepsRow(list, current) {
        const ol = el('ol', 'survey_steps');
        for (const s of list) {
            const li = el('li', 'survey_step');
            li.dataset.state = s.done ? 'done' : s.n === current ? 'current' : '';
            const num = el('span', 'survey_num', s.done ? '✓' : String(s.n));
            const text = el('div', 'survey_step_text');
            const head = el('strong', '', s.title);
            text.append(head);
            if (s.status) text.append(el('small', 'survey_status', s.status));
            if (s.n === current) text.append(el('p', 'survey_hint', s.hint));
            li.append(num, text);
            ol.append(li);
        }
        return ol;
    }

    function board(sources, records) {
        const box = el('div', 'survey_board');
        const byColumn = new Map(Survey.COLUMNS.map(([id]) => [id, []]));
        for (const source of sources) byColumn.get(Survey.column(records.get(source.id))).push(source);
        for (const [id, label] of Survey.COLUMNS) {
            const list = byColumn.get(id).sort((a, b) => Number(seeds().includes(b.id)) - Number(seeds().includes(a.id)));
            const col = el('section', 'survey_col');
            col.dataset.col = id;
            const head = el('h4', 'survey_col_head');
            head.append(el('span', '', label), el('small', '', String(list.length)));
            const ul = el('ul', 'survey_cards');
            ul.append(...(list.length ? list.map(source => card(source, records.get(source.id))) : [el('li', 'survey_empty', '—')]));
            col.append(head, ul);
            box.append(col);
        }
        return box;
    }

    function card(source, record) {
        const seed = seeds().includes(source.id);
        const li = el('li', 'survey_card' + (seed ? ' seed' : '') + (source.surveyKey ? ' key' : ''));
        const open = el('a', 'survey_open');
        open.href = materialUrl(source.id);
        open.append(el('strong', '', source.title), el('small', '', shortCitation(source) || 'No authors yet'));
        const category = record?.passes?.[1]?.cs?.category?.trim();
        if (category) open.append(el('p', 'survey_cat', category));
        const meta = el('div', 'survey_meta');
        if (source.surveyKey) meta.append(el('span', 'badge material', 'Key paper'));
        const spent = minutes(record);
        if (spent >= 60000) meta.append(el('small', '', Passes.duration(spent)));
        if (meta.childElementCount) open.append(meta);
        const star = el('button', 'survey_star', seed ? '★' : '☆');
        star.type = 'button';
        star.dataset.seed = source.id;
        star.setAttribute('aria-pressed', seed);
        star.title = seed ? 'A seed paper: click to unstar' : 'Make it a seed paper';
        star.setAttribute('aria-label', (seed ? 'Unstar ' : 'Star as a seed: ') + source.title);
        li.append(open, star);
        return li;
    }

    function keyPanel(keys, all) {
        const box = el('section', 'survey_keys');
        const head = el('header', 'survey_keys_head');
        head.append(el('h3', '', 'Key papers'));
        head.append(el('small', '', keys.pool.length
            ? `From the references of ${keys.pool.length} paper${keys.pool.length === 1 ? '' : 's'} you've had a first pass on`
            : 'From the references of the papers you\'ve had a first pass on'));
        box.append(head);
        if (keys.pool.length < 2) {
            box.append(el('p', 'hint', keys.pool.length
                ? 'One paper so far: have a first pass on another, and what their references share shows here.'
                : 'Have a first pass on your seed papers (Passes, on a paper\'s page): the works their references share show here.'));
            return box;
        }
        if (!keys.papers.length) box.append(el('p', 'hint', 'No work is cited by two of these papers yet (or you have them all).'));
        const shortOf = id => { const s = all.find(x => x.id === id); return s ? shortCitation(s) || s.title : ''; };
        const shown = morePapers ? keys.papers : keys.papers.slice(0, SHOW_PAPERS);
        const list = el('ol', 'survey_papers');
        for (const work of shown) {
            const li = el('li', 'survey_paper');
            const text = el('div', 'survey_paper_text');
            text.append(el('strong', '', work.title), el('small', '', `Cited by ${work.citers.length}: ${work.citers.map(shortOf).join('; ')}`));
            const add = el('button', 'btn small', busy.has(work.key) ? 'Looking up…' : '+ Add');
            add.type = 'button';
            add.dataset.add = work.key;
            add.disabled = busy.has(work.key);
            add.title = 'Add it to the project (its details are looked up)';
            li.append(el('span', 'survey_count', String(work.citers.length)), text, add);
            list.append(li);
        }
        if (keys.papers.length) box.append(list);
        if (keys.papers.length > SHOW_PAPERS) {
            const more = el('button', 'link', morePapers ? 'Fewer' : `All ${keys.papers.length}`);
            more.type = 'button';
            more.dataset.more = '';
            box.append(more);
        }
        if (keys.authors.length) {
            box.append(el('h4', 'survey_sub', 'Authors who keep coming up'));
            const chips = el('div', 'survey_authors');
            for (const a of keys.authors.slice(0, 16)) {
                const chip = el('a', 'survey_author');
                chip.href = 'https://scholar.google.com/scholar?q=' + encodeURIComponent('author:"' + a.name + '"');
                chip.target = '_blank';
                chip.rel = 'noopener';
                chip.title = `Cited in ${a.citers.length} of the papers: ${a.citers.map(shortOf).join('; ')}. Their papers on Google Scholar`;
                chip.append(el('span', '', a.name), el('small', '', String(a.citers.length)));
                chips.append(chip);
            }
            box.append(chips);
        }
        box._keys = keys; // (the add button finds its work here)
        return box;
    }

    // ---- doing ----

    function toggleSeed(id) {
        const list = seeds().includes(id) ? seeds().filter(s => s !== id) : [...seeds(), id];
        project.surveySeeds = list;
        Store.saveProject({ id: project.id, surveySeeds: list });
        renderLiterature();
    }

    async function addKey(key) {
        const work = $('#survey .survey_keys')?._keys?.papers.find(w => w.key === key);
        if (!work || busy.has(key)) return;
        busy.add(key);
        render();
        try {
            const { fields, found } = await References.lookup(work.ref);
            const sources = Store.getItems(project.id).filter(i => i.type === 'source');
            const same = fields.doi && sources.find(s => s.doi?.toLowerCase() === fields.doi.toLowerCase());
            if (same) Store.saveItem({ id: same.id, surveyKey: true, citedIn: [...new Set([...(same.citedIn || []), ...work.citers])] });
            else Store.saveItem({ projectId: project.id, ...References.toSource(work.ref, fields, found, work.citers), surveyKey: true });
        } finally {
            busy.delete(key);
            window.render(); // dashboard.js: the items again, then every list
        }
    }

    function setup() {
        $('#lit_view').addEventListener('click', e => {
            const btn = e.target.closest('[data-view]');
            if (btn) setView(btn.dataset.view);
        });
        $('#survey').addEventListener('click', e => {
            const star = e.target.closest('[data-seed]');
            if (star) return toggleSeed(star.dataset.seed);
            const add = e.target.closest('[data-add]');
            if (add) return addKey(add.dataset.add);
            if (e.target.closest('[data-more]')) { morePapers = !morePapers; render(); }
        });
    }

    return { setup, render };
})();

SurveyBoard.setup();

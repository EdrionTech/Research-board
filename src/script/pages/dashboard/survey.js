// Literature tab: the survey board (sources/survey.js has the method). "List | Survey" above the sources switches
// to it: the survey's four steps, the project's materials in columns by how far each has been read (the search,
// status, tag and author filters still apply), and what the references of the papers you've had a first pass on
// share: key papers, authors, venues. Survey papers can lend their whole reference list. Two searches go online
// (OpenAlex): papers to start from (step 1), and a venue's recent papers (Keshav: scan the top venues).
// Uses literature.js (shownSources, sourceItems, materialUrl) and dashboard.js (items, project, render).

const SurveyBoard = (() => {
    const VIEW_KEY = 'research_board_lit_view';
    const SHOW_PAPERS = 10;
    let morePapers = false;
    const busy = new Set(); // key papers being looked up
    let lastKeys = null;    // what the panel shows (its buttons find their work here)

    const view = () => { try { return localStorage.getItem(VIEW_KEY + ':' + project.id) || 'list'; } catch { return 'list'; } };
    function setView(value) {
        try { localStorage.setItem(VIEW_KEY + ':' + project.id, value); } catch { }
        renderLiterature();
    }

    const seeds = () => project.surveySeeds || [];
    const surveysUsed = () => project.surveyFrom || [];
    // "A. Vaswani" (from a reference) and Ashish Vaswani (a project paper's author): the same surname and initial
    const plain = t => (t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const sameAuthor = (author, cited) => plain(author.lastName) === plain(cited.lastName)
        && (!cited.name.includes('.') || plain(author.firstName)[0] === plain(cited.name)[0]);
    const minutes = record => Object.values(record?.passes || {}).reduce((ms, p) => ms + (p.activeMs || 0), 0);
    const button = (cls, label, data = {}, title = '') => {
        const b = el('button', cls, label);
        b.type = 'button';
        Object.assign(b.dataset, data);
        if (title) b.title = title;
        return b;
    };

    // ---- drawing ----
    // Each part folds away (its state kept on this device, per project): the steps to one line saying where you
    // are, the board to its counts, the references' findings each on their own.

    const FOLD_KEY = 'research_board_survey_folds';
    const folds = () => { try { return JSON.parse(localStorage.getItem(FOLD_KEY + ':' + project.id)) || {}; } catch { return {}; } };
    function keepFold(id, open) {
        try { localStorage.setItem(FOLD_KEY + ':' + project.id, JSON.stringify({ ...folds(), [id]: open })); } catch { }
    }
    // a part that folds: its title (and a count or a few words) always shown, the rest on a click
    function fold(id, title, note, content, openFirst) {
        const box = el('details', 'survey_fold');
        box.dataset.fold = id;
        box.open = folds()[id] ?? openFirst;
        const head = el('summary', 'survey_fold_head');
        head.append(el('span', 'survey_fold_title', title));
        if (note) head.append(el('small', 'survey_fold_note', note));
        box.append(head, ...[].concat(content).filter(Boolean));
        box.addEventListener('toggle', () => keepFold(id, box.open));
        return box;
    }

    function render() {
        const on = view() === 'survey';
        for (const btn of $$('#lit_view button')) btn.setAttribute('aria-checked', btn.dataset.view === view());
        $('.library').classList.toggle('survey_on', on);
        $('#survey').hidden = !on;
        if (!on) return;

        const all = sourceItems();
        const records = Survey.recordsOf(items);
        const keys = lastKeys = Survey.keyPapers(all, records, surveysUsed());
        const { list, current } = Survey.steps(all, records, seeds(), keys.papers.length);
        const step = list.find(s => s.n === current);
        const shown = shownSources();
        $('#survey').replaceChildren(
            fold('steps', `Step ${current} of 4: ${step.title}`, step.status, stepsRow(list, current), !seeds().length),
            fold('board', 'Your papers by pass', `${shown.length} paper${shown.length === 1 ? '' : 's'}`, board(shown, records), true),
            keyPanel(keys, all, records),
        );
    }

    function stepsRow(list, current) {
        const ol = el('ol', 'survey_steps');
        for (const s of list) {
            const li = el('li', 'survey_step');
            li.dataset.state = s.done ? 'done' : s.n === current ? 'current' : '';
            const num = el('span', 'badge survey_num', s.done ? '✓' : String(s.n));
            const text = el('div', 'survey_step_text');
            text.append(el('strong', '', s.title));
            if (s.status) text.append(el('small', 'survey_status', s.status));
            if (s.n === current) text.append(el('p', 'survey_hint', s.hint));
            // step 1: find recent, much-cited papers to start from
            if (s.n === 1) text.append(button('btn small survey_find', 'Find papers…', { find: '' }, 'Search for recent, much-cited papers on your subject (OpenAlex)'));
            // and then: a first structure for the literature review, from what the passes gathered
            if (s.n === 4) text.append(button('btn small survey_find', 'Write the review…', { wizard: '' }, 'A first structure for your literature review, from the papers\' summaries'));
            li.append(num, text);
            ol.append(li);
        }
        return ol;
    }

    // the columns with papers in them; the empty ones named in one line under the board
    function board(sources, records) {
        const box = el('div', 'survey_board');
        const byColumn = new Map(Survey.COLUMNS.map(([id]) => [id, []]));
        for (const source of sources) byColumn.get(Survey.column(records.get(source.id))).push(source);
        const empty = [];
        for (const [id, label] of Survey.COLUMNS) {
            const list = byColumn.get(id).sort((a, b) => Number(seeds().includes(b.id)) - Number(seeds().includes(a.id)));
            if (!list.length) { empty.push(label); continue; }
            const col = el('section', 'survey_col');
            col.dataset.col = id;
            const head = el('h4', 'survey_col_head');
            head.append(el('span', '', label), el('small', '', String(list.length)));
            const ul = el('ul', 'survey_cards');
            ul.append(...list.map(source => card(source, records.get(source.id))));
            col.append(head, ul);
            box.append(col);
        }
        box.style.setProperty('--cols', Math.max(1, Survey.COLUMNS.length - empty.length));
        if (!sources.length) return el('p', 'survey_hint', 'No papers match the filters.');
        return [box, empty.length ? el('p', 'survey_hint survey_empty_cols', `Nothing yet in: ${empty.join(', ')}.`) : null];
    }

    function card(source, record) {
        const seed = seeds().includes(source.id);
        const li = el('li', 'survey_card' + (seed ? ' seed' : '') + (source.surveyKey ? ' key' : ''));
        const open = el('a', 'source_row survey_open');
        open.href = materialUrl(source.id);
        open.append(el('strong', '', source.title), el('small', '', shortCitation(source) || 'No authors yet'));
        const category = Passes.section(summaryOf(source), 'category').trim();
        if (category) open.append(el('p', 'survey_cat', category));
        const meta = el('div', 'survey_meta');
        if (source.surveyKey) meta.append(el('span', 'badge material', 'Key paper'));
        if (Passes.isSurvey(source, record)) meta.append(el('span', 'badge material', 'Survey'));
        const spent = minutes(record);
        if (spent >= 60000) meta.append(el('small', '', Passes.duration(spent)));
        if (meta.childElementCount) open.append(meta);
        const star = button('link survey_star', seed ? '★' : '☆', { seed: source.id }, seed ? 'A seed paper: click to unstar' : 'Make it a seed paper');
        star.setAttribute('aria-pressed', seed);
        star.setAttribute('aria-label', (seed ? 'Unstar ' : 'Star as a seed: ') + source.title);
        li.append(open, star);
        return li;
    }

    // what the references of the first-passed papers share: each part folds on its own
    function keyPanel(keys, all, records) {
        const box = el('section', 'survey_keys');
        const head = el('header', 'survey_keys_head');
        head.append(el('h3', '', 'From their references'));
        head.append(el('small', '', keys.pool.length
            ? `What the ${keys.pool.length} paper${keys.pool.length === 1 ? '' : 's'} you've had a first pass on cite`
            : 'What the papers you\'ve had a first pass on cite'));
        box.append(head);
        if (!keys.pool.length) {
            box.append(el('p', 'survey_hint', 'Have a first pass on your seed papers (Passes, on a paper\'s page): the works, authors and venues their references share show here.'));
            return box;
        }
        const shortOf = id => { const s = all.find(x => x.id === id); return s ? shortCitation(s) || s.title : ''; };

        // a survey paper's whole reference list, if you choose (Keshav: a recent survey is a short cut)
        const surveys = keys.pool.filter(s => Passes.isSurvey(s, records.get(s.id)));
        if (surveys.length) {
            const list = el('ul', 'survey_surveys');
            for (const s of surveys) {
                const used = surveysUsed().includes(s.id);
                const li = el('li', 'survey_paper survey_offer');
                const text = el('div', 'survey_paper_text');
                text.append(el('strong', '', s.title), el('small', '', used
                    ? `Its ${s.references.length} reference${s.references.length === 1 ? ' is' : 's are'} among your key papers.`
                    : `A survey paper: its ${s.references.length} reference${s.references.length === 1 ? '' : 's'} can be your key papers.`));
                li.append(el('span', 'badge survey_count', 'Survey'), text,
                    button('btn small' + (used ? '' : ' primary'), used ? 'Stop using' : 'Use its references', { survey: s.id }));
                list.append(li);
            }
            box.append(fold('surveys', 'Survey papers', `${surveys.length}`, list, !surveysUsed().length));
        }

        // the key papers
        let papers;
        if (keys.pool.length < 2 && !surveysUsed().length) {
            papers = el('p', 'survey_hint', 'One paper so far: have a first pass on another, and what their references share shows here.');
        } else if (!keys.papers.length) {
            papers = el('p', 'survey_hint', 'No work is cited by two of these papers yet (or you have them all).');
        } else {
            const shown = morePapers ? keys.papers : keys.papers.slice(0, SHOW_PAPERS);
            const list = el('ol', 'survey_papers');
            for (const work of shown) {
                const li = el('li', 'survey_paper');
                const text = el('div', 'survey_paper_text');
                const cited = work.citers.length > 1 ? `Cited by ${work.citers.length}: ${work.citers.map(shortOf).join('; ')}`
                    : work.followUp ? `You marked it to follow up in ${shortOf(work.citers[0])}`
                    : `From the survey ${shortOf(work.citers[0])}`;
                text.append(el('strong', '', work.title), el('small', '', cited));
                const add = button('btn small', busy.has(work.key) ? 'Looking up…' : '+ Add', { add: work.key }, 'Add it to the project (its details are looked up)');
                add.disabled = busy.has(work.key);
                const count = el('span', 'badge survey_count', String(work.citers.length));
                count.title = `Cited by ${work.citers.length} of your papers`;
                li.append(count, text, add);
                list.append(li);
            }
            papers = [list, keys.papers.length > SHOW_PAPERS ? button('link', morePapers ? 'Fewer' : `All ${keys.papers.length}`, { more: '' }) : null];
        }
        box.append(fold('papers', 'Key papers', keys.papers.length ? `${keys.papers.length} to add` : '', papers, true));

        if (keys.authors.length) {
            const chips = el('div', 'survey_chips');
            for (const a of keys.authors.slice(0, 16)) {
                // with papers in the project: the Literature tab's own author filter; else their papers on Google Scholar
                const theirs = all.filter(s => (s.authors || []).some(x => sameAuthor(x, a)));
                let chip;
                if (theirs.length) {
                    chip = button('tag_chip survey_chip', '', { author: a.name }, `Cited in ${a.citers.length} of the papers. Show their ${theirs.length} paper${theirs.length === 1 ? '' : 's'} here`);
                } else {
                    chip = el('a', 'tag_chip survey_chip');
                    chip.href = 'https://scholar.google.com/scholar?q=' + encodeURIComponent('author:"' + a.name + '"');
                    chip.target = '_blank';
                    chip.rel = 'noopener';
                    chip.title = `Cited in ${a.citers.length} of the papers: ${a.citers.map(shortOf).join('; ')}. None of theirs in the project yet: their papers on Google Scholar`;
                }
                chip.append(el('span', '', a.name), el('small', '', String(a.citers.length)));
                chips.append(chip);
            }
            box.append(fold('authors', 'Authors who keep coming up', `${keys.authors.length}`, chips, false));
        }

        // where the field publishes: each venue a click from its recent papers (Keshav: scan the top venues)
        if (keys.venues.length) {
            const chips = el('div', 'survey_chips');
            for (const v of keys.venues.slice(0, 12)) {
                const chip = button('tag_chip survey_chip', '', { venue: v.key }, `Cited ${v.cites} times, in ${v.citers.length} of your papers. Scan its recent papers`);
                chip.append(el('span', '', v.label), el('small', '', String(v.cites)));
                chips.append(chip);
            }
            box.append(fold('venues', 'Where the field publishes', `${keys.venues.length}`,
                [el('p', 'survey_hint', 'The venues these references cite most. Open one to scan its recent papers.'), chips], false));
        }
        return box;
    }

    // ---- doing ----

    function toggleIn(field, id) {
        const list = (project[field] || []).includes(id) ? project[field].filter(s => s !== id) : [...(project[field] || []), id];
        project[field] = list;
        Store.saveProject({ id: project.id, [field]: list });
        renderLiterature();
    }

    async function addKey(key) {
        const work = lastKeys?.papers.find(w => w.key === key);
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

    // ---- papers from OpenAlex: to start from, or a venue's recent ones ----

    let results = [];
    let resultsFor = null; // { kind: 'seed' } or { kind: 'venue', venue }

    function openWorks(kind, venue) {
        resultsFor = { kind, venue };
        results = [];
        const seed = kind === 'seed';
        $('#works_title').textContent = seed ? 'Find papers to start from' : `Recent papers in ${venue.label}`;
        $('#works_intro').textContent = seed
            ? 'Recent papers (the last five years) on your subject, most cited first. Add 3 to 5 as seed papers, then have a first pass on each.'
            : 'Its papers of the last two years, most cited first. Scan the titles; add the ones that belong in your survey.';
        $('#works_search').hidden = !seed;
        $('#works_elsewhere').hidden = true;
        $('#works_list').replaceChildren();
        $('#works_state').textContent = '';
        openModal($('#works_modal'));
        if (seed) $('#works_query').focus();
        else loadVenue(venue);
    }

    async function search(query) {
        if (!query.trim()) return;
        $('#works_state').textContent = 'Searching…';
        $('#works_list').replaceChildren();
        try {
            results = await Survey.searchWorks(query.trim());
            showResults(results.length ? '' : 'Nothing found: try other words.');
        } catch {
            showResults('Couldn’t reach OpenAlex: check your connection, and try again.');
        }
        setElsewhere('https://scholar.google.com/scholar?as_ylo=' + (new Date().getFullYear() - 5) + '&q=' + encodeURIComponent(query.trim()));
    }

    async function loadVenue(venue) {
        $('#works_state').textContent = 'Finding the venue…';
        setElsewhere('https://scholar.google.com/scholar?as_ylo=' + (new Date().getFullYear() - 2) + '&q=' + encodeURIComponent('source:"' + venue.search + '"'));
        try {
            const found = await Survey.findVenue(venue.search);
            if (resultsFor?.venue !== venue) return;
            if (!found) return showResults(`OpenAlex doesn’t know “${venue.label}”. Search it yourself below.`);
            $('#works_title').textContent = `Recent papers in ${found.name}`;
            $('#works_state').textContent = 'Loading its papers…';
            results = await Survey.venueWorks(found.id);
            if (resultsFor?.venue !== venue) return;
            showResults(results.length ? '' : `No papers from the last two years found for ${found.name}.`);
        } catch {
            showResults('Couldn’t reach OpenAlex: check your connection, and try again.');
        }
    }

    function setElsewhere(href) {
        $('#works_elsewhere').href = href;
        $('#works_elsewhere').hidden = false;
    }

    function showResults(message) {
        $('#works_state').textContent = message;
        const sources = Store.getItems(project.id).filter(i => i.type === 'source');
        const seed = resultsFor?.kind === 'seed';
        $('#works_list').replaceChildren(...results.map((r, i) => {
            const f = r.fields;
            const li = el('li');
            const text = el('span');
            text.append(el('strong', '', f.title || '(no title)'));
            const authors = f.authors.slice(0, 3).map(a => a.lastName).filter(Boolean).join(', ') + (f.authors.length > 3 ? ' et al.' : '');
            text.append(el('small', '', [authors, f.venue, (f.published || '').slice(0, 4), `cited ${r.cited.toLocaleString()} times`].filter(Boolean).join(' · ')));
            const have = sources.find(s => (f.doi && s.doi?.toLowerCase() === f.doi.toLowerCase()) || Passes.norm(s.title) === Passes.norm(f.title));
            if (have) {
                const isSeed = seeds().includes(have.id);
                li.append(text, seed && !isSeed ? button('btn small', '★ Make it a seed', { seedHave: have.id }) : el('small', 'hint', isSeed ? 'A seed already' : 'In the project'));
            } else li.append(text, button('btn small' + (seed ? ' primary' : ''), seed ? '+ Add as seed' : '+ Add', { pick: i }));
            return li;
        }));
    }

    function addResult(i) {
        const r = results[i];
        if (!r) return;
        const seed = resultsFor?.kind === 'seed';
        const id = Store.saveItem({
            projectId: project.id, type: 'source', ...r.fields, kind: r.fields.kind === 'other' ? 'article' : r.fields.kind,
            tags: [], status: 'to_read', ...(seed ? {} : { surveyKey: true }),
        });
        if (seed) {
            project.surveySeeds = [...seeds(), id];
            Store.saveProject({ id: project.id, surveySeeds: project.surveySeeds });
        }
        window.render();
        showResults($('#works_state').textContent);
    }

    function setup() {
        $('#lit_view').addEventListener('click', e => {
            const btn = e.target.closest('[data-view]');
            if (btn) setView(btn.dataset.view);
        });
        $('#survey').addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.dataset.seed) return toggleIn('surveySeeds', b.dataset.seed);
            if (b.dataset.survey) return toggleIn('surveyFrom', b.dataset.survey);
            if (b.dataset.add) return addKey(b.dataset.add);
            if (b.dataset.author) {
                const cited = lastKeys?.authors.find(a => a.name === b.dataset.author);
                if (cited) authorFilter.selectWhere(author => sameAuthor(author, cited));
                $('#author_filter').scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            if (b.dataset.venue) return openWorks('venue', lastKeys?.venues.find(v => v.key === b.dataset.venue));
            if (b.dataset.find !== undefined) return openWorks('seed');
            if (b.dataset.wizard !== undefined) return ReviewWizard.open();
            if (b.dataset.more !== undefined) { morePapers = !morePapers; render(); }
        });
        $('#works_modal').addEventListener('submit', e => {
            e.preventDefault();
            search($('#works_query').value);
        });
        $('#works_list').addEventListener('click', e => {
            const b = e.target.closest('button');
            if (b?.dataset.pick) addResult(Number(b.dataset.pick));
            if (b?.dataset.seedHave) { toggleIn('surveySeeds', b.dataset.seedHave); showResults($('#works_state').textContent); }
        });
    }

    return { setup, render };
})();

SurveyBoard.setup();

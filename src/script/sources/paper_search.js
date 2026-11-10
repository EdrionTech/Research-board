// Find papers (OpenAlex), in one popup used wherever materials are added: a project's Literature tab and the
// Library ("Find papers…"), and the survey board (papers to start from, a venue's recent papers).
//   By subject:   the most-cited papers whose title or abstract has your words (the last five years, or any time)
//   By title:     a title, a whole reference, a DOI or an arXiv link: the paper it is (closest matches first)
// Each result shows its authors, venue, year and citations, its abstract a click away, and what you can do with it:
// add it (to the project, or the Library), add it as a survey seed, or say where it already is.
//   PaperSearch.open({ projectId, mode: 'add' | 'seed' | 'venue', venue, extra, onAdded(id), title, intro })
// The popup builds itself inside the page's #modals (core/ui.js). Uses sources.js (fieldsFromOpenAlex,
// lookupMaterial, findDoi, findArxivId).

const PaperSearch = (() => {
    const OPENALEX = 'https://api.openalex.org/';
    const yearsAgo = n => `${new Date().getFullYear() - n}-01-01`;
    async function getJson(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OpenAlex answered ${res.status}`);
        return res.json();
    }
    // a work → { fields (as a source's), cited, id }
    const asResult = work => ({
        id: work.id,
        cited: work.cited_by_count || 0,
        fields: { ...fieldsFromOpenAlex(work), url: work.doi || work.primary_location?.landing_page_url || '' },
    });

    // ---- the searches ----

    // much-cited papers on a subject: the words in the title or abstract (a looser search sorted by citations
    // brings famous papers on anything); years: the last so many, or 0 for any time
    async function searchWorks(query, { years = 5, count = 20 } = {}) {
        const words = query.replace(/[,|:]/g, ' ').trim();
        const since = years ? `,from_publication_date:${yearsAgo(years)}` : '';
        const url = `${OPENALEX}works?filter=title_and_abstract.search:${encodeURIComponent(words)}${since},type:article|preprint|review|book|book-chapter&sort=cited_by_count:desc&per-page=${count}`;
        return ((await getJson(url)).results || []).map(asResult);
    }

    // a title, a reference, a DOI or an arXiv link → the papers it could be, best match first
    async function findTitle(text) {
        const query = text.trim();
        if (findDoi(query) || findArxivId(query)) {
            const fields = await lookupMaterial(query).catch(() => null);
            if (fields?.title) return [{ id: fields.doi || query, cited: null, fields: { ...fields, url: fields.url || (fields.doi ? 'https://doi.org/' + fields.doi : '') } }];
        }
        // a whole reference ("S. Keshav. How to read a paper. ACM…, 2007."): its title is what to look for
        const parsed = References.parse(query).title || '';
        const reference = /\b(19|20)\d{2}\b/.test(query) && parsed.length >= 12 && parsed.length < query.length - 10;
        const title = reference ? parsed : query.slice(0, 200);
        const found = ((await getJson(`${OPENALEX}works?search=${encodeURIComponent(title)}&per-page=10`)).results || []).map(asResult);
        // the reference's own year first (the same title can be several papers)
        const year = reference && References.parse(query).published;
        return year ? [...found].sort((a, b) => Number(b.fields.published?.startsWith(year)) - Number(a.fields.published?.startsWith(year))) : found;
    }

    // the venue OpenAlex knows by that name (the one with the most works among the close matches), or null
    async function findVenue(name) {
        const results = (await getJson(`${OPENALEX}sources?search=${encodeURIComponent(name)}&per-page=8`)).results || [];
        const want = new Set(name.toLowerCase().split(/\W+/).filter(w => w.length > 2));
        const close = results.filter(r => {
            const words = r.display_name.toLowerCase().split(/\W+/);
            return [...want].filter(w => words.includes(w)).length >= Math.max(1, Math.ceil(want.size * 0.6));
        });
        const best = (close.length ? close : results.slice(0, 1)).sort((a, b) => (b.works_count || 0) - (a.works_count || 0))[0];
        return best ? { id: best.id.replace(/^https?:\/\/openalex\.org\//, ''), name: best.display_name, type: best.type } : null;
    }

    // a venue's papers of the last years, most cited first (Keshav: scan the top venues' recent proceedings)
    async function venueWorks(venueId, { years = 2, count = 25 } = {}) {
        const url = `${OPENALEX}works?filter=primary_location.source.id:${venueId},from_publication_date:${yearsAgo(years)}&sort=cited_by_count:desc&per-page=${count}`;
        return ((await getJson(url)).results || []).map(asResult);
    }

    // ---- the popup ----

    let modal = null;
    let options = null;
    let results = [];
    let by = 'subject';
    let recent = true;
    const $m = sel => modal.querySelector(sel);
    const norm = text => (text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const button = (cls, label, data = {}) => {
        const b = el('button', cls, label);
        b.type = 'button';
        Object.assign(b.dataset, data);
        return b;
    };

    function build() {
        modal = el('form', 'modal wide works_modal');
        modal.id = 'paper_search';
        modal.hidden = true;
        modal.innerHTML = `
            <h2 class="works_title"></h2>
            <p class="hint works_intro"></p>
            <div class="works_find">
                <div class="segmented works_by" role="radiogroup" aria-label="Search by">
                    <button type="button" role="radio" data-by="subject">By subject</button>
                    <button type="button" role="radio" data-by="title">By title or reference</button>
                </div>
                <label class="check works_recent"><input type="checkbox" checked> The last five years</label>
            </div>
            <div class="works_search">
                <input type="search" class="works_query" aria-label="Search for">
                <button type="submit" class="btn primary">Search</button>
            </div>
            <p class="hint works_state" aria-live="polite"></p>
            <ul class="works_list"></ul>
            <div class="actions">
                <a class="btn works_elsewhere" target="_blank" rel="noopener" hidden>Search on Google Scholar ↗</a>
                <span class="spacer"></span>
                <button type="button" class="btn" data-close>Close</button>
            </div>`;
        $('#modals').append(modal);
        modal.addEventListener('submit', e => { e.preventDefault(); search(); });
        modal.addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.dataset.by) { by = b.dataset.by; drawFind(); $m('.works_query').focus(); }
            if (b.dataset.pick) add(Number(b.dataset.pick));
            if (b.dataset.seedHave) {
                options.onSeed?.(b.dataset.seedHave);
                show($m('.works_state').textContent);
            }
        });
        $m('.works_recent input').addEventListener('change', e => { recent = e.target.checked; if ($m('.works_query').value.trim()) search(); });
    }

    function drawFind() {
        for (const b of modal.querySelectorAll('[data-by]')) b.setAttribute('aria-checked', b.dataset.by === by);
        $m('.works_recent').hidden = by !== 'subject';
        $m('.works_recent input').checked = recent;
        $m('.works_query').placeholder = by === 'subject' ? 'Your subject, e.g. reading comprehension in children'
            : 'A title, a whole reference, a DOI or an arXiv link';
    }

    // { projectId, mode: 'add' | 'seed' | 'venue', venue, extra (fields for what's added), onAdded(id), onSeed(id) }
    function open(given) {
        if (!modal) build();
        options = { mode: 'add', ...given };
        results = [];
        const library = options.projectId === Store.LIBRARY_ID;
        const venue = options.mode === 'venue';
        $m('.works_title').textContent = options.title || (venue ? `Recent papers in ${options.venue.label}` : options.mode === 'seed' ? 'Find papers to start from' : 'Find papers');
        $m('.works_intro').textContent = options.intro || (venue ? 'Its papers of the last two years, most cited first. Scan the titles; add the ones that belong in your survey.'
            : options.mode === 'seed' ? 'Recent papers on your subject, most cited first. Add 3 to 5 as seed papers, then have a first pass on each.'
            : `Search by subject for the most-cited papers, or find one by its title, a reference, a DOI or an arXiv link. Each is added to ${library ? 'your Library' : 'the project'} with its details.`);
        if (options.mode === 'seed') { by = 'subject'; recent = true; }
        $m('.works_find').hidden = venue || options.mode === 'seed';
        $m('.works_search').hidden = venue;
        drawFind();
        $m('.works_elsewhere').hidden = true;
        $m('.works_list').replaceChildren();
        $m('.works_state').textContent = '';
        openModal(modal);
        if (venue) loadVenue(options.venue);
        else $m('.works_query').focus();
    }

    async function search() {
        const query = $m('.works_query').value.trim();
        if (!query) return;
        $m('.works_state').textContent = 'Searching…';
        $m('.works_list').replaceChildren();
        try {
            results = by === 'title' ? await PaperSearch.findTitle(query) : await PaperSearch.searchWorks(query, { years: recent ? 5 : 0 });
            show(results.length ? '' : 'Nothing found: try other words.');
        } catch {
            show('Couldn’t reach OpenAlex: check your connection, and try again.');
        }
        const since = by === 'subject' && recent ? 'as_ylo=' + (new Date().getFullYear() - 5) + '&' : '';
        setElsewhere(`https://scholar.google.com/scholar?${since}q=${encodeURIComponent(query)}`);
    }

    async function loadVenue(venue) {
        $m('.works_state').textContent = 'Finding the venue…';
        setElsewhere('https://scholar.google.com/scholar?as_ylo=' + (new Date().getFullYear() - 2) + '&q=' + encodeURIComponent('source:"' + venue.search + '"'));
        try {
            const found = await PaperSearch.findVenue(venue.search);
            if (options?.venue !== venue) return;
            if (!found) return show(`OpenAlex doesn’t know “${venue.label}”. Search it yourself below.`);
            $m('.works_title').textContent = `Recent papers in ${found.name}`;
            $m('.works_state').textContent = 'Loading its papers…';
            results = await PaperSearch.venueWorks(found.id);
            if (options?.venue !== venue) return;
            show(results.length ? '' : `No papers from the last two years found for ${found.name}.`);
        } catch {
            show('Couldn’t reach OpenAlex: check your connection, and try again.');
        }
    }

    function setElsewhere(href) {
        $m('.works_elsewhere').href = href;
        $m('.works_elsewhere').hidden = false;
    }

    // where a paper already is: in this project (or the Library), or in another project
    function whereIs(f) {
        const same = s => s.type === 'source' && ((f.doi && s.doi?.toLowerCase() === f.doi.toLowerCase()) || (norm(s.title) && norm(s.title) === norm(f.title)));
        const here = Store.getItems(options.projectId).find(same);
        if (here) return { here };
        const elsewhere = Store.getProjects().flatMap(p => Store.getItems(p.id)).concat(Store.getItems(Store.LIBRARY_ID)).find(same);
        return { elsewhere };
    }

    function show(message) {
        $m('.works_state').textContent = message;
        const library = options.projectId === Store.LIBRARY_ID;
        const seed = options.mode === 'seed';
        $m('.works_list').replaceChildren(...results.map((r, i) => {
            const f = r.fields;
            const li = el('li');
            const text = el('span');
            text.append(el('strong', '', f.title || '(no title)'));
            const authors = (f.authors || []).slice(0, 3).map(a => a.lastName).filter(Boolean).join(', ') + ((f.authors || []).length > 3 ? ' et al.' : '');
            text.append(el('small', '', [authors, f.venue, (f.published || '').slice(0, 4), r.cited != null ? `cited ${r.cited.toLocaleString()} times` : ''].filter(Boolean).join(' · ')));
            if (f.abstract) {
                const more = el('details', 'works_abstract');
                more.append(el('summary', '', 'Abstract'), el('p', '', f.abstract));
                text.append(more);
            }
            const { here, elsewhere } = whereIs(f);
            if (here) {
                const isSeed = options.seeds?.().includes(here.id);
                const link = el('a', 'link', isSeed ? 'A seed already' : library ? 'In your Library ↗' : 'In the project ↗');
                link.href = 'material.html?id=' + encodeURIComponent(here.id);
                li.append(text, seed && !isSeed ? button('btn small', '★ Make it a seed', { seedHave: here.id }) : link);
            } else {
                const add = button('btn small' + (seed ? ' primary' : ''), seed ? '+ Add as seed' : library ? '+ Add to Library' : '+ Add', { pick: i });
                li.append(text, add);
                if (elsewhere) li.append(el('small', 'hint works_elsewhere_note', library ? 'Already in a project' : 'Also in your Library or another project'));
            }
            return li;
        }));
    }

    function add(i) {
        const r = results[i];
        if (!r) return;
        const id = Store.saveItem({
            projectId: options.projectId, type: 'source', ...r.fields, kind: !r.fields.kind || r.fields.kind === 'other' ? 'article' : r.fields.kind,
            tags: [], status: 'to_read', ...(options.extra || {}),
        });
        options.onAdded?.(id);
        show($m('.works_state').textContent);
    }

    return { open, searchWorks, findTitle, findVenue, venueWorks };
})();

// Source page: the paper's own references (sources/references.js), at the bottom of the notes side.
// Add one, some or all of them to the project: each is looked up for its details and remembers which
// paper it came from (citedIn). Kept folded away, so it never crowds your notes.
// The list is read once, from the arXiv HTML (best) or the PDF, and kept on the source (source.references).

const ReferencesPanel = (() => {
    const selected = new Set(); // reference numbers ticked for "Add selected"
    const looked = new Map();   // reference text -> lookup promise, shared by the profile and adding
    let busy = false;
    const lookup = ref => {
        if (!looked.has(ref.text)) looked.set(ref.text, References.lookup(ref));
        return looked.get(ref.text);
    };

    const refs = () => source.references || [];
    const projectSources = () => Store.getItems(project.id).filter(i => i.type === 'source' && i.id !== source.id);

    // the project source a reference is (one made from it, or one you had already)
    function inProject(ref, sources = projectSources()) {
        const made = ref.sourceId && sources.find(s => s.id === ref.sourceId);
        return made || References.match(ref, sources);
    }

    function keep(list, from) {
        source.references = list;
        source.referencesFrom = from;
        Store.saveItem({ id: source.id, references: list, referencesFrom: from });
    }

    // the views call these once they've read the paper; the HTML version's list wins over the PDF's
    function fromHtml(doc) {
        if (!(source.referencesFrom === 'html' && refs().length)) {
            const list = References.fromHtml(doc);
            if (list.length) keep(merge(list), 'html');
        }
        render();
    }

    function fromPdf(pages) {
        if (!refs().length) {
            const list = References.fromPdfLines(pages);
            if (list.length) keep(merge(list), 'pdf');
        }
        render();
    }

    // a fresh read keeps what you already added from the old one
    function merge(list) {
        return list.map(ref => ({ ...ref, ...(refs().find(old => old.text === ref.text && old.sourceId) ? { sourceId: refs().find(old => old.text === ref.text).sourceId } : {}) }));
    }

    function render() {
        const panel = $('#refs_panel');
        const list = refs();
        panel.hidden = list.length === 0;
        if (!list.length) return;
        const sources = projectSources();
        const added = list.filter(r => inProject(r, sources)).length;
        $('#refs_count').textContent = `(${list.length}${added ? ` · ${added} in project` : ''})`;
        $('#refs_hint').textContent = source.referencesFrom === 'html'
            ? 'From the arXiv HTML version. Add the ones you want to read: their details are looked up for you.'
            : 'Read from the PDF\'s References section: check them, the split between references can be off.';

        const query = $('#refs_search').value.trim().toLowerCase();
        const shown = list.filter(r => !query || r.text.toLowerCase().includes(query));
        for (const n of [...selected]) if (!list.some(r => r.n === n && !inProject(r, sources))) selected.delete(n);

        $('#refs_list').replaceChildren(...shown.map(ref => {
            const existing = inProject(ref, sources);
            const li = el('li', 'ref' + (existing ? ' in_project' : ''));
            li.dataset.n = ref.n;
            const box = el('input');
            box.type = 'checkbox';
            box.className = 'ref_pick';
            box.checked = selected.has(ref.n);
            box.disabled = !!existing || busy;
            box.setAttribute('aria-label', 'Select reference ' + ref.n);
            const text = el('button', 'ref_text');
            text.type = 'button';
            text.title = 'See its details: authors, abstract…';
            text.append(el('span', 'ref_n', `[${ref.n}] `), ref.text);
            const links = el('div', 'ref_links');
            const link = (label, href, cls = '') => {
                const a = el('a', cls, label);
                a.href = href;
                if (/^https?:/.test(href)) {
                    a.target = '_blank';
                    a.rel = 'noopener';
                }
                return a;
            };
            if (existing) links.append(link('In project ↗', 'material.html?id=' + encodeURIComponent(existing.id), 'ref_in'));
            else {
                const add = el('button', 'link ref_add', '+ Add');
                add.type = 'button';
                add.disabled = busy;
                links.append(add);
            }
            if (ref.doi) links.append(link('DOI', 'https://doi.org/' + ref.doi));
            if (ref.arxiv) links.append(link('arXiv', 'https://arxiv.org/abs/' + ref.arxiv));
            links.append(link('Scholar ↗', References.scholarUrl(ref)));
            li.append(box, text, links);
            return li;
        }));
        const addable = shown.filter(r => !inProject(r, sources));
        $('#refs_all').checked = addable.length > 0 && addable.every(r => selected.has(r.n));
        $('#refs_all').disabled = busy || addable.length === 0;
        $('#refs_add').disabled = busy || selected.size === 0;
        $('#refs_add').textContent = selected.size ? `Add selected (${selected.size})` : 'Add selected';
    }

    // Adds references to the project, one by one (lookups are polite: not all at once)
    async function add(numbers) {
        if (busy) return;
        busy = true;
        const list = refs();
        const todo = numbers.map(n => list.find(r => r.n === n)).filter(r => r && !inProject(r));
        let added = 0;
        let toCheck = 0;
        for (const [i, ref] of todo.entries()) {
            setState(`Looking up ${i + 1} of ${todo.length}…`);
            render();
            const { fields, found } = await lookup(ref);
            // found under another name (its DOI was already in the project): just link the two
            const sources = projectSources();
            const same = fields.doi && sources.find(s => s.doi?.toLowerCase() === fields.doi.toLowerCase());
            if (same) {
                Store.saveItem({ id: same.id, citedIn: [...new Set([...(same.citedIn || []), source.id])] });
                ref.sourceId = same.id;
            } else {
                ref.sourceId = Store.saveItem({
                    projectId: project.id,
                    ...sourceFields(ref, fields, found),
                });
                added++;
                if (!found) toCheck++;
            }
            selected.delete(ref.n);
            keep(list, source.referencesFrom);
        }
        busy = false;
        setState(added
            ? `Added ${added} to the project${toCheck ? ` (${toCheck} not found online: details from the reference, check them)` : ''}.`
            : 'Already in the project.');
        render();
    }

    // a source made from a reference and what was found about it (sources/references.js)
    const sourceFields = (ref, fields, found) => References.toSource(ref, fields, found, [source.id]);

    // ---- into your Library (no project): from a reference's profile ----

    const librarySources = () => Store.getItems(Store.LIBRARY_ID).filter(i => i.type === 'source');
    // in the Library already: on its own there, or as the project source made from it
    const inLibrary = ref => References.match(ref, librarySources()) || null;

    async function addToLibrary(ref) {
        if (inLibrary(ref)) return 'In your library already.';
        const { fields, found } = await lookup(ref);
        const same = fields.doi && librarySources().find(s => s.doi?.toLowerCase() === fields.doi.toLowerCase());
        if (same) return 'In your library already.';
        Store.saveItem({ projectId: Store.LIBRARY_ID, ...sourceFields(ref, fields, found) });
        return found ? 'Added to your library.' : 'Added to your library (not found online: details from the reference, check them).';
    }

    function setState(text) {
        $('#refs_state').textContent = text;
    }

    // ---- a reference's profile: who, what, where, the abstract; add it or copy its citation ----

    let profileRef = null;
    let profileFields = null;

    async function openProfile(n) {
        const ref = refs().find(r => r.n === n);
        if (!ref) return;
        profileRef = ref;
        const parsed = References.parse(ref.text);
        showProfile({ ...parsed, kind: 'article' }, null); // what the reference itself says, straight away
        openModal($('#ref_profile'));
        $('#ref_profile_state').textContent = 'Looking it up…';
        const { fields, found } = await lookup(ref);
        if (profileRef !== ref || $('#ref_profile').hidden) return; // closed or moved on meanwhile
        showProfile(fields, found);
    }

    function showProfile(fields, found) {
        const ref = profileRef;
        profileFields = fields;
        const existing = inProject(ref);
        $('#ref_profile_state').textContent = found === null ? '' : found ? ''
            : 'Not found online: these details come from the reference itself.';
        $('#ref_profile_title').textContent = fields.title || References.titleOf(ref) || 'Untitled';
        $('#ref_profile_authors').textContent = (fields.authors || []).map(authorName).filter(Boolean).join(', ') || 'Authors unknown';
        $('#ref_profile_meta').textContent = [KIND_LABELS[fields.kind], fields.venue, (fields.published || '').slice(0, 4)].filter(Boolean).join(' · ');
        const links = $('#ref_profile_links');
        links.replaceChildren();
        const doi = fields.doi || ref.doi;
        if (doi) links.append(externalLink('https://doi.org/' + doi, 'DOI: ' + doi));
        if (ref.arxiv) links.append(externalLink('https://arxiv.org/abs/' + ref.arxiv, 'arXiv'));
        if (fields.pdfUrl) links.append(externalLink(fields.pdfUrl, 'PDF'));
        links.append(externalLink(References.scholarUrl(ref), 'Google Scholar'));
        $('#ref_profile_abstract_box').hidden = !fields.abstract;
        if (fields.abstract) renderMarkdown($('#ref_profile_abstract'), fields.abstract);
        foldLong($('#ref_profile_authors'), 2, { more: 'Show all authors', less: 'Fewer authors' });
        foldLong($('#ref_profile_abstract'), 8);
        $('#ref_profile_cited').textContent = `[${ref.n}] ${ref.text}`;
        $('#ref_profile_add').hidden = !!existing;
        $('#ref_profile_add').disabled = busy;
        const kept = inLibrary(ref);
        $('#ref_profile_library').disabled = !!kept;
        $('#ref_profile_library').textContent = kept ? 'In your library ✓' : '+ Add to library';
        $('#ref_profile_open').hidden = !existing;
        if (existing) $('#ref_profile_open').href = 'material.html?id=' + encodeURIComponent(existing.id);
    }

    $('#ref_profile_add').addEventListener('click', async () => {
        const ref = profileRef;
        $('#ref_profile_add').disabled = true;
        $('#ref_profile_state').textContent = 'Adding…';
        await add([ref.n]);
        if (profileRef === ref) showProfile(profileFields, (await lookup(ref)).found);
        $('#ref_profile_state').textContent = 'Added to the project.';
    });
    $('#ref_profile_library').addEventListener('click', async () => {
        const ref = profileRef;
        $('#ref_profile_library').disabled = true;
        $('#ref_profile_state').textContent = 'Adding to your library…';
        const said = await addToLibrary(ref);
        if (profileRef !== ref) return;
        showProfile(profileFields, (await lookup(ref)).found);
        $('#ref_profile_state').textContent = said;
    });
    $('#ref_profile_copy').addEventListener('click', async e => {
        const btn = e.currentTarget;
        const ok = await copyText(Cite.format({ ...profileFields, citekey: '' }, project.citeStyle || 'apa'));
        btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
        setTimeout(() => { btn.textContent = 'Copy citation'; }, 1600);
    });
    $('#ref_profile').addEventListener('submit', e => e.preventDefault());
    $('#ref_profile_list').addEventListener('click', () => showInList(profileRef.n));

    // the reference in the References list on the notes side: opened, scrolled to and flashed
    function showInList(n) {
        closeModals();
        if (document.body.classList.contains('side_collapsed')) setSideCollapsed(false);
        const panel = $('#refs_panel');
        panel.open = true;
        if ($('#refs_search').value) {
            $('#refs_search').value = '';
            render();
        }
        const li = $(`#refs_list .ref[data-n="${CSS.escape(String(n))}"]`);
        if (!li) return;
        li.scrollIntoView({ block: 'center', behavior: 'smooth' });
        li.classList.remove('flash');
        void li.offsetWidth;
        li.classList.add('flash');
    }

    $('#refs_list').addEventListener('click', e => {
        const li = e.target.closest('.ref');
        if (!li) return;
        if (e.target.closest('.ref_add')) return add([li.dataset.n]);
        if (e.target.closest('.ref_text')) return openProfile(li.dataset.n);
        if (e.target.matches('.ref_pick')) {
            if (e.target.checked) selected.add(li.dataset.n);
            else selected.delete(li.dataset.n);
            render();
        }
    });
    $('#refs_all').addEventListener('change', e => {
        const query = $('#refs_search').value.trim().toLowerCase();
        const sources = projectSources();
        for (const ref of refs()) {
            if (query && !ref.text.toLowerCase().includes(query)) continue;
            if (inProject(ref, sources)) continue;
            if (e.target.checked) selected.add(ref.n);
            else selected.delete(ref.n);
        }
        render();
    });
    $('#refs_search').addEventListener('input', render);
    $('#refs_add').addEventListener('click', () => add([...selected]));

    if (source) render(); // a list read on an earlier visit shows straight away
    return { fromHtml, fromPdf, render, add, openProfile, showInList };
})();

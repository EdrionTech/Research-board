// Project dashboard: Overview / Literature / Research tabs over one list of items.
// Opened as project_dashboard.html?id=<projectId>. Data comes from store.js;
// the Literature tab's source library lives in literature.js.

// Every section on the dashboard. An item's `type` is one of these keys.
// `custom` sections are drawn by their own script instead of the generic list.
const SECTIONS = {
    inbox:       { tab: 'overview',   label: 'Inbox',            hint: 'Quick notes waiting to be sorted' },
    idea:        { tab: 'overview',   label: 'Ideas',            hint: 'Aims, questions and background for your introduction' },
    source:      { tab: 'literature', label: 'Sources',          custom: true },
    source_note: { tab: 'literature', label: 'Note on a source', custom: true },
    note:        { tab: 'literature', label: 'Notes',            hint: 'General notes on your reading' },
    summary:     { tab: 'literature', label: 'Summaries',        hint: 'Synthesis across sources: themes, debates, gaps' },
    methodology: { tab: 'research',   label: 'Methodology',      hint: 'Your plan and the decisions behind it' },
    observation: { tab: 'research',   label: 'Observations',     hint: 'What you noticed while working' },
    data:        { tab: 'research',   label: 'Data',             hint: 'Datasets and where they live' },
    finding:     { tab: 'research',   label: 'Findings',         hint: 'Analysis and results' },
};
const TABS = ['overview', 'literature', 'research'];

const project = Store.getProject(new URLSearchParams(location.search).get('id'));
const form = $('#item_form');

let items = [];
let editingId = null;

// DOMContentLoaded fires after every script on the page, so literature.js is ready by then.
document.addEventListener('DOMContentLoaded', () => {
    if (!project) return location.replace('../index.html');
    init();
});

function init() {
    document.title = project.title + ' · Research Board';
    Nav.backLink($('.bar .back'), '../index.html', 'Projects');
    $('#project_title').textContent = project.title;
    $('#project_desc').textContent = project.desc || 'No description yet.';

    buildSections();
    buildTypeOptions();
    render();
    const tab = location.hash.slice(1);
    showTab(TABS.includes(tab) ? tab : 'overview');
    // ?item=ID (from a paper's "In your notes"): open that note
    const linked = items.find(i => i.id === new URLSearchParams(location.search).get('item'));
    if (linked) {
        showTab(SECTIONS[linked.type]?.tab || 'overview');
        openForm(linked);
    }
}

// ---- layout ----

function buildSections() {
    const template = $('#section_template');
    for (const [type, section] of Object.entries(SECTIONS)) {
        if (section.custom) continue;
        const el = template.content.firstElementChild.cloneNode(true);
        el.dataset.type = type;
        $('h3', el).textContent = section.label;
        $('.hint', el).textContent = section.hint;
        $('.add', el).title = 'Add to ' + section.label;
        $(`[data-sections="${section.tab}"]`).append(el);
    }
}

// Sections a quick note can be filed into (sources are added from the library instead).
function buildTypeOptions() {
    const select = form.elements.type;
    for (const tab of TABS) {
        const group = document.createElement('optgroup');
        group.label = tab[0].toUpperCase() + tab.slice(1);
        for (const [type, section] of Object.entries(SECTIONS)) {
            if (section.tab === tab && type !== 'source') group.append(new Option(section.label, type));
        }
        select.append(group);
    }
}

function showTab(tab) {
    for (const btn of $$('#tabs button')) btn.setAttribute('aria-selected', btn.dataset.tab === tab);
    for (const panel of $$('[data-panel]')) panel.hidden = panel.dataset.panel !== tab;
    history.replaceState(null, '', '#' + tab);
}

// ---- rendering ----

function render() {
    items = Store.getItems(project.id).sort((a, b) => b.updatedAt - a.updatedAt);

    for (const el of $$('.section')) {
        const ofType = items.filter(i => i.type === el.dataset.type);
        $('h3', el).textContent = `${SECTIONS[el.dataset.type].label} (${ofType.length})`;
        $('.items', el).replaceChildren(...(ofType.length
            ? ofType.map(itemRow)
            : [Object.assign(document.createElement('li'), { className: 'none', textContent: 'Nothing here yet.' })]));
    }

    renderStats();
    renderLiterature();
}

function itemRow(item) {
    const li = document.createElement('li');
    li.className = 'item';
    li.tabIndex = 0;
    li.dataset.id = item.id;

    const sources = items.filter(i => i.type === 'source');
    const style = project.citeStyle || 'apa';
    const title = document.createElement('strong');
    title.textContent = item.title || PaperLinks.preview((item.body || '').split('\n')[0], sources, style);
    li.append(title);

    if (item.title && item.body) {
        const preview = document.createElement('p');
        preview.textContent = PaperLinks.preview(item.body, sources, style);
        li.append(preview);
    }

    // the papers it's about
    const papers = PaperLinks.isGeneralNote(item) ? PaperLinks.papersOf(item, sources) : [];
    if (papers.length) {
        const chips = document.createElement('div');
        chips.className = 'paper_chips';
        chips.append(...papers.map(s => {
            const a = document.createElement('a');
            a.className = 'paper_chip';
            a.href = 'material.html?id=' + encodeURIComponent(s.id);
            a.textContent = shortCitation(s) || s.title;
            a.title = s.title;
            return a;
        }));
        li.append(chips);
    }

    const meta = document.createElement('small');
    meta.textContent = new Date(item.updatedAt).toLocaleDateString();
    li.append(meta);
    return li;
}

function displayTitle(item) {
    return item.title || (item.body || '').split('\n')[0];
}

function renderStats() {
    const count = tab => items.filter(i => SECTIONS[i.type]?.tab === tab).length;
    const sources = items.filter(i => i.type === 'source');
    const read = sources.filter(i => i.status === 'done').length;

    const stats = [
        ['Sources read', sources.length ? `${read} / ${sources.length}` : '0'],
        ['Literature items', count('literature')],
        ['Research items', count('research')],
        ['In inbox', items.filter(i => i.type === 'inbox').length],
    ];
    $('#stats').replaceChildren(...stats.map(([label, value]) => {
        const tile = document.createElement('div');
        tile.className = 'stat';
        tile.innerHTML = '<b></b><span></span>';
        tile.firstChild.textContent = value;
        tile.lastChild.textContent = label;
        return tile;
    }));
}

// ---- item form (quick notes and generic sections) ----

let linkedIds = new Set(); // papers linked to the note in the form ("+ Link a paper")

function openForm(item, type = 'inbox') {
    editingId = item?.id ?? null;
    form.reset();

    // a note on a source needs to say which source
    form.elements.sourceId.replaceChildren(new Option('Pick a source…', ''),
        ...items.filter(i => i.type === 'source').map(s => new Option(displayTitle(s), s.id)));

    const f = form.elements;
    f.type.value = item?.type ?? type;
    f.title.value = item?.title ?? '';
    f.body.value = item?.body ?? '';
    f.sourceId.value = item?.sourceId ?? '';
    linkedIds = new Set(item?.sourceIds || []);
    $('#paper_picker').hidden = true;
    $('#link_paper').setAttribute('aria-expanded', 'false');

    $('#form_heading').textContent = item ? 'Edit note'
        : type === 'inbox' ? 'Quick note' : 'New in ' + SECTIONS[type].label;
    $('#delete_item').hidden = !item;
    updateConditionalFields();
    renderLinkChips();

    openModal(form);
    f.body.focus();
}

function updateConditionalFields() {
    const type = form.elements.type.value;
    for (const label of $$('[data-for]', form)) label.hidden = label.dataset.for !== type;
    $('.paper_links', form).hidden = type === 'source_note'; // that one is about its source already
}

// ---- papers in the note: linked chips (×), cited ones marked; a picker to add more ----

const projectSources = () => {
    const sources = items.filter(i => i.type === 'source');
    assignCitekeys(sources);
    return sources;
};

function renderLinkChips() {
    const sources = projectSources();
    const cited = PaperLinks.citedKeys(form.elements.body.value);
    const shown = sources.filter(s => linkedIds.has(s.id) || cited.has(s.citekey));
    $('#link_chips').replaceChildren(...shown.map(s => {
        const li = el('li', 'link_chip');
        li.title = s.title;
        li.append(shortCitation(s) || s.title);
        if (cited.has(s.citekey)) li.append(el('small', '', ' cited'));
        else {
            const x = el('button', 'link', '×');
            x.type = 'button';
            x.dataset.unlink = s.id;
            x.setAttribute('aria-label', 'Unlink ' + s.title);
            li.append(x);
        }
        return li;
    }));
}

function renderPaperResults() {
    const query = $('#paper_search').value.trim().toLowerCase();
    const sources = projectSources().filter(s => !query || [s.title, shortCitation(s), s.citekey, s.venue].join(' ').toLowerCase().includes(query));
    $('#paper_results').replaceChildren(...(sources.length ? sources.slice(0, 30).map(s => {
        const btn = el('button', 'paper_result');
        btn.type = 'button';
        btn.dataset.id = s.id;
        btn.append(el('strong', '', s.title), el('small', '', [shortCitation(s), linkedIds.has(s.id) ? 'linked' : ''].filter(Boolean).join(' · ')));
        return btn;
    }) : [el('li', 'none', 'No sources match. Add papers on the Literature tab.')]));
}

$('#link_paper').onclick = () => {
    const picker = $('#paper_picker');
    picker.hidden = !picker.hidden;
    $('#link_paper').setAttribute('aria-expanded', !picker.hidden);
    if (!picker.hidden) {
        renderPaperResults();
        $('#paper_search').focus();
    }
};
$('#paper_search').oninput = renderPaperResults;
// keep the caret in the note while picking, so a citation goes where you were typing
$('#paper_results').addEventListener('mousedown', e => e.preventDefault());
$('#paper_results').addEventListener('click', e => {
    const btn = e.target.closest('.paper_result');
    if (!btn) return;
    const source = projectSources().find(s => s.id === btn.dataset.id);
    linkedIds.add(source.id);
    if ($('#cite_in_text').checked) {
        const area = form.elements.body;
        const { selectionStart: start, selectionEnd: end, value } = area;
        const before = start && !/\s$/.test(value.slice(0, start)) ? ' ' : '';
        MdBar.replace(area, start, end, `${before}[@${source.citekey}]`);
    }
    renderLinkChips();
    renderPaperResults();
});
$('#link_chips').addEventListener('click', e => {
    const id = e.target.closest('[data-unlink]')?.dataset.unlink;
    if (!id) return;
    linkedIds.delete(id);
    renderLinkChips();
});
form.elements.body.addEventListener('input', renderLinkChips);
MdImages.enable(form.elements.body); // paste or drop images
$('#note_image').onclick = () => MdImages.pick(form.elements.body);
form.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        form.requestSubmit();
    }
});

// ---- events ----

$('#tabs').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn) showTab(btn.dataset.tab);
});

$('#quick_note').onclick = () => openForm(null, 'inbox');

$('.workspace').addEventListener('click', e => {
    const add = e.target.closest('.add');
    if (add) return openForm(null, add.closest('.section').dataset.type);
    const row = e.target.closest('.item');
    if (row) openForm(items.find(i => i.id === row.dataset.id));
});
$('.workspace').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('item')) e.target.click();
});

form.elements.type.addEventListener('change', updateConditionalFields);
MdBar.attach(form.elements.body); // bold, lists, links as buttons (phones have no Ctrl + B)

form.addEventListener('submit', e => {
    e.preventDefault();
    const f = form.elements;
    const data = {
        id: editingId,
        projectId: project.id,
        type: f.type.value,
        title: f.title.value.trim(),
        body: f.body.value.trim(),
    };
    if (!data.title && !data.body) return f.body.focus();
    if (data.type === 'source_note') {
        data.sourceId = f.sourceId.value;
        if (!data.sourceId) return f.sourceId.focus();
    } else {
        // linked here or cited in the text
        data.sourceIds = PaperLinks.papersOf({ body: data.body, sourceIds: [...linkedIds] }, projectSources()).map(s => s.id);
    }

    Store.saveItem(data);
    closeModals();
    render();
});

$('#delete_item').onclick = () => {
    if (!confirm('Delete this item?')) return;
    Store.deleteItem(editingId);
    closeModals();
    render();
};

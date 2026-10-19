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
    $('#project_title').textContent = project.title;
    $('#project_desc').textContent = project.desc || 'No description yet.';

    buildSections();
    buildTypeOptions();
    render();
    const tab = location.hash.slice(1);
    showTab(TABS.includes(tab) ? tab : 'overview');
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

    const title = document.createElement('strong');
    title.textContent = displayTitle(item);
    li.append(title);

    if (item.title && item.body) {
        const preview = document.createElement('p');
        preview.textContent = item.body;
        li.append(preview);
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

    $('#form_heading').textContent = item ? 'Edit' : 'Add to ' + SECTIONS[f.type.value].label;
    $('#delete_item').hidden = !item;
    updateConditionalFields();

    openModal(form);
    (item || type !== 'inbox' ? f.title : f.body).focus();
}

function updateConditionalFields() {
    const type = form.elements.type.value;
    for (const label of $$('[data-for]', form)) label.hidden = label.dataset.for !== type;
}

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

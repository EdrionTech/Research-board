// Home page: the shelf of project cards. Data comes from store.js.

// ($ and the popups: core/ui.js)

const shelf = $('#shelf');
const template = $('#project_template');
const modals = $('#modals');
const form = $('#project_form');
const viewer = $('#open_project');

let editingId = null;
let openId = null;

// the thumbnail: a link or an uploaded image
$('#project_image').outerHTML = Images.fieldHtml('Thumbnail', 'Image link, or leave blank for the style’s own picture');
const imageField = Images.field($('.image_field', form));

// the project's own picture (a link or one you uploaded), or the current style's default ('thumb' for cards,
// 'cover' for the wide view)
const hasOwnImage = p => Boolean(p.image) && p.image !== Store.DEFAULT_IMAGE;
function showImage(img, p, kind) {
    const fallback = () => { img.onerror = null; img.src = Settings.defaultImage(kind); };
    if (!hasOwnImage(p)) return fallback();
    img.src = Settings.defaultImage(kind); // until the picture is ready
    Images.url(p.image).then(src => {
        if (!src) return fallback();
        img.onerror = fallback;
        img.src = src;
    });
}

function render() {
    const projects = Store.getProjects();
    const query = $('#search').value.trim().toLowerCase();
    const visible = projects.filter(p =>
        (p.title + ' ' + p.desc).toLowerCase().includes(query));

    shelf.replaceChildren(...visible.map(p => {
        const card = template.content.firstElementChild.cloneNode(true);
        card.dataset.id = p.id;
        showImage($('.project_thumbnail', card), p, 'thumb');
        $('.project_title', card).textContent = p.title;
        $('.desc', card).textContent = p.desc;
        return card;
    }));
    markSynced();

    $('#empty').hidden = visible.length > 0;
    $('#empty').innerHTML = projects.length
        ? 'No projects match your search.'
        : 'No projects yet. Click <b>+ New project</b> to start one.';
}

// projects kept in step with a server: a "Synced" mark on their cards
async function markSynced() {
    let links = [];
    let clashes = [];
    try { [links, clashes] = await Promise.all([Store.syncLinks(), Store.conflicts()]); } catch { return; }
    for (const link of links) {
        const card = shelf.querySelector(`.project[data-id="${CSS.escape(link.projectId)}"]`);
        if (!card || card.querySelector('.sync_badge')) continue;
        const clashed = clashes.filter(c => c.projectId === link.projectId).length;
        const badge = document.createElement('span');
        badge.className = 'sync_badge' + (clashed ? ' clash' : '');
        badge.title = clashed ? `${clashed} edit${clashed === 1 ? '' : 's'} clashed while apart: see its Settings`
            : link.error ? `Synced with ${link.server}; last try failed: ${link.error}` : `Synced with ${link.server}`;
        badge.innerHTML = '<span class="i" data-i="cloud" aria-hidden="true"></span>Synced' + (clashed ? ` · ${clashed} clash${clashed === 1 ? '' : 'es'}` : '');
        $('.overhead', card).prepend(badge);
    }
}
addEventListener('storage', e => { if (e.key === 'research_board_projects') render(); }); // a sync brought changes

// ---- modals ----

const showModal = openModal; // (core/ui.js)
form.addEventListener('modalclose', () => {
    imageField.discard(); // an image uploaded but not saved
    editingId = null;
});
viewer.addEventListener('modalclose', () => { openId = null; });

function openForm(project) {
    editingId = project?.id ?? null;
    $('#form_heading').textContent = project ? 'Project settings' : 'New project';
    // where a new one is kept: here only, or synced with a server you've connected to (Settings › Sync with a server)
    const servers = project ? [] : Store.savedServers();
    $('#project_place_label').hidden = !servers.length;
    $('#project_place').replaceChildren(new Option('On this device only', ''),
        ...servers.map(s => new Option(`On ${s.name || s.address.replace(/^https?:\/\//, '')}, synced with this device`, s.address)));
    $('#project_sync').hidden = !project;
    if (project) ProjectSync.render($('#project_sync_body'), project.id, { settingsHref: 'page/settings.html', onCopied: () => render() });
    form.reset();
    if (project) {
        form.elements.title.value = project.title;
        form.elements.desc.value = project.desc;
    }
    imageField.set(project && hasOwnImage(project) ? project.image : '');
    showModal(form);
    form.elements.title.focus();
}

function openProject(project) {
    openId = project.id;
    showImage($('.hero', viewer), project, 'cover');
    $('.title', viewer).textContent = project.title;
    $('.desc', viewer).textContent = project.desc;
    $('.open', viewer).href = 'page/project_dashboard.html?id=' + encodeURIComponent(project.id);
    showModal(viewer);
}

// ---- events ----

$('#new_project').onclick = () => openForm();
// another style or theme: its default pictures
addEventListener('settingschange', () => {
    render();
    const open = openId && Store.getProject(openId);
    if (open) showImage($('.hero', viewer), open, 'cover');
});
$('#search').oninput = render;

shelf.addEventListener('click', e => {
    const card = e.target.closest('.project');
    if (!card) return;
    const project = Store.getProject(card.dataset.id);

    if (e.target.closest('.edit')) return openForm(project);
    if (e.target.closest('.delete')) {
        if (confirm(`Delete "${project.title}" and everything in it?`)) {
            Store.deleteProject(project.id);
            render();
        }
        return;
    }
    openProject(project);
});

shelf.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('project')) e.target.click();
});

form.addEventListener('submit', e => {
    e.preventDefault();
    const isNew = !editingId;
    const server = isNew && Store.savedServers().find(s => s.address === form.elements.place.value);
    const id = Store.saveProject({
        id: editingId,
        title: form.elements.title.value.trim(),
        desc: form.elements.desc.value.trim(),
        image: imageField.value,
    });
    imageField.commit();
    render();
    closeModals();
    // on a server from the start (it goes up once it's saved here: the link sends everything)
    if (server) {
        Store.linkProject(id, { server: server.address, key: server.key })
            .then(render)
            .catch(err => alert(`The project was made on this device, but couldn't be put on ${server.name || server.address}: ${err.message}. Try again from its Settings (Sync).`));
    }
});

// (closing a popup: a click outside it, a [data-close] button, Escape: core/ui.js)

render();

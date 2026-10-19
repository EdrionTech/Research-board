// Home page: the shelf of project cards. Data comes from store.js.

const $ = (sel, root = document) => root.querySelector(sel);

const shelf = $('#shelf');
const template = $('#project_template');
const modals = $('#modals');
const form = $('#project_form');
const viewer = $('#open_project');

let editingId = null;
let openId = null;

// the project's own picture, or the current style's default ('thumb' for cards, 'cover' for the wide view)
const hasOwnImage = p => Boolean(p.image) && p.image !== Store.DEFAULT_IMAGE;
const projectImage = (p, kind) => hasOwnImage(p) ? p.image : Settings.defaultImage(kind);

function render() {
    const projects = Store.getProjects();
    const query = $('#search').value.trim().toLowerCase();
    const visible = projects.filter(p =>
        (p.title + ' ' + p.desc).toLowerCase().includes(query));

    shelf.replaceChildren(...visible.map(p => {
        const card = template.content.firstElementChild.cloneNode(true);
        card.dataset.id = p.id;
        const img = $('.project_thumbnail', card);
        img.src = projectImage(p, 'thumb');
        img.onerror = () => { img.onerror = null; img.src = Settings.defaultImage('thumb'); };
        $('.project_title', card).textContent = p.title;
        $('.desc', card).textContent = p.desc;
        return card;
    }));

    $('#empty').hidden = visible.length > 0;
    $('#empty').innerHTML = projects.length
        ? 'No projects match your search.'
        : 'No projects yet. Click <b>+ New project</b> to start one.';
}

// ---- modals ----

function showModal(modal) {
    modals.hidden = false;
    form.hidden = modal !== form;
    viewer.hidden = modal !== viewer;
}

function closeModals() {
    modals.hidden = true;
    editingId = null;
    openId = null;
}

function openForm(project) {
    editingId = project?.id ?? null;
    $('#form_heading').textContent = project ? 'Edit project' : 'New project';
    form.reset();
    if (project) {
        form.elements.title.value = project.title;
        form.elements.desc.value = project.desc;
        form.elements.image.value = hasOwnImage(project) ? project.image : '';
    }
    showModal(form);
    form.elements.title.focus();
}

function openProject(project) {
    openId = project.id;
    const hero = $('.hero', viewer);
    hero.src = projectImage(project, 'cover');
    hero.onerror = () => { hero.onerror = null; hero.src = Settings.defaultImage('cover'); };
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
    if (open) $('.hero', viewer).src = projectImage(open, 'cover');
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
    Store.saveProject({
        id: editingId,
        title: form.elements.title.value.trim(),
        desc: form.elements.desc.value.trim(),
        image: form.elements.image.value.trim(),
    });
    render();
    closeModals();
});

modals.addEventListener('click', e => {
    if (e.target === modals || e.target.closest('[data-close]')) closeModals();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modals.hidden) closeModals();
});

render();

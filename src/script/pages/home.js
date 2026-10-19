// Home page: the shelf of project cards. Data comes from store.js.

const $ = (sel, root = document) => root.querySelector(sel);

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
    if (!form.hidden) imageField.discard(); // an image uploaded but not saved
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
    Store.saveProject({
        id: editingId,
        title: form.elements.title.value.trim(),
        desc: form.elements.desc.value.trim(),
        image: imageField.value,
    });
    imageField.commit();
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

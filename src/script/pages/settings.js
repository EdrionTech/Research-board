// Settings page: appearance (theme, style, your own CSS) and your data (backup, restore, delete).
// Appearance is saved by core/settings.js; data goes through core/store.js.

// ---- appearance ----

function renderAppearance() {
    const settings = Settings.read();
    for (const btn of $$('[data-theme-choice]')) btn.setAttribute('aria-checked', btn.dataset.themeChoice === settings.theme);

    $('#style_cards').replaceChildren(...Object.entries(Settings.STYLES).map(([id, style]) => {
        const card = el('button', 'style_card');
        card.type = 'button';
        card.setAttribute('role', 'radio');
        card.setAttribute('aria-checked', id === settings.style);
        card.dataset.style = id;
        // a tiny picture of the style: page, window, button, ink
        const [page, sheet, key, ink] = style.swatch;
        const preview = el('span', 'style_preview');
        preview.style.background = page;
        preview.innerHTML = `<span class="pv_window" style="background:${sheet};border-color:${ink}">
            <span class="pv_line" style="background:${ink}"></span><span class="pv_line short" style="background:${ink}"></span>
            <span class="pv_key" style="background:${key};border-color:${ink}"></span></span>`;
        preview.classList.add('pv_' + id); // each style can draw its own little picture (settings.css)
        card.append(preview, el('strong', '', style.label), el('small', '', style.description));
        return card;
    }));

    if (document.activeElement !== $('#custom_css')) $('#custom_css').value = settings.customCss;
}

$('#theme_choice').addEventListener('click', e => {
    const btn = e.target.closest('[data-theme-choice]');
    if (!btn) return;
    Settings.save({ theme: btn.dataset.themeChoice });
    renderAppearance();
});

$('#style_cards').addEventListener('click', e => {
    const card = e.target.closest('[data-style]');
    if (!card) return;
    Settings.save({ style: card.dataset.style });
    renderAppearance();
});

function showCssState(text) {
    $('#css_state').textContent = text;
    setTimeout(() => { if ($('#css_state').textContent === text) $('#css_state').textContent = ''; }, 2500);
}

$('#apply_css').onclick = () => {
    Settings.save({ customCss: $('#custom_css').value });
    showCssState('Applied ✓');
};
$('#clear_css').onclick = () => {
    $('#custom_css').value = '';
    Settings.save({ customCss: '' });
    showCssState('Cleared');
};
$('#css_file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    $('#custom_css').value = await file.text();
    Settings.save({ customCss: $('#custom_css').value });
    showCssState(`Loaded ${file.name} ✓`);
});
// Ctrl/Cmd + Enter applies
$('#custom_css').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        $('#apply_css').click();
    }
});

// ---- your data ----

const mb = bytes => (bytes / 1048576).toFixed(1) + ' MB';

function setDataState(text) {
    $('#data_state').textContent = text;
}

async function renderStorage() {
    const projects = Store.getProjects().length;
    const items = Store.getProjects().reduce((n, p) => n + Store.getItems(p.id).length, 0);
    let usage = '';
    try {
        const estimate = await navigator.storage?.estimate();
        if (estimate?.usage !== undefined) usage = ` About ${mb(estimate.usage)} used in this browser.`;
    } catch { /* not available */ }
    $('#storage_info').textContent = `${projects} project${projects === 1 ? '' : 's'} and ${items} sources, notes and other items, kept in this browser only.${usage} Back them up to move to another computer or keep them safe.`;
}

$('#backup').onclick = async () => {
    const includeFiles = $('#backup_files').checked;
    setDataState(includeFiles ? 'Preparing the backup with your files…' : 'Preparing the backup…');
    try {
        const data = await Store.backup({ includeFiles });
        const text = JSON.stringify(data);
        downloadText(`research-board-backup-${new Date().toISOString().slice(0, 10)}.json`, text, 'application/json');
        setDataState(`Backup downloaded (${mb(text.length)}, ${Object.keys(data.files).length} files).`);
    } catch (err) {
        setDataState("Couldn't make the backup: " + err.message);
    }
};

$('#restore_file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let data;
    try {
        data = JSON.parse(await file.text());
    } catch {
        return setDataState("That file isn't a backup (it isn't JSON).");
    }
    const count = Array.isArray(data.projects) ? data.projects.length : 0;
    if (!confirm(`Replace everything here with this backup (${count} project${count === 1 ? '' : 's'})? What's here now will be deleted.`)) return;
    setDataState('Restoring…');
    try {
        await Store.restore(data);
        setDataState(`Restored ${count} project${count === 1 ? '' : 's'} ✓`);
        renderStorage();
    } catch (err) {
        setDataState("Couldn't restore: " + err.message);
    }
});

$('#delete_all').onclick = async () => {
    if (!confirm('Delete all projects, sources, notes and files in this browser? This cannot be undone. (Download a backup first if you might want them.)')) return;
    await Store.clearAll();
    setDataState('Everything was deleted.');
    renderStorage();
};

renderAppearance();
renderStorage();

// back to the page that opened Settings
Nav.backLink($('#back_link'), '../index.html', 'Projects');

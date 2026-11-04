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

    renderPalettes(settings);
    if (document.activeElement !== $('#custom_css')) $('#custom_css').value = settings.customCss;
}

// ---- colours: the style's own choices, your saved sets (editable), and + New ----

const sliceOf = colors => (colors.length === 1 ? colors[0]
    : `conic-gradient(${colors.map((c, i) => `${c} ${i * 100 / colors.length}% ${(i + 1) * 100 / colors.length}%`).join(', ')})`);
const RAINBOW = 'conic-gradient(#f03e3e, #f59f00, #fab005, #40c057, #15aabf, #4c6ef5, #ae3ec9, #f03e3e)';
const newSetId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function circle(id, label, background, on, extra = '') {
    const btn = el('button', 'palette_choice' + extra);
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', on);
    btn.dataset.palette = id;
    btn.title = label;
    const dot = el('span', 'palette_circle');
    dot.style.background = background;
    btn.append(dot, el('small', '', label));
    return btn;
}

// An earlier version kept one "Your own" per style (customColors): it becomes a saved set, once
function adoptOldCustom(settings) {
    const style = settings.style;
    const old = settings.customColors?.[style];
    if (!old || !Settings.PALETTES[style]) return settings;
    const set = { id: newSetId(), label: 'My colours', colors: Settings.fullColors(style, old) };
    const { [style]: _, ...customColors } = settings.customColors;
    return Settings.save({
        customColors,
        savedPalettes: { ...settings.savedPalettes, [style]: [...Settings.savedOf(settings, style), set] },
        palettes: settings.palettes?.[style] === 'custom' ? { ...settings.palettes, [style]: 'saved:' + set.id } : settings.palettes,
    });
}

function renderPalettes(settings) {
    const palette = Settings.PALETTES[settings.style];
    $('#palette_setting').hidden = !palette;
    if (!palette) return;
    settings = adoptOldCustom(settings);
    const style = settings.style;
    let chosen = settings.palettes?.[style] || 'original';
    if (!Settings.choiceOf(settings, style, chosen)) chosen = 'original'; // a deleted set
    $('#palette_hint').textContent = `Repaint ${Settings.STYLES[style].label} in other colours${palette.families.length > 1 ? ' (each circle is a set)' : ''}. Light and dark follow. + New saves your own set, to edit any time.`;
    const saved = Settings.savedOf(settings, style);
    const newBtn = circle('new', '+ New', RAINBOW, false, ' new');
    newBtn.title = 'Save a new colour set, starting from the colours you have now';
    $('#palette_circles').replaceChildren(
        ...palette.choices.map(c => circle(c.id, c.label, sliceOf(c.colors), c.id === chosen)),
        ...saved.map(set => circle('saved:' + set.id, set.label, sliceOf(Settings.fullColors(style, set.colors)), 'saved:' + set.id === chosen, ' saved')),
        newBtn);
    renderSetEditor(settings, chosen);
}

// the chosen saved set, editable: its name, a colour box per family, duplicate, delete
function renderSetEditor(settings, chosen) {
    const box = $('#palette_custom');
    const choice = Settings.choiceOf(settings, settings.style, chosen);
    box.hidden = !choice?.saved;
    if (!choice?.saved) return;
    const { families, roles = [] } = Settings.PALETTES[settings.style];
    const name = el('input', 'set_name');
    name.value = choice.label;
    name.maxLength = 40;
    name.setAttribute('aria-label', 'Name of this colour set');
    const nameLabel = el('label', 'set_name_label');
    nameLabel.append(el('span', '', 'Name'), name);
    const colors = el('div', 'set_colors');
    colors.append(...families.map((family, i) => {
        const label = el('label', 'custom_color');
        const input = el('input');
        input.type = 'color';
        input.value = choice.colors[i];
        input.dataset.index = i;
        // named for what it paints (the details on hover)
        const [name, what] = roles[i] || [family[0].toUpperCase() + family.slice(1), ''];
        label.title = what;
        input.setAttribute('aria-label', what ? `${name}: ${what}` : name);
        label.append(input, el('span', '', name));
        return label;
    }));
    const actions = el('div', 'set_actions');
    for (const [act, label] of [['duplicate', 'Duplicate'], ['delete', 'Delete']]) {
        const btn = el('button', 'btn small' + (act === 'delete' ? ' danger' : ''), label);
        btn.type = 'button';
        btn.dataset.setAct = act;
        actions.append(btn);
    }
    box.dataset.set = choice.saved.id;
    box.replaceChildren(nameLabel, colors, actions, el('small', 'hint', 'Changes are saved as you make them. Shades for light and dark are worked out from these colours, kept readable.'));
}

// the saved sets of the style, with one changed (or removed: change null)
function withSet(settings, id, change) {
    const style = settings.style;
    const list = Settings.savedOf(settings, style)
        .map(set => (set.id === id ? (change ? { ...set, ...change } : null) : set)).filter(Boolean);
    return { ...settings.savedPalettes, [style]: list };
}

function addSet(settings, colors, label) {
    const style = settings.style;
    const list = Settings.savedOf(settings, style);
    const set = { id: newSetId(), label: label || `My colours ${list.length + 1}`, colors };
    Settings.save({ savedPalettes: { ...settings.savedPalettes, [style]: [...list, set] }, palettes: { ...settings.palettes, [style]: 'saved:' + set.id } });
    renderAppearance();
    $('#palette_custom .set_name')?.select();
}

const editedColors = input => {
    const settings = Settings.read();
    const id = $('#palette_custom').dataset.set;
    const set = Settings.savedOf(settings, settings.style).find(p => p.id === id);
    const colors = Settings.fullColors(settings.style, set?.colors);
    colors[Number(input.dataset.index)] = input.value;
    return { settings, id, savedPalettes: withSet(settings, id, { colors }) };
};
// while dragging in the picker: shown at once; saved when you let go
$('#palette_custom').addEventListener('input', e => {
    if (!e.target.matches('input[type="color"]')) return;
    const { settings, savedPalettes } = editedColors(e.target);
    Settings.apply({ ...settings, savedPalettes });
});
$('#palette_custom').addEventListener('change', e => {
    const settings = Settings.read();
    const id = $('#palette_custom').dataset.set;
    if (e.target.matches('input[type="color"]')) Settings.save({ savedPalettes: editedColors(e.target).savedPalettes });
    else if (e.target.matches('.set_name')) Settings.save({ savedPalettes: withSet(settings, id, { label: e.target.value.trim() || 'My colours' }) });
    else return;
    // the circles show the new colours / name; the editor stays as it is (you may still be in it)
    const after = Settings.read();
    const btn = $(`#palette_circles [data-palette="saved:${id}"]`);
    const set = Settings.choiceOf(after, after.style, 'saved:' + id);
    if (btn && set) btn.replaceWith(circle(btn.dataset.palette, set.label, sliceOf(set.colors), true, ' saved'));
});
$('#palette_custom').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('.set_name')) e.target.blur();
});
$('#palette_custom').addEventListener('click', e => {
    const act = e.target.closest('[data-set-act]')?.dataset.setAct;
    if (!act) return;
    const settings = Settings.read();
    const id = $('#palette_custom').dataset.set;
    const set = Settings.choiceOf(settings, settings.style, 'saved:' + id);
    if (!set) return;
    if (act === 'duplicate') return addSet(settings, [...set.colors], (set.label + ' copy').slice(0, 40));
    if (!confirm(`Delete the colour set "${set.label}"?`)) return;
    Settings.save({ savedPalettes: withSet(settings, id, null), palettes: { ...settings.palettes, [settings.style]: 'original' } });
    renderAppearance();
});

$('#palette_circles').addEventListener('click', e => {
    const btn = e.target.closest('[data-palette]');
    if (!btn) return;
    const settings = Settings.read();
    if (btn.dataset.palette === 'new') {
        // starts from what's showing now: the chosen colours, or the style's own
        const current = Settings.choiceOf(settings, settings.style, settings.palettes?.[settings.style] || 'original')
            || Settings.PALETTES[settings.style].choices[0];
        return addSet(settings, [...current.colors]);
    }
    Settings.save({ palettes: { ...settings.palettes, [settings.style]: btn.dataset.palette } });
    renderAppearance();
});

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
    const counts = `${projects} project${projects === 1 ? '' : 's'} and ${items} sources, notes and other items`;
    if (Store.mode === 'app') {
        $('#storage_where').textContent = 'Stored on this device';
        $('#storage_info').textContent = `${counts}, kept by the Research Board app on this device${window.RB_SERVER.dataDir ? `: ${window.RB_SERVER.dataDir}` : ''}. Back them up with a backup file below.`;
        return;
    }
    $('#storage_where').textContent = 'Stored on this computer';
    $('#storage_info').textContent = `${counts}, kept in the data folder by the Research Board server: ${window.RB_SERVER.dataDir}. Back it up by copying that folder, or with a backup file below.`;
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

// Highlight colours. Each project has its own set: any colour you like, and you decide what each one means
// (yellow = "Question", green = "Quotable"…). A note keeps only the colour's id (note.color); the colour and
// its meaning come from the project, so changing "Quotable" changes it on every note in every paper.
// Word-level highlights use ::highlight(noted-<id>) rules, written for the project's colours by css().

const NoteColors = (() => {
    // suggestions for a new colour (any colour can be picked); also the colours of older projects
    const PRESETS = [
        { id: 'yellow', hex: '#ffd43b' }, { id: 'green', hex: '#69db7c' }, { id: 'blue', hex: '#74c0fc' },
        { id: 'pink', hex: '#f783ac' }, { id: 'orange', hex: '#ffa94d' }, { id: 'purple', hex: '#b197fc' },
        { id: 'red', hex: '#ff8787' }, { id: 'teal', hex: '#38d9a9' }, { id: 'lime', hex: '#c0eb75' },
        { id: 'cyan', hex: '#66d9e8' }, { id: 'indigo', hex: '#91a7ff' }, { id: 'grape', hex: '#e599f7' },
    ];
    const DEFAULTS = [
        { id: 'yellow', label: 'Important', hex: '#ffd43b' },
        { id: 'green', label: 'Quotable', hex: '#69db7c' },
        { id: 'blue', label: 'Method', hex: '#74c0fc' },
        { id: 'pink', label: 'Question', hex: '#f783ac' },
    ];
    const MAX = 24;
    const NONE = '#ffc800'; // notes without a colour keep the original highlight

    const isHex = hex => /^#[0-9a-f]{6}$/i.test(hex || '');
    const validId = id => /^[a-z0-9-]{1,24}$/i.test(id || '');

    // The project's colours: [{ id, label, hex }], in the order you set
    function of(project) {
        const saved = Array.isArray(project?.colors) ? project.colors : DEFAULTS;
        return saved.filter(c => validId(c.id)).map(c => {
            const hex = isHex(c.hex) ? c.hex.toLowerCase() : PRESETS.find(p => p.id === c.id)?.hex || NONE;
            return { id: c.id, hex, label: c.label || 'Untitled' };
        });
    }

    // One colour of the project (null for "no colour" or a colour since removed)
    function find(project, id) {
        return id ? of(project).find(c => c.id === id) || null : null;
    }

    // The hex to paint a note with
    function hexOf(project, id) {
        return find(project, id)?.hex || NONE;
    }

    function save(project, list) {
        project.colors = list.slice(0, MAX).map(({ id, label, hex }) => ({
            id: validId(id) ? id : newId(),
            label: String(label || '').trim().slice(0, 40),
            hex: isHex(hex) ? hex.toLowerCase() : NONE,
        }));
        Store.saveProject({ id: project.id, colors: project.colors });
    }

    const newId = () => 'c' + Math.random().toString(36).slice(2, 9);

    // A colour for "+ Colour": the first suggestion not in use, else a new hue
    function suggest(list) {
        const used = new Set(list.map(c => c.hex.toLowerCase()));
        const free = PRESETS.find(p => !used.has(p.hex));
        if (free) return free.hex;
        const hue = Math.floor(Math.random() * 360);
        return hslToHex(hue, 75, 70);
    }

    function hslToHex(h, s, l) {
        s /= 100;
        l /= 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
            return Math.round(c * 255).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    // ::highlight() rules for the project's colours (word-level notes), for a page or the paper's frame
    function css(project) {
        return of(project).map(c => `::highlight(noted-${c.id}) { background-color: color-mix(in srgb, ${c.hex} 55%, transparent); }`).join('\n');
    }

    // Puts (or updates) those rules in a document
    function applyCss(doc, project) {
        if (!doc?.head) return;
        let style = doc.getElementById('note_color_css');
        if (!style) {
            style = doc.createElement('style');
            style.id = 'note_color_css';
            doc.head.append(style);
        }
        style.textContent = css(project);
    }

    // The colours editor: a row per colour (colour picker, what it means, how many notes use it, ×) and
    // + Colour. Used by the colours popup on the Literature tab and on source pages.
    // count(id): how many notes use a colour; onChange(): after every saved change.
    function editor({ list, add, project, count = () => 0, onChange = () => {} }) {
        const make = (tag, className, text) => {
            const node = document.createElement(tag);
            if (className) node.className = className;
            if (text) node.textContent = text;
            return node;
        };
        const rows = () => [...list.querySelectorAll('.color_row')];
        const fromRows = () => rows().map(row => ({
            id: row.dataset.id, hex: row.querySelector('.color_input').value, label: row.querySelector('.color_label').value,
        }));

        function render() {
            const colors = of(project);
            list.replaceChildren(...colors.map(c => {
                const li = make('li', 'color_row');
                li.dataset.id = c.id;
                const pick = make('input', 'color_input'); // any colour: the system colour picker
                pick.type = 'color';
                pick.value = c.hex;
                pick.title = 'Pick a colour';
                pick.setAttribute('aria-label', `Colour for ${c.label}`);
                const label = make('input', 'color_label');
                label.type = 'text';
                label.value = c.label;
                label.maxLength = 40;
                label.placeholder = 'What it means, e.g. Quotable';
                label.setAttribute('aria-label', 'What this colour means');
                const n = count(c.id);
                const remove = make('button', 'link', '×');
                remove.type = 'button';
                remove.title = 'Remove this colour';
                remove.setAttribute('aria-label', 'Remove ' + c.label);
                remove.dataset.remove = '';
                li.append(pick, label, make('small', '', n ? `${n} note${n === 1 ? '' : 's'}` : ''), remove);
                return li;
            }));
            add.disabled = colors.length >= MAX;
        }

        const commit = colors => {
            save(project, colors);
            render();
            onChange();
        };
        // saved when a meaning is entered or the colour picker closes
        list.addEventListener('change', e => { if (e.target.matches('input')) commit(fromRows()); });
        list.addEventListener('click', e => {
            if (!e.target.closest('[data-remove]')) return;
            const id = e.target.closest('.color_row').dataset.id;
            const n = count(id);
            if (n && !confirm(`${n} note${n === 1 ? ' uses' : 's use'} this colour. Remove it? Their highlights go back to plain.`)) return;
            commit(fromRows().filter(c => c.id !== id));
        });
        add.addEventListener('click', () => {
            const colors = fromRows();
            if (colors.length >= MAX) return;
            commit([...colors, { id: newId(), label: '', hex: suggest(colors) }]);
            list.querySelector('.color_row:last-child .color_label').focus();
        });
        list.closest('form')?.addEventListener('submit', e => e.preventDefault()); // Enter in a meaning just saves it
        render();
        return { render };
    }

    // A small round swatch
    function dot(hex, title) {
        const span = document.createElement('span');
        span.className = 'color_dot';
        span.style.background = hex;
        if (title) span.title = title;
        span.setAttribute('aria-hidden', 'true');
        return span;
    }

    return { MAX, NONE, of, find, hexOf, save, suggest, newId, css, applyCss, editor, dot };
})();

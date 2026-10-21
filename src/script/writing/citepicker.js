// Referencing papers in any note: typing "@" and a few letters of a title, author or citation key lists the
// project's papers under the text box; Enter / Tab or a click puts in [@key] (just @key inside [ … ]).
// The same citations as the literature review, so notes, summaries and the review all link papers alike
// (shown as links by PaperLinks.withLinks).
//   CitePicker.attach(textarea, () => sources)

const CitePicker = (() => {
    let box = null;      // one list for the page, under whichever box is being typed in
    let state = null;    // { area, start, matches, active }

    function list() {
        if (!box) {
            box = document.createElement('div');
            box.className = 'composer cite_picker'; // dressed like the floating panels in each style
            box.setAttribute('role', 'listbox');
            box.hidden = true;
            // a click picks (mousedown: before the text box loses focus)
            box.addEventListener('mousedown', e => {
                const row = e.target.closest('[data-key]');
                if (!row) return;
                e.preventDefault();
                pick(row.dataset.key);
            });
            document.body.append(box);
        }
        return box;
    }

    function close() {
        state = null;
        if (box) box.hidden = true;
    }

    // "@att" just before the cursor (at the start, or after a space or bracket)
    function typed(area) {
        const before = area.value.slice(0, area.selectionStart);
        const m = before.match(/(^|[\s(\[;])@([\w:.\-]*)$/);
        return m && area.selectionStart === area.selectionEnd ? { start: before.length - m[2].length - 1, query: m[2].toLowerCase() } : null;
    }

    function update(area, sources) {
        const at = typed(area);
        if (!at) return close();
        const all = sources();
        assignCitekeys(all);
        const words = at.query.split(/[\s:.\-]+/).filter(Boolean);
        const matches = all
            .filter(s => {
                const text = [s.citekey, s.title, authorsLine(s), s.published].join(' ').toLowerCase();
                return words.every(w => text.includes(w));
            })
            .slice(0, 7);
        if (!matches.length) return close();
        state = { area, start: at.start, matches, active: Math.min(state?.area === area ? state.active : 0, matches.length - 1) };
        draw();
    }

    function draw() {
        const el = list();
        el.replaceChildren(...state.matches.map((s, i) => {
            const row = document.createElement('div');
            row.className = 'cite_pick' + (i === state.active ? ' active' : '');
            row.setAttribute('role', 'option');
            row.dataset.key = s.citekey;
            const title = document.createElement('strong');
            title.textContent = s.title;
            const meta = document.createElement('small');
            meta.textContent = [shortCitation(s), '@' + s.citekey].filter(Boolean).join(' · ');
            row.append(title, meta);
            return row;
        }));
        // under the text box, kept on screen
        const r = state.area.getBoundingClientRect();
        el.hidden = false;
        const width = Math.min(Math.max(r.width, 260), innerWidth - 16);
        el.style.width = width + 'px';
        el.style.left = Math.max(8, Math.min(r.left, innerWidth - width - 8)) + 'px';
        const below = r.bottom + 4;
        const height = el.offsetHeight;
        el.style.top = (below + height > innerHeight - 8 ? Math.max(8, r.top - height - 4) : below) + 'px';
    }

    function pick(key) {
        const { area, start } = state;
        const end = area.selectionStart;
        const inBrackets = /\[[^\]]*$/.test(area.value.slice(0, start)); // already inside [ … ]
        const text = inBrackets ? '@' + key : `[@${key}]`;
        area.focus();
        area.setRangeText(text, start, end, 'end');
        area.dispatchEvent(new Event('input', { bubbles: true }));
        close();
    }

    function attach(area, sources) {
        area.addEventListener('input', () => update(area, sources));
        area.addEventListener('click', () => update(area, sources));
        area.addEventListener('blur', () => setTimeout(() => { if (state?.area === area) close(); }, 150));
        // while the list is open: ↑ ↓ choose, Enter / Tab put it in, Esc closes (and nothing else)
        area.addEventListener('keydown', e => {
            if (!state || state.area !== area || box.hidden) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                state.active = (state.active + (e.key === 'ArrowDown' ? 1 : -1) + state.matches.length) % state.matches.length;
                draw();
            } else if ((e.key === 'Enter' && !e.ctrlKey && !e.metaKey) || e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                pick(state.matches[state.active].citekey);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                close();
            }
        });
        if (!area.placeholder.includes('@')) area.placeholder = area.placeholder ? area.placeholder.replace(/\.?$/, '. Type @ to cite a paper.') : 'Type @ to cite a paper.';
    }

    addEventListener('resize', close);
    addEventListener('scroll', () => { if (state) draw(); }, true);
    return { attach };
})();

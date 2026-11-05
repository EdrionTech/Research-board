// Citing papers in any note, summary or review field, two ways:
//   - the Cite button in the formatting bar (writing/mdbar.js): a list of the project's papers with a search box
//   - typing "@" and a few letters of a title, author or citation key: the same list, under the text box
// Each paper can go in as (Author, year) — Enter or a click, saved as [@key] — or as Author (year), the authors
// in your sentence — Shift + Enter or its second button, saved as @key. Inside [ … ] already, just @key.
// The same citations as the literature review, so notes, summaries and the review all link papers alike
// (shown as links by PaperLinks.withLinks). In Visual (the formatted text) they show as finished chips.
//   CitePicker.attach(textarea, () => sources)     (after MdBar.attach, so the Visual box exists)

const CitePicker = (() => {
    let box = null;      // one list for the page, under whichever box it's for
    let state = null;    // { editor, at, matches, active, browsing }

    // An editor: where the citation goes and how to put it in, for each way of writing.
    //   el: what's typed in   typed(): where "@…" was typed, or null   here(): the cursor now   put(at, raw)
    function markdownEditor(area) {
        return {
            el: area,
            typed() {
                const before = area.value.slice(0, area.selectionStart);
                const m = before.match(/(^|[\s(\[;])@([\w:.\-]*)$/);
                return m && area.selectionStart === area.selectionEnd
                    ? { start: before.length - m[2].length - 1, end: area.selectionStart, query: m[2].toLowerCase(), before } : null;
            },
            here() {
                return { start: area.selectionStart, end: area.selectionEnd, before: area.value.slice(0, area.selectionStart) };
            },
            put(at, raw) {
                area.focus();
                area.setRangeText(raw, at.start, at.end, 'end');
                area.dispatchEvent(new Event('input', { bubbles: true }));
            },
        };
    }

    // in Visual: the words before the cursor in the text it's in
    function visualEditor(visual) {
        return {
            el: visual,
            typed() {
                const sel = getSelection();
                if (!sel.rangeCount || !sel.isCollapsed || sel.anchorNode?.nodeType !== Node.TEXT_NODE || !visual.contains(sel.anchorNode)) return null;
                const node = sel.anchorNode;
                const before = node.data.slice(0, sel.anchorOffset).replace(/ /g, ' ');
                const m = before.match(/(^|[\s(\[;])@([\w:.\-]*)$/);
                if (!m) return null;
                const range = document.createRange();
                range.setStart(node, before.length - m[2].length - 1);
                range.setEnd(node, sel.anchorOffset);
                return { range, query: m[2].toLowerCase(), before };
            },
            here() {
                // the cursor (or the words selected), or the end of the text
                const sel = getSelection();
                let range;
                if (sel.rangeCount && visual.contains(sel.anchorNode)) range = sel.getRangeAt(0).cloneRange();
                else {
                    range = document.createRange();
                    range.selectNodeContents(visual.lastElementChild || visual);
                    range.collapse(false);
                }
                const lead = range.cloneRange();
                lead.setStart(visual, 0);
                return { range, before: lead.toString() };
            },
            put(at, raw) {
                const area = visual.rbArea;
                visual.focus();
                const sel = getSelection();
                const { range } = at;
                sel.removeAllRanges();
                sel.addRange(range);
                // a whole citation: a chip ("(Vaswani et al., 2017)" / "Vaswani et al. (2017)"), then a space
                if (area?.rbMakeChip && !inBrackets(at)) {
                    range.deleteContents();
                    const chip = area.rbMakeChip(raw);
                    const space = document.createTextNode(' ');
                    range.insertNode(space);
                    range.insertNode(chip);
                    const after = document.createRange();
                    after.setStart(space, 1);
                    after.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(after);
                    visual.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                }
                // (inside [ … ] already: the key as text)
                document.execCommand('insertText', false, raw);
            },
        };
    }

    // already inside [ … ]: the key on its own joins that citation
    const inBrackets = at => /\[[^\]]*$/.test(at.before.slice(0, at.query === undefined ? undefined : at.before.length - at.query.length - 1));

    function list() {
        if (!box) {
            box = document.createElement('div');
            box.className = 'composer cite_picker'; // dressed like the floating panels in each style
            box.hidden = true;
            box.innerHTML = `<input class="cite_search" type="search" placeholder="Find a paper: title, author, year…" aria-label="Find a paper to cite" autocomplete="off">
                <div class="cite_rows" role="listbox" aria-label="Papers to cite"></div>
                <small class="cite_keys">Enter: (Author, year) · Shift + Enter: Author (year) · Esc: close</small>`;
            // a click picks (mousedown: before the text box loses focus)
            box.addEventListener('mousedown', e => {
                const btn = e.target.closest('[data-key]');
                if (!btn) return;
                e.preventDefault();
                pick(btn.dataset.key, btn.dataset.form === 'narrative');
            });
            const search = box.querySelector('.cite_search');
            search.addEventListener('input', () => { if (state) find(search.value.toLowerCase()); });
            search.addEventListener('keydown', e => keys(e));
            search.addEventListener('blur', () => setTimeout(() => {
                if (state?.browsing && !box.contains(document.activeElement)) close();
            }, 150));
            document.body.append(box);
        }
        return box;
    }

    function close() {
        state = null;
        if (box) box.hidden = true;
    }

    function find(query) {
        const all = state.sources();
        assignCitekeys(all);
        const words = query.split(/[\s:.\-]+/).filter(Boolean);
        state.matches = all
            .filter(s => {
                const text = [s.citekey, s.title, authorsLine(s), s.published].join(' ').toLowerCase();
                return words.every(w => text.includes(w));
            })
            .slice(0, state.browsing ? 30 : 7);
        state.active = Math.min(state.active, Math.max(0, state.matches.length - 1));
        draw();
    }

    // "@…" typed: the list under the box (or closed when nothing matches)
    function update(editor, sources) {
        if (state?.browsing) return;
        const at = editor.typed();
        if (!at) return close();
        state = { editor, at, sources, matches: [], active: state?.editor === editor ? state.active : 0, browsing: false };
        find(at.query);
        if (!state.matches.length) close();
    }

    // the Cite button: the list with its search box, for the cursor's place
    function browse(editor, sources) {
        list();
        state = { editor, at: editor.here(), sources, matches: [], active: 0, browsing: true };
        const search = box.querySelector('.cite_search');
        search.value = '';
        find('');
        search.focus();
    }

    const style = () => (typeof project !== 'undefined' && project?.citeStyle) || 'apa';

    function draw() {
        const el = list();
        el.classList.toggle('browsing', state.browsing);
        const rows = el.querySelector('.cite_rows');
        rows.replaceChildren(...(state.matches.length ? state.matches.map((s, i) => {
            const row = document.createElement('div');
            row.className = 'cite_pick' + (i === state.active ? ' active' : '');
            row.setAttribute('role', 'option');
            const main = document.createElement('div');
            main.className = 'cite_main';
            main.dataset.key = s.citekey;
            const title = document.createElement('strong');
            title.textContent = s.title;
            const meta = document.createElement('small');
            meta.textContent = [shortCitation(s), '@' + s.citekey].filter(Boolean).join(' · ');
            main.append(title, meta);
            // the two forms, as they'd read
            const forms = document.createElement('div');
            forms.className = 'cite_forms';
            for (const [form, text] of [['parenthetical', Cite.parenthetical([{ source: s }], style())], ['narrative', Cite.narrative({ source: s }, style())]]) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'cite_form';
                btn.dataset.key = s.citekey;
                btn.dataset.form = form;
                btn.textContent = text;
                btn.title = form === 'narrative' ? 'The authors in your sentence (Shift + Enter)' : 'In brackets (Enter)';
                forms.append(btn);
            }
            row.append(main, forms);
            return row;
        }) : [Object.assign(document.createElement('p'), { className: 'cite_none', textContent: 'No paper matches.' })]));
        // under the text box, kept on screen
        const r = state.editor.el.getBoundingClientRect();
        el.hidden = false;
        const width = Math.min(Math.max(r.width, 300), innerWidth - 16);
        el.style.width = width + 'px';
        el.style.left = Math.max(8, Math.min(r.left, innerWidth - width - 8)) + 'px';
        const below = r.bottom + 4;
        const height = el.offsetHeight;
        el.style.top = (below + height > innerHeight - 8 ? Math.max(8, r.top - height - 4) : below) + 'px';
        // the chosen one in sight, scrolling only the list
        const active = rows.querySelector('.active');
        if (active) {
            if (active.offsetTop < rows.scrollTop) rows.scrollTop = active.offsetTop;
            else if (active.offsetTop + active.offsetHeight > rows.scrollTop + rows.clientHeight) rows.scrollTop = active.offsetTop + active.offsetHeight - rows.clientHeight;
        }
    }

    function pick(key, narrative = false) {
        const { editor, at } = state;
        const raw = inBrackets(at) ? '@' + key : narrative ? '@' + key : `[@${key}]`;
        close();
        editor.put(at, raw);
    }

    // while the list is open: ↑ ↓ choose, Enter / Tab (Shift: Author (year)) put it in, Esc closes
    function keys(e) {
        if (!state || !box || box.hidden) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!state.matches.length) return;
            state.active = (state.active + (e.key === 'ArrowDown' ? 1 : -1) + state.matches.length) % state.matches.length;
            draw();
        } else if ((e.key === 'Enter' && !e.ctrlKey && !e.metaKey) || e.key === 'Tab') {
            if (!state.matches.length) return;
            e.preventDefault();
            e.stopPropagation();
            pick(state.matches[state.active].citekey, e.shiftKey);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            const editor = state.editor;
            close();
            editor.el.focus();
        }
    }

    function listen(editor, sources) {
        const { el } = editor;
        el.addEventListener('input', () => { if (!el.rbFromVisual) update(editor, sources); });
        el.addEventListener('click', () => update(editor, sources));
        el.addEventListener('blur', () => setTimeout(() => { if (state?.editor === editor && !state.browsing) close(); }, 150));
        el.addEventListener('keydown', e => { if (state?.editor === editor) keys(e); });
    }

    // a citation's finished text ("(Vaswani et al., 2017, p. 4)" / "Vaswani et al. (2017)"), or null for an unknown key:
    // what the Visual box shows its citations as (writing/mdbar.js)
    function citeText(raw, sources) {
        if (typeof Cite === 'undefined') return null;
        const all = sources();
        assignCitekeys(all);
        const byKey = new Map(all.filter(s => s.citekey).map(s => [s.citekey, s]));
        if (raw.startsWith('[')) {
            const items = raw.slice(2, -1).split(';').map(part => {
                const m = part.trim().match(/^@?([\w:.-]*\w)\s*,?\s*(.*)$/);
                const source = m && byKey.get(m[1]);
                return source && { source, locator: m[2] };
            });
            return items.length && items.every(Boolean) ? Cite.parenthetical(items, style()) : null;
        }
        const source = byKey.get(raw.slice(1));
        return source ? Cite.narrative({ source }, style()) : null;
    }

    function attach(area, sources) {
        const md = markdownEditor(area);
        listen(md, sources);
        let visual = null;
        if (area.rbVisual) {
            visual = visualEditor(area.rbVisual);
            area.rbVisual.rbArea = area;
            area.rbCiteText = raw => citeText(raw, sources);
            listen(visual, sources);
            area.rbShow?.(); // drawn again, its citations as chips
        }
        // the Cite button in the formatting bar: for whichever box shows
        area.rbCite = () => browse(visual && !area.rbVisual.hidden ? visual : md, sources);
        const bar = area.previousElementSibling?.classList.contains('md_bar') ? area.previousElementSibling : null;
        const btn = bar?.querySelector('[data-act="cite"]');
        if (btn) btn.hidden = false;
        const hint = 'Type @ or use Cite to cite a paper.';
        if (!area.placeholder.includes('@')) area.placeholder = area.placeholder ? area.placeholder.replace(/\.?$/, '. ' + hint) : hint;
    }

    addEventListener('resize', close);
    // the page scrolled: the list follows its box (not when the list itself scrolls)
    addEventListener('scroll', e => { if (state && box && !box.hidden && !box.contains(e.target)) draw(); }, true);
    document.addEventListener('pointerdown', e => {
        if (state?.browsing && !box.contains(e.target) && !e.target.closest('[data-act="cite"]')) close();
    });
    return { attach };
})();

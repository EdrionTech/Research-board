// Referencing papers in any note: typing "@" and a few letters of a title, author or citation key lists the
// project's papers under the text box; Enter / Tab or a click puts in [@key] (just @key inside [ … ]).
// The same citations as the literature review, so notes, summaries and the review all link papers alike
// (shown as links by PaperLinks.withLinks).
// Works in both ways of writing (writing/mdbar.js): the Markdown text box, and Visual, the formatted text.
//   CitePicker.attach(textarea, () => sources)     (after MdBar.attach, so the Visual box exists)

const CitePicker = (() => {
    let box = null;      // one list for the page, under whichever box is being typed in
    let state = null;    // { editor, start, matches, active }

    // An editor: where "@…" was typed and how to put the citation in, for each way of writing.
    //   el: what's typed in   typed(): { start, query } | null   put(start, text)
    function markdownEditor(area) {
        return {
            el: area,
            typed() {
                const before = area.value.slice(0, area.selectionStart);
                const m = before.match(/(^|[\s(\[;])@([\w:.\-]*)$/);
                return m && area.selectionStart === area.selectionEnd ? { start: before.length - m[2].length - 1, query: m[2].toLowerCase(), before } : null;
            },
            put(start, text) {
                area.focus();
                area.setRangeText(text, start, area.selectionStart, 'end');
                area.dispatchEvent(new Event('input', { bubbles: true }));
            },
        };
    }

    // in Visual: the words before the cursor in the text it's in
    function visualEditor(visual) {
        const here = () => {
            const sel = getSelection();
            if (!sel.rangeCount || !sel.isCollapsed || sel.anchorNode?.nodeType !== Node.TEXT_NODE || !visual.contains(sel.anchorNode)) return null;
            return { node: sel.anchorNode, offset: sel.anchorOffset };
        };
        return {
            el: visual,
            typed() {
                const at = here();
                if (!at) return null;
                const before = at.node.data.slice(0, at.offset).replace(/ /g, ' ');
                const m = before.match(/(^|[\s(\[;])@([\w:.\-]*)$/);
                return m ? { start: before.length - m[2].length - 1, query: m[2].toLowerCase(), before, node: at.node, end: at.offset } : null;
            },
            put(start, text) {
                const at = state.at;
                visual.focus();
                const range = document.createRange();
                range.setStart(at.node, start);
                range.setEnd(at.node, Math.min(at.end, at.node.data.length));
                const sel = getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                const area = visual.rbArea;
                // a whole citation: a chip ("(Vaswani et al., 2017)"), then a space to carry on typing
                if (text.startsWith('[') && area?.rbMakeChip) {
                    range.deleteContents();
                    const chip = area.rbMakeChip(text);
                    const space = document.createTextNode('\u00a0');
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
                document.execCommand('insertText', false, text);
            },
        };
    }

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

    function update(editor, sources) {
        const at = editor.typed();
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
        state = { editor, at, start: at.start, matches, active: Math.min(state?.editor === editor ? state.active : 0, matches.length - 1) };
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
        const r = state.editor.el.getBoundingClientRect();
        el.hidden = false;
        const width = Math.min(Math.max(r.width, 260), innerWidth - 16);
        el.style.width = width + 'px';
        el.style.left = Math.max(8, Math.min(r.left, innerWidth - width - 8)) + 'px';
        const below = r.bottom + 4;
        const height = el.offsetHeight;
        el.style.top = (below + height > innerHeight - 8 ? Math.max(8, r.top - height - 4) : below) + 'px';
    }

    function pick(key) {
        const { editor, start, at } = state;
        const inBrackets = /\[[^\]]*$/.test(at.before.slice(0, start)); // already inside [ … ]
        close();
        state = { at }; // (put() in Visual needs where it was typed)
        editor.put(start, inBrackets ? '@' + key : `[@${key}]`);
        state = null;
    }

    function listen(editor, sources) {
        const { el } = editor;
        el.addEventListener('input', () => { if (!el.rbFromVisual) update(editor, sources); });
        el.addEventListener('click', () => update(editor, sources));
        el.addEventListener('blur', () => setTimeout(() => { if (state?.editor === editor) close(); }, 150));
        // while the list is open: ↑ ↓ choose, Enter / Tab put it in, Esc closes (and nothing else)
        el.addEventListener('keydown', e => {
            if (!state || state.editor !== editor || box.hidden) return;
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
    }

    // a citation's finished text ("(Vaswani et al., 2017, p. 4)" / "Vaswani et al. (2017)"), or null for an unknown key:
    // what the Visual box shows its citations as (writing/mdbar.js)
    function citeText(raw, sources) {
        if (typeof Cite === 'undefined') return null;
        const style = (typeof project !== 'undefined' && project?.citeStyle) || 'apa';
        const all = sources();
        assignCitekeys(all);
        const byKey = new Map(all.filter(s => s.citekey).map(s => [s.citekey, s]));
        if (raw.startsWith('[')) {
            const items = raw.slice(2, -1).split(';').map(part => {
                const m = part.trim().match(/^@?([\w:.-]*\w)\s*,?\s*(.*)$/);
                const source = m && byKey.get(m[1]);
                return source && { source, locator: m[2] };
            });
            return items.length && items.every(Boolean) ? Cite.parenthetical(items, style) : null;
        }
        const source = byKey.get(raw.slice(1));
        return source ? Cite.narrative({ source }, style) : null;
    }

    function attach(area, sources) {
        listen(markdownEditor(area), sources);
        if (area.rbVisual) {
            area.rbVisual.rbArea = area;
            area.rbCiteText = raw => citeText(raw, sources);
            listen(visualEditor(area.rbVisual), sources);
            area.rbShow?.(); // drawn again, its citations as chips
        }
        const hint = 'Type @ to cite a paper.';
        if (!area.placeholder.includes('@')) area.placeholder = area.placeholder ? area.placeholder.replace(/\.?$/, '. ' + hint) : hint;
    }

    addEventListener('resize', close);
    addEventListener('scroll', () => { if (state?.editor) draw(); }, true);
    return { attach };
})();

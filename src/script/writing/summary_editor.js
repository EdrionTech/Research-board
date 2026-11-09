// A material's Summary, shown and edited in sections (sources/passes.js: parseSummary, setSection): each section
// under its heading with its own Edit, your words before the first heading, "+ Section" for one of your own, and
// (where the page has no Edit all of its own) the whole document as Markdown. Used by the notes side of a
// material's page (material_summary.js) and the Summaries box on the Literature tab (a popup: dashboard.js).
//   const editor = SummaryEditor.create(box, { get: () => markdown, save: markdown => …, linkify, editAll })
//   editor.render()    draw it again (after the Summary changed elsewhere)

const SummaryEditor = (() => {
    const ALL = '\u0000all'; // (editing the whole document)

    const button = (cls, label, data = {}, title = '') => {
        const b = el('button', cls, label);
        b.type = 'button';
        Object.assign(b.dataset, data);
        if (title) b.title = title;
        return b;
    };

    function create(box, { get, save, linkify = text => text, editAll = false, empty = 'Nothing written yet.' }) {
        let editing = null; // a section's title, '' for your words at the top, ALL for the whole document

        function render() {
            const markdown = get() || '';
            if (editing === ALL) {
                box.replaceChildren(editor('', markdown, 'The whole summary (Markdown: each “### ” heading starts a section)'));
                return;
            }
            const doc = Passes.parseSummary(markdown);
            const parts = [];
            if (doc.intro.trim() || editing === '') parts.push(block('', doc.intro));
            for (const s of doc.sections) parts.push(block(s.title, s.text));
            if (!parts.length) renderMarkdown(box, '', empty);
            else box.replaceChildren(...parts);
            const tools = el('div', 'sum_tools');
            tools.append(button('link sum_add', '+ Section', { add: '' }, 'Add a section of your own (Quotes, Methods used, …)'));
            if (editAll) tools.append(button('link', 'Edit all', { all: '' }, 'Edit the whole summary at once'));
            box.append(tools);
        }

        function editor(title, text, label) {
            const sec = el('section', 'sum_sec editing');
            sec.dataset.title = title;
            const area = el('textarea');
            area.rows = Math.min(editing === ALL ? 18 : 12, Math.max(3, text.split('\n').length + 1));
            area.value = text;
            area.setAttribute('aria-label', label);
            const row = el('div', 'actions');
            row.append(el('small', 'hint', 'Ctrl + Enter to save'), el('span', 'spacer'), button('btn small', 'Cancel', { cancel: '' }), button('btn small primary', 'Save', { save: '' }));
            sec.append(area, row);
            requestAnimationFrame(() => area.focus());
            return sec;
        }

        function block(title, text) {
            if (editing === title) {
                const sec = editor(title, text, title || 'Your words at the top of the summary');
                if (title) {
                    const head = el('header', 'sum_head');
                    head.append(el('h4', '', title));
                    sec.prepend(head);
                }
                return sec;
            }
            const sec = el('section', 'sum_sec');
            sec.dataset.title = title;
            const head = el('header', 'sum_head');
            if (title) head.append(el('h4', '', title));
            head.append(button('link sum_edit', 'Edit', { edit: title }, title ? `Edit “${title}”` : 'Edit your words at the top'));
            const body = el('div', 'md');
            renderMarkdown(body, linkify(text));
            sec.append(head, body);
            return sec;
        }

        function commit(title, text) {
            const markdown = get() || '';
            let next;
            if (editing === ALL) next = text.trim();
            else if (title) next = Passes.setSection(markdown, title, text);
            else next = Passes.writeSummary({ ...Passes.parseSummary(markdown), intro: text });
            editing = null;
            save(next);
            render();
        }

        box.addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b || e.target.closest('a')) return;
            const sec = b.closest('.sum_sec');
            if (b.dataset.edit !== undefined) { editing = b.dataset.edit; return render(); }
            if (b.dataset.all !== undefined) { editing = ALL; return render(); }
            if (b.dataset.cancel !== undefined) { editing = null; return render(); }
            if (b.dataset.save !== undefined) return commit(sec.dataset.title, $('textarea', sec).value);
            if (b.dataset.add !== undefined) {
                const title = prompt('Name of the new section (e.g. Quotes, Methods used):')?.trim();
                if (!title) return;
                if (!Passes.parseSummary(get() || '').sections.some(s => s.title.toLowerCase() === title.toLowerCase())) save(Passes.setSection(get() || '', title, '…'));
                editing = title;
                render();
            }
        });
        // Ctrl + Enter saves, Esc leaves it as it was
        box.addEventListener('keydown', e => {
            const sec = e.target.closest('.sum_sec');
            if (!sec || e.target.tagName !== 'TEXTAREA') return;
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit(sec.dataset.title, e.target.value); }
            if (e.key === 'Escape') { e.stopPropagation(); editing = null; render(); }
        });

        return { render, busy: () => editing !== null };
    }

    return { create };
})();

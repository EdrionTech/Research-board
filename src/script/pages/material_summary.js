// Material page: the Summary in the notes side, one document in sections (sources/passes.js: parseSummary,
// setSection). Each section shows under its heading with its own Edit; "Edit all" edits the whole document as
// Markdown; "+ Section" adds one of your own. The passes write into the same sections (material_passes.js), so
// whatever you change here shows in every pass, and the other way round.
// Uses material.js (source, citeSources, project, fieldValue, refresh); loaded before it.

const SummaryPanel = (() => {
    const linked = text => PaperLinks.withLinks(text, citeSources, project.citeStyle || 'apa');
    let editing = null; // the title of the section being edited ('' for your words before the first heading)

    const button = (cls, label, data = {}, title = '') => {
        const b = el('button', cls, label);
        b.type = 'button';
        Object.assign(b.dataset, data);
        if (title) b.title = title;
        return b;
    };

    function render(box) {
        const markdown = fieldValue('summary');
        const doc = Passes.parseSummary(markdown);
        const parts = [];
        if (doc.intro.trim() || editing === '') parts.push(block('', doc.intro));
        for (const s of doc.sections) parts.push(block(s.title, s.text));
        if (!parts.length) {
            renderMarkdown(box, '', 'Nothing written yet. Reading in passes fills it in section by section, or write your own.');
        } else box.replaceChildren(...parts);
        box.append(button('link sum_add', '+ Section', { add: '' }, 'Add a section of your own (Quotes, Methods used, …)'));
    }

    function block(title, text) {
        const sec = el('section', 'sum_sec');
        sec.dataset.title = title;
        const head = el('header', 'sum_head');
        if (title) head.append(el('h4', '', title));
        if (editing !== title) head.append(button('link sum_edit', 'Edit', { edit: title }, title ? `Edit “${title}”` : 'Edit your words at the top'));
        sec.append(head);
        if (editing === title) {
            const area = el('textarea');
            area.rows = Math.min(12, Math.max(3, text.split('\n').length + 1));
            area.value = text;
            area.setAttribute('aria-label', title || 'Your words at the top of the summary');
            const row = el('div', 'actions');
            row.append(el('span', 'spacer'), button('btn small', 'Cancel', { cancel: '' }), button('btn small primary', 'Save', { save: '' }));
            sec.append(area, row);
            requestAnimationFrame(() => area.focus());
        } else {
            const body = el('div', 'md');
            renderMarkdown(body, linked(text), title ? '' : '');
            sec.append(body);
        }
        return sec;
    }

    function save(title, text) {
        const markdown = fieldValue('summary');
        let next;
        if (title) next = Passes.setSection(markdown, title, text);
        else next = Passes.writeSummary({ ...Passes.parseSummary(markdown), intro: text });
        editing = null;
        Store.saveItem({ id: source.id, summary: next });
        refresh();
    }

    function setup() {
        const field = $('.md_field[data-field="summary"]');
        $('.md', field).addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b || e.target.closest('a')) return;
            const sec = b.closest('.sum_sec');
            if (b.dataset.edit !== undefined) { editing = b.dataset.edit; render($('.md', field)); return; }
            if (b.dataset.cancel !== undefined) { editing = null; render($('.md', field)); return; }
            if (b.dataset.save !== undefined) return save(sec.dataset.title, $('textarea', sec).value);
            if (b.dataset.add !== undefined) {
                const title = prompt('Name of the new section (e.g. Quotes, Methods used):')?.trim();
                if (!title) return;
                if (Passes.parseSummary(fieldValue('summary')).sections.some(s => s.title.toLowerCase() === title.toLowerCase())) { editing = title; render($('.md', field)); return; }
                Store.saveItem({ id: source.id, summary: Passes.setSection(fieldValue('summary'), title, '…') });
                editing = title;
                refresh();
            }
        });
        // Ctrl + Enter saves a section, Esc leaves it
        $('.md', field).addEventListener('keydown', e => {
            const sec = e.target.closest('.sum_sec');
            if (!sec || e.target.tagName !== 'TEXTAREA') return;
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(sec.dataset.title, e.target.value); }
            if (e.key === 'Escape') { e.stopPropagation(); editing = null; render($('.md', field)); }
        });
    }

    return { setup, render };
})();

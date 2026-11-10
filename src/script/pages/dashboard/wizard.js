// Literature tab: "Write the review from your reading", a wizard in three steps (writing/review_plan.js):
//   1 What kind of review, what it answers, which papers (to start with: every paper with a summary or a pass)
//   2 Its structure: themes (suggested by shared citations, your tags or Category, or none: you make them) and
//     which papers go where; for a paper-by-paper review, their order
//   3 The skeleton to check, and where it goes: into the literature review (filled if empty, added at the end if
//     not) or as a new draft in Writing; then it opens in the editor
// Opened from the literature review card and from the survey board. Uses dashboard.js (items, project) and
// literature.js (sourceItems).

const ReviewWizard = (() => {
    let state = null;
    const BASES = [['citations', 'Shared citations'], ['tags', 'Your tags'], ['category', 'Category'], ['empty', 'Start empty']];

    const button = (cls, label, data = {}, title = '') => {
        const b = el('button', cls, label);
        b.type = 'button';
        Object.assign(b.dataset, data);
        if (title) b.title = title;
        return b;
    };
    const sources = () => {
        const all = sourceItems();
        assignCitekeys(all);
        return all;
    };
    const recordOf = id => items.find(i => i.type === 'passes' && i.sourceId === id);
    const chosen = () => sources().filter(s => state.selected.has(s.id));
    const review = () => items.find(i => i.type === 'lit_review');
    const reviewEmpty = () => !(review()?.body || '').replace(/^#.*$/gm, '').trim();

    function open() {
        const all = sources();
        const read = all.filter(s => summaryOf(s).trim() || recordOf(s.id));
        state = {
            step: 1, kind: 'theme', title: 'Literature review', question: '', basis: 'citations', order: 'year',
            selected: new Set((read.length ? read : all).map(s => s.id)), themes: null,
            dest: reviewEmpty() ? 'review' : 'draft',
        };
        render();
        openModal($('#wizard_modal'));
    }

    // ---- drawing ----

    function render() {
        for (const b of $$('#wizard_steps button')) {
            b.setAttribute('aria-checked', Number(b.dataset.step) === state.step);
        }
        const body = state.step === 1 ? stepOne() : state.step === 2 ? stepTwo() : stepThree();
        $('#wizard_body').replaceChildren(...body);
        $('#wizard_back').hidden = state.step === 1;
        $('#wizard_next').textContent = state.step === 3 ? 'Create and open' : 'Next';
        $('#wizard_next').disabled = !state.selected.size;
    }

    function stepOne() {
        const kinds = el('div', 'wizard_kinds');
        for (const [value, title, text] of [
            ['theme', 'By theme', 'The usual literature review, or a related-work section: the papers grouped by theme, then the gaps they leave.'],
            ['paper', 'Paper by paper', 'A review of each paper in turn (what it is, its argument, its weak spots), then how they compare.'],
        ]) {
            const b = button('btn wizard_kind' + (state.kind === value ? ' primary' : ''), '', { kind: value });
            b.setAttribute('aria-pressed', state.kind === value);
            b.append(el('strong', '', title), el('small', '', text));
            kinds.append(b);
        }
        const title = el('label', 'wizard_field');
        const titleInput = el('input');
        titleInput.dataset.field = 'title';
        titleInput.value = state.title;
        title.append(el('strong', '', 'Title'), titleInput);
        const question = el('label', 'wizard_field');
        const q = el('textarea');
        q.rows = 2;
        q.dataset.field = 'question';
        q.value = state.question;
        q.placeholder = 'e.g. How do readers decide which papers deserve a close reading?';
        question.append(el('strong', '', 'What it answers'), el('small', 'hint', 'Your question or aim: it opens the introduction.'), q);

        const all = sources();
        const list = el('ul', 'wizard_papers');
        for (const s of all) {
            const li = el('li');
            const box = el('label', 'check');
            const input = el('input');
            input.type = 'checkbox';
            input.dataset.paper = s.id;
            input.checked = state.selected.has(s.id);
            const parts = Passes.parseSummary(summaryOf(s)).sections.filter(x => x.text.trim()).length;
            box.append(input, ' ', el('span', '', s.title), el('small', 'hint', [shortCitation(s), Passes.label(recordOf(s.id)), parts ? `${parts} section${parts === 1 ? '' : 's'} written` : 'no summary yet'].filter(Boolean).join(' · ')));
            li.append(box);
            list.append(li);
        }
        const papers = el('div', 'wizard_field');
        const head = el('div', 'wizard_papers_head');
        head.append(el('strong', '', `Papers (${state.selected.size} of ${all.length})`), button('link', 'All', { all: '1' }), button('link', 'None', { all: '' }));
        papers.append(head, list);
        return [kinds, title, question, papers];
    }

    function stepTwo() {
        if (state.kind === 'paper') {
            const order = el('div', 'segmented');
            order.setAttribute('role', 'radiogroup');
            for (const [value, label] of [['year', 'By year'], ['author', 'By author'], ['title', 'By title']]) {
                const b = button('', label, { order: value });
                b.setAttribute('role', 'radio');
                b.setAttribute('aria-checked', state.order === value);
                order.append(b);
            }
            const list = el('ol', 'wizard_order');
            list.append(...ordered().map(s => el('li', '', `${shortCitation(s) || ''}: ${s.title}`)));
            return [el('p', 'hint', 'Each paper gets its own section, in this order.'), order, list];
        }
        state.themes ??= ReviewPlan.suggest(chosen(), state.basis);
        const basis = el('div', 'segmented');
        basis.setAttribute('role', 'radiogroup');
        basis.setAttribute('aria-label', 'Suggest themes by');
        for (const [value, label] of BASES) {
            const b = button('', label, { basis: value });
            b.setAttribute('role', 'radio');
            b.setAttribute('aria-checked', state.basis === value);
            basis.append(b);
        }
        const names = state.themes.map((t, i) => [i, t.unsorted ? ReviewPlan.UNSORTED : t.name || `Theme ${i + 1}`]);
        const byId = new Map(chosen().map(s => [s.id, s]));
        const boxes = state.themes.map((theme, i) => {
            const box = el('section', 'wizard_theme' + (theme.unsorted ? ' unsorted' : ''));
            if (theme.unsorted) box.append(el('strong', '', `${ReviewPlan.UNSORTED} (${theme.ids.length})`));
            else {
                const name = el('input', 'wizard_theme_name');
                name.value = theme.name;
                name.dataset.theme = i;
                name.setAttribute('aria-label', 'Theme name');
                const row = el('div', 'wizard_theme_head');
                row.append(name, button('link', 'Remove', { remove: i }, 'Remove the theme (its papers go to “not in a theme yet”)'));
                box.append(row);
            }
            const list = el('ul', 'wizard_theme_papers');
            for (const id of theme.ids) {
                const s = byId.get(id);
                if (!s) continue;
                const li = el('li');
                const move = el('select');
                move.dataset.move = id;
                move.setAttribute('aria-label', 'Move to');
                move.append(...names.map(([j, label]) => new Option(j === i ? 'Here' : '→ ' + label, j)));
                move.value = i;
                li.append(el('span', '', `${shortCitation(s) || ''}: ${s.title}`), move);
                list.append(li);
            }
            if (!theme.ids.length) list.append(el('li', 'hint', theme.unsorted ? 'Every paper is in a theme.' : 'No papers yet: move some here.'));
            box.append(list);
            return box;
        });
        return [
            el('p', 'hint', 'Suggest themes by what the papers have in common, then rename them and move papers between them.'),
            basis, ...boxes, button('btn small', '+ Theme', { add: '' }),
        ];
    }

    function stepThree() {
        const md = markdown();
        const preview = el('div', 'md wizard_preview');
        renderMarkdown(preview, PaperLinks.withLinks(md, sources(), project.citeStyle || 'apa'));
        const dest = el('div', 'wizard_dest');
        const has = !reviewEmpty();
        for (const [value, title, text] of [
            ['review', 'Into the literature review', has ? 'Added at the end of what you have written.' : 'It becomes your review (it’s empty).'],
            ['draft', 'As a new draft', `A new document in Writing, “${state.title || 'Literature review'}”: your review stays as it is.`],
        ]) {
            const b = button('btn wizard_kind' + (state.dest === value ? ' primary' : ''), '', { dest: value });
            b.setAttribute('aria-pressed', state.dest === value);
            b.append(el('strong', '', title), el('small', '', text));
            dest.append(b);
        }
        return [el('p', 'hint', 'The skeleton, from what you wrote in each paper’s summary. Points marked “not written yet” are where a paper’s summary is still empty.'), preview, el('strong', '', 'Where it goes'), dest];
    }

    const yearOf = s => (s.published || '').slice(0, 4) || '9999';
    function ordered() {
        const list = chosen();
        if (state.order === 'author') return list.sort((a, b) => (shortCitation(a) || '').localeCompare(shortCitation(b) || ''));
        if (state.order === 'title') return list.sort((a, b) => a.title.localeCompare(b.title));
        return list.sort((a, b) => yearOf(a).localeCompare(yearOf(b)) || (shortCitation(a) || '').localeCompare(shortCitation(b) || ''));
    }

    function markdown() {
        return ReviewPlan.markdown({
            kind: state.kind, title: state.title, question: state.question,
            themes: state.themes || ReviewPlan.suggest(chosen(), state.basis), sources: state.kind === 'paper' ? ordered() : chosen(),
            seeds: project.surveySeeds || [],
        });
    }

    // ---- doing ----

    function create() {
        const md = markdown();
        let id;
        if (state.dest === 'review') {
            const doc = review();
            const body = reviewEmpty() ? md : `${doc.body.trimEnd()}\n\n${md.replace(/^# .*\n+/, '')}`;
            id = Store.saveItem({ id: doc?.id, projectId: project.id, type: 'lit_review', title: 'Literature review', body });
            closeModals();
            location.href = 'review.html?id=' + encodeURIComponent(project.id);
        } else {
            id = Store.saveItem({ projectId: project.id, type: 'draft', title: state.title || 'Literature review', body: md });
            closeModals();
            location.href = 'review.html?id=' + encodeURIComponent(project.id) + '&doc=' + encodeURIComponent(id);
        }
    }

    function setup() {
        const modal = $('#wizard_modal');
        modal.addEventListener('submit', e => {
            e.preventDefault();
            if (state.step < 3) { state.step++; render(); } else create();
        });
        $('#wizard_back').addEventListener('click', () => { state.step--; render(); });
        $('#wizard_steps').addEventListener('click', e => {
            const b = e.target.closest('[data-step]');
            if (b && state.selected.size) { state.step = Number(b.dataset.step); render(); }
        });
        modal.addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b || !$('#wizard_body').contains(b)) return;
            if (b.dataset.kind) { state.kind = b.dataset.kind; render(); }
            else if (b.dataset.dest) { state.dest = b.dataset.dest; render(); }
            else if (b.dataset.order) { state.order = b.dataset.order; render(); }
            else if (b.dataset.basis) { state.basis = b.dataset.basis; state.themes = ReviewPlan.suggest(chosen(), state.basis); render(); }
            else if (b.dataset.all !== undefined) { state.selected = new Set(b.dataset.all ? sources().map(s => s.id) : []); state.themes = null; render(); }
            else if (b.dataset.add !== undefined) { state.themes.splice(state.themes.length - 1, 0, { name: `Theme ${state.themes.length}`, ids: [] }); render(); }
            else if (b.dataset.remove !== undefined) {
                const [gone] = state.themes.splice(Number(b.dataset.remove), 1);
                state.themes.at(-1).ids.push(...gone.ids);
                render();
            }
        });
        modal.addEventListener('change', e => {
            const t = e.target;
            if (t.dataset.paper) {
                if (t.checked) state.selected.add(t.dataset.paper); else state.selected.delete(t.dataset.paper);
                state.themes = null; // (suggested again for the papers chosen)
                render();
            } else if (t.dataset.move) {
                for (const theme of state.themes) theme.ids = theme.ids.filter(id => id !== t.dataset.move);
                state.themes[Number(t.value)].ids.push(t.dataset.move);
                render();
            }
        });
        modal.addEventListener('input', e => {
            const t = e.target;
            if (t.dataset.field) state[t.dataset.field] = t.value;
            if (t.dataset.theme) state.themes[Number(t.dataset.theme)].name = t.value;
        });
        for (const b of $$('[data-open-wizard]')) b.addEventListener('click', open);
    }

    return { setup, open };
})();

ReviewWizard.setup();

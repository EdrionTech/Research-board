// Material page: reading in passes (sources/passes.js has the method and the record). "Passes" in the reader bar
// turns it on for this material; a bar under the reader's shows the three passes, a gentle timer and the way to
// the pass's form, which sits at the end of the reader.
//   Pass 1: sections other than the opening and closing fold to their headings (a click opens one: a peek).
//           In the printed pages of a PDF the pages to skip are dimmed instead.
//   Pass 2: everything but appendices and proofs. The form lists the figures to check, the references to follow up.
//   Pass 3: the main sections are blurred behind a card: write what you expect, reveal, note how theirs differs.
// Sections come from the Contents (material_toc.js); you can change a section's role there, or mark a heading
// it missed (right-click → Mark as a section heading). Controls placed in the paper carry data-rb-ui, so they're
// never counted in its text (textrange.js) and clicks on them don't reach the note tools.
// Uses material.js (source, project, currentView, readMode, notes, pdfPageLines, paperDoc, setReadMode, toast,
// refresh…); loaded before it, so nothing here runs until material.js calls PassMode.setup.

const PassMode = (() => {
    let record = null;
    const peeked = new Set(); // sections opened by a click in this pass (kept on the pass too, as peeks)
    let sections = [];

    const on = () => !!record?.on;
    const pass = () => record?.pass || 1;
    const passData = (n = pass()) => record?.passes?.[n] || {};
    const reflow = () => (currentView === 'pdf' ? (readMode ? 'read' : 'pages') : currentView);
    // a seed paper of the project's literature survey (sources/survey.js)
    const isSeed = () => (project.surveySeeds || []).includes(source.id);
    // shown in this pass: the pass's own sections, and for a seed paper in pass 1 its background and related
    // work too (Keshav: read the seed papers' related-work sections)
    const shownNow = s => Passes.shown(s.role, pass()) || (pass() === 1 && isSeed() && s.role === 'context');

    // ---- turning it on and off ----

    function setup() {
        record = Passes.of(source);
        if (record) record = Passes.moveIntoSource(record); // (older records kept reference ticks themselves)
        const before = JSON.stringify(Store.getItem(source.id));
        source = Passes.intoSummary(Store.getItem(source.id), record); // (and the five Cs, the close-out… beside the Summary)
        if (JSON.stringify(source) !== before) refresh();
        Toc.hook({ extra: marksFor, decorate, changed: () => apply() });
        $('#passes_btn').onclick = () => (on() ? leave() : enter());
        $('#pass_bar').addEventListener('click', onBarClick);
        $('#pass_form').addEventListener('click', onFormClick);
        $('#pass_form').addEventListener('input', onFormInput);
        $('#pass_form').addEventListener('change', onFormInput);
        watchDoc(document);
        new ResizeObserver(() => document.documentElement.style.setProperty('--reader-bar-h', $('.reader_bar').offsetHeight + 'px'))
            .observe($('.reader_bar'));
        addEventListener('storage', e => { if (e.key === 'research_board_items') reread(); });
        timer.setup();
        render();
    }

    // another tab, or a sync, changed it
    function reread() {
        const now = Passes.of(source);
        if (JSON.stringify(now) === JSON.stringify(record)) return;
        record = now;
        render();
    }

    async function enter() {
        record = Passes.of(source) ? Passes.save(Passes.of(source), { on: true }) : Passes.start(source);
        refresh(); // (its status follows the passes: Reading)
        // sections fold in read mode; the printed pages can only be dimmed
        if (currentView === 'pdf' && !readMode) await setReadMode(true);
        render();
        toast(`Reading in passes: pass ${pass()}, ${Passes.PASSES[pass()].name.toLowerCase()}.`);
    }

    function leave() {
        timer.flush();
        record = Passes.save(record, { on: false });
        render();
    }

    function render() {
        $('#passes_btn').setAttribute('aria-pressed', on());
        $('#pass_bar').hidden = !on();
        $('#pass_form').hidden = !on();
        peeked.clear();
        for (const key of passData().peeks || []) peeked.add(key);
        if (on()) {
            renderBar();
            renderForm();
        }
        Toc.show(currentView); // the role on each row, your marked headings; then apply()
        timer.restart();
    }

    // ---- the bar: the passes as steps, the timer, the way to the notes ----

    function renderBar() {
        const steps = [1, 2, 3].map(n => {
            const data = passData(n);
            const state = n === pass() ? 'current' : data.doneAt ? 'done' : data.skipped ? 'skipped' : '';
            const btn = el('button', 'pass_step');
            btn.append(el('span', 'pass_mark', state === 'done' ? '✓' : state === 'skipped' ? '↷' : String(n)), ' ', el('span', 'pass_name', Passes.PASSES[n].short));
            btn.type = 'button';
            btn.dataset.pass = n;
            if (state) btn.dataset.state = state;
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', n === pass());
            btn.title = `Pass ${n}: ${Passes.PASSES[n].name}` + (state === 'done' ? ' (done)' : state === 'skipped' ? ' (skipped)' : '')
                + (n > pass() ? '. Skip to it' : n < pass() ? '. Read it again' : '');
            return btn;
        });
        $('#pass_steps').replaceChildren(...steps);
        $('#pass_state').textContent = record.state !== 'reading' ? Passes.label(record) : '';
        renderHint();
        timer.show();
    }

    // a line under the bar only when this view needs saying something (what a pass is for is in its notes)
    function renderHint() {
        const view = reflow();
        let hint = '';
        if (view === 'video') hint = 'Reading in passes is for papers: a video has no sections to fold.';
        else if (view === 'pages') hint = pass() === 3
            ? 'Printed pages can’t hide anything: switch to Read (View) to predict each section before reading it.'
            : 'Printed pages: the ones you can skip are dimmed. Read (View) folds the sections instead.';
        else if (view && !sections.length) hint = 'No sections found. Right-click a heading → Mark as a section heading.';
        $('#pass_hint').textContent = hint;
        $('#pass_hint').hidden = !hint;
    }

    async function onBarClick(e) {
        const step = e.target.closest('.pass_step');
        if (step) return goTo(Number(step.dataset.pass));
        if (e.target.closest('#pass_form_btn, #pass_timer')) return $('#pass_form').scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (e.target.closest('#pass_leave')) return leave();
    }

    // to another pass: later ones skip what's between (recorded), earlier ones are a re-read
    function goTo(n) {
        if (n === pass() && record.state === 'reading') return;
        timer.flush();
        record = n > pass() ? Passes.moveTo(record, n) : Passes.save(record, { pass: n, state: 'reading' });
        if (!record.passes?.[n]?.startedAt) record = Passes.savePass(record, n, { startedAt: Date.now() });
        render();
    }

    // ---- what each pass shows in the paper ----

    function apply() {
        if (!record) return;
        const view = reflow();
        const html = view === 'html' ? paperDoc() : null;
        clear(html);
        if (!on() || !view || view === 'video') { sections = []; if (on()) renderHint(); return; }
        sections = Passes.sections(Toc.entries(currentView), record.roles || {});
        renderHint();
        if (!sections.length) return;
        if (view === 'pages') return dimPages();
        if (html) frameCss(html);
        const units = view === 'html' ? htmlUnits(html) : view === 'read' ? readUnits() : textUnits();
        const n = pass();
        sections.forEach((s, i) => {
            const unit = units[i];
            if (!unit || shownNow(s)) return;
            if (peeked.has(s.key)) return markOpen(unit, s);
            fold(unit, s, view);
        });
        if (n === 2) foldProofs(view, html);
        if (n === 3) blurCore(units, view);
    }

    // what earlier passes left in the paper, gone
    function clear(html) {
        for (const doc of [document, html].filter(Boolean)) {
            for (const node of doc.querySelectorAll('[data-rb-ui].pass_ui')) node.remove();
            for (const node of doc.querySelectorAll('.pass_folded, .pass_blur, .pass_head, .pass_dim')) {
                node.classList.remove('pass_folded', 'pass_blur', 'pass_head', 'pass_dim');
            }
        }
    }

    // a section as elements: its heading, and what's under it up to the next heading (subsections are their own)
    function textUnits() {
        const lines = $$('#reader_text .line');
        return sections.map((s, i) => {
            const from = s.place.line;
            const to = sections[i + 1]?.place.line ?? Infinity;
            return { head: lines[from - 1], body: lines.slice(from, Math.max(from, to - 1)) };
        });
    }

    // read mode: the paragraph that starts each section, from its page and height (Contents' place)
    function readUnits() {
        const blocks = $$('#reader_read .read_para').map(node => {
            const [first, last = first] = node.dataset.lines.split('-').map(Number);
            return { node, page: Number(node.dataset.page), first, last };
        });
        const starts = sections.map(s => {
            const lines = pdfPageLines[s.place.page - 1] || [];
            const at = lines.findIndex(l => l.box.y >= (s.place.y || 0) - 0.005);
            const line = at < 0 ? Infinity : at + 1;
            const i = blocks.findIndex(b => b.page > s.place.page || (b.page === s.place.page && b.last >= line));
            return i < 0 ? blocks.length : i;
        });
        for (let i = 1; i < starts.length; i++) starts[i] = Math.max(starts[i], starts[i - 1]); // in order
        return sections.map((s, i) => {
            const from = starts[i];
            const to = i + 1 < starts.length ? starts[i + 1] : blocks.length;
            if (from >= blocks.length) return null;
            return { head: blocks[from].node, body: blocks.slice(from + 1, Math.max(from + 1, to)).map(b => b.node) };
        });
    }

    // arXiv HTML: a section's own children, but not its subsections (each has its own entry: material_toc.js)
    const SECTION_TAGS = 'section.ltx_section, section.ltx_subsection, section.ltx_subsubsection, section.ltx_appendix, section.ltx_bibliography';
    function htmlUnits(doc) {
        return sections.map(s => {
            const box = s.place.anchor && doc?.getElementById(s.place.anchor);
            if (!box) return null;
            const head = box.querySelector(':scope > .ltx_title, :scope > h6');
            const body = [...box.children].filter(c => c !== head && !c.matches(SECTION_TAGS));
            return { head: head || box, body };
        });
    }

    // a control in the paper, made in the paper's own document
    function ui(doc, tag, className, text) {
        const node = doc.createElement(tag);
        node.className = 'pass_ui ' + className;
        node.dataset.rbUi = '';
        if (text) node.textContent = text;
        return node;
    }
    const docOf = unit => unit.head.ownerDocument;

    // folded: the heading stays (greyed), with a chip saying what's under it; a click opens it
    const chipHolder = unit => unit.head.querySelector(':scope > .txt') || unit.head;
    function fold(unit, s, view) {
        unit.head.classList.add('pass_head');
        for (const node of unit.body) node.classList.add('pass_folded');
        const count = unit.body.length;
        const chip = ui(docOf(unit), 'button', 'tag_chip pass_chip', count ? `${count} ${view === 'text' ? (count === 1 ? 'line' : 'lines') : '¶'} · open` : 'open');
        chip.type = 'button';
        chip.dataset.peek = s.key;
        chip.title = `Not part of pass ${pass()} (${Passes.ROLES[s.role].toLowerCase()}). Open it if you need to.`;
        chipHolder(unit).append(chip);
    }

    // opened with a click: it can be folded again
    function markOpen(unit, s) {
        const chip = ui(docOf(unit), 'button', 'tag_chip pass_chip open', 'fold');
        chip.type = 'button';
        chip.dataset.unpeek = s.key;
        chip.title = 'Fold it again';
        chipHolder(unit).append(chip);
    }

    // just after the heading (in pasted text, a line of its own, so the line numbers stay)
    function place(unit, node) {
        if (unit.head.matches('.line')) {
            const li = ui(docOf(unit), 'li', 'pass_line');
            li.append(node);
            unit.head.after(li);
        } else unit.head.after(node);
    }

    // the printed pages with nothing to read in this pass
    function dimPages() {
        const keep = new Set();
        const pages = $$('#reader_pdf .pdf_page');
        const first = sections[0]?.place.page || 1;
        for (let p = 1; p <= first; p++) keep.add(p);
        sections.forEach((s, i) => {
            if (!shownNow(s) && !peeked.has(s.key)) return;
            const next = sections[i + 1]?.place;
            const last = next ? (next.y < 0.06 ? next.page - 1 : next.page) : pages.length;
            for (let p = s.place.page; p <= Math.max(s.place.page, last); p++) keep.add(p);
        });
        for (const page of pages) if (!keep.has(Number(page.dataset.page))) page.classList.add('pass_dim');
    }

    // pass 2: proofs fold on their own
    function foldProofs(view, html) {
        const proofs = html ? [...html.querySelectorAll('.ltx_proof')]
            : view === 'read' ? $$('#reader_read .read_para').filter(p => /^proof\b[.:]?/i.test(p.textContent.trim()))
            : $$('#reader_text .line').filter(l => /^proof\b[.:]/i.test(l.dataset.text.trim()));
        proofs.forEach((proof, i) => {
            const key = 'proof|' + i;
            if (peeked.has(key)) return;
            proof.classList.add('pass_folded');
            const btn = ui(proof.ownerDocument, 'button', 'tag_chip pass_chip solo', 'Proof · open');
            btn.type = 'button';
            btn.dataset.peek = key;
            btn.title = 'Proofs wait for pass 3. Open it if you need to.';
            if (proof.matches('.line')) {
                const li = ui(proof.ownerDocument, 'li', 'pass_line');
                li.append(btn);
                proof.before(li);
            } else proof.before(btn);
        });
    }

    // pass 3: each main section (with its subsections) behind a card until you've written what you expect
    function blurCore(units, view) {
        const predictions = passData(3).predictions || {};
        for (const { section: s, group } of Passes.predictions(sections)) {
            const i = s.index;
            if (!units[i]) continue;
            const saved = predictions[s.key] || {};
            if (!saved.state) {
                for (const j of group.filter(j => units[j])) {
                    for (const node of units[j].body) node.classList.add('pass_blur');
                    if (j !== i) units[j].head.classList.add('pass_blur');
                }
            }
            place(units[i], card(docOf(units[i]), s, saved, view));
        }
    }

    // A slim strip until you start ("Predict “Method” before you read it · Predict · Skip"), then the box to
    // write in and Reveal; once revealed, what you expected and a box for how theirs differs.
    const expanded = new Set();
    function card(doc, s, saved, view) {
        const box = ui(doc, 'div', 'pass_card');
        box.dataset.key = s.key;
        const title = Passes.clean(s.title);
        const inPage = doc === document;
        const button = (label, data, primary) => {
            const b = ui(doc, 'button', (inPage ? 'btn small' : 'pass_btn') + (primary ? ' primary' : ''), label);
            b.type = 'button';
            Object.assign(b.dataset, data);
            return b;
        };
        if (!saved.state && !saved.predicted && !expanded.has(s.key)) {
            box.classList.add('strip');
            box.append(ui(doc, 'span', 'pass_card_text', `Predict “${title}” before you read it`),
                button('Predict', { expand: '' }, true), button('Skip', { reveal: 'skipped' }));
        } else if (!saved.state) {
            box.append(ui(doc, 'strong', '', `What do you expect in “${title}”?`),
                ui(doc, 'small', '', 'What it will say, or how you would have done it yourself.'));
            const area = ui(doc, 'textarea', '');
            area.rows = 3;
            area.dataset.predict = 'predicted';
            area.value = saved.predicted || '';
            area.setAttribute('aria-label', `What you expect in ${title}`);
            const row = ui(doc, 'div', 'pass_card_row');
            row.append(button('Reveal', { reveal: 'revealed' }, true), button('Skip', { reveal: 'skipped' }));
            box.append(area, row);
        } else if (saved.state === 'revealed') {
            box.classList.add('done');
            box.append(ui(doc, 'small', 'pass_card_label', 'You expected'), ui(doc, 'p', 'pass_expected', saved.predicted?.trim() || '(nothing written)'));
            const area = ui(doc, 'textarea', '');
            area.rows = 2;
            area.dataset.predict = 'differs';
            area.placeholder = 'How does theirs differ? Why might they have done it that way?';
            area.value = saved.differs || '';
            area.setAttribute('aria-label', `How ${title} differs from what you expected`);
            box.append(area);
        } else {
            box.classList.add('done', 'strip');
            box.append(ui(doc, 'span', 'pass_card_text', 'Shown without a prediction'), button('Predict after all', { reveal: '' }));
        }
        if (view === 'html') box.classList.add('in_frame');
        return box;
    }

    // the paper's frame has none of the app's styles: what the controls need
    function frameCss(doc) {
        if (doc.getElementById('rb_pass_css')) return;
        const style = doc.createElement('style');
        style.id = 'rb_pass_css';
        style.textContent = `
            .pass_folded { display: none !important; }
            .pass_blur { filter: blur(5px); opacity: .5; user-select: none; pointer-events: none; }
            .pass_head { color: #8a857c; }
            .pass_chip { margin-left: 10px; padding: 1px 9px; border: 1px solid #ddd8cf; border-radius: 999px; background: #f6f4f0;
                color: #5b5750; font: 600 12px/1.6 system-ui, sans-serif; vertical-align: middle; cursor: pointer; }
            .pass_chip:hover { border-color: #3d5afe; color: #3d5afe; }
            .pass_card { margin: 6px 0 14px; padding: 10px 12px; border: 1px solid #d4d1fb; border-left: 3px solid #3d5afe; border-radius: 8px;
                background: #f7f7ff; font: 14px/1.45 system-ui, sans-serif; color: #1f1d1a; display: grid; gap: 6px; }
            .pass_card.strip { display: flex; align-items: center; gap: 8px; padding: 6px 8px 6px 12px; }
            .pass_card.done { background: #f7f7f5; border-color: #e3dfd7; border-left-color: #b9b4ab; }
            .pass_card_text { flex: 1; color: #3a3732; }
            .pass_card small { color: #6b665e; }
            .pass_card textarea { width: 100%; box-sizing: border-box; font: inherit; padding: 6px 8px; border: 1px solid #ccc6bc; border-radius: 6px; resize: vertical; }
            .pass_card .pass_expected { margin: 0; white-space: pre-wrap; color: #3a3732; }
            .pass_card_row { display: flex; gap: 6px; }
            .pass_btn { padding: 4px 12px; border: 1px solid #ccc6bc; border-radius: 6px; background: #fff; font: 600 12.5px system-ui, sans-serif; cursor: pointer; }
            .pass_btn.primary { background: #3d5afe; border-color: #3d5afe; color: #fff; }`;
        doc.head.append(style);
    }

    // ---- clicks and typing on the controls in the paper ----

    // (capture: before the note tools see the click)
    function watchDoc(doc) {
        for (const type of ['click', 'pointerdown', 'mousedown', 'mouseup', 'contextmenu', 'dblclick']) {
            doc.addEventListener(type, e => {
                const control = e.target.closest?.('[data-rb-ui]');
                if (!control || control.closest('.toc_drop')) return;
                e.stopPropagation();
                if (type === 'click') onPaperUi(e);
            }, true);
        }
        doc.addEventListener('input', e => {
            const area = e.target.closest?.('.pass_card textarea');
            if (area) savePrediction(area.closest('.pass_card').dataset.key, { [area.dataset.predict]: area.value }, false);
        });
        if (doc !== document) timer.watch(doc); // (the paper's frame: reading there counts too)
    }
    const watchFrame = doc => watchDoc(doc); // (material.js, once the HTML paper has loaded)

    function onPaperUi(e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.dataset.peek) {
            peeked.add(btn.dataset.peek);
            record = Passes.savePass(record, pass(), { peeks: [...new Set([...(passData().peeks || []), btn.dataset.peek])] });
            return apply();
        }
        if (btn.dataset.unpeek) {
            peeked.delete(btn.dataset.unpeek);
            return apply();
        }
        if (btn.dataset.expand !== undefined) {
            const key = btn.closest('.pass_card').dataset.key;
            const doc = btn.ownerDocument;
            expanded.add(key);
            apply();
            doc.querySelector(`.pass_card[data-key="${CSS.escape(key)}"] textarea`)?.focus();
            return;
        }
        if (btn.dataset.reveal !== undefined) {
            const key = btn.closest('.pass_card').dataset.key;
            const area = btn.closest('.pass_card').querySelector('textarea[data-predict="predicted"]');
            if (btn.dataset.reveal === '') expanded.add(key);
            savePrediction(key, { state: btn.dataset.reveal, ...(area ? { predicted: area.value } : {}) }, true);
        }
    }

    let predictTimer = null;
    function savePrediction(key, changes, now) {
        const predictions = { ...(passData(3).predictions || {}) };
        predictions[key] = { ...(predictions[key] || {}), ...changes };
        record = { ...record, passes: { ...record.passes, 3: { ...passData(3), predictions } } }; // (shown at once)
        clearTimeout(predictTimer);
        const write = () => {
            record = Passes.savePass(record, 3, { predictions: record.passes[3].predictions });
            sectionSoon('predictions', Passes.predictionsText(Passes.predictions(sections), record.passes[3].predictions));
            renderForm();
        };
        if (now) { write(); apply(); } else predictTimer = setTimeout(write, 600);
    }

    // ---- the Contents: each section's role, your marked headings ----

    function decorate(node, row) {
        if (!on()) return;
        const s = Passes.sections(Toc.entries(), record.roles || {})[node.index];
        if (!s) return;
        const pick = el('select', 'toc_role');
        pick.dataset.rbUi = '';
        pick.title = 'Its role in reading passes (decides what each pass shows)';
        pick.setAttribute('aria-label', `Role of ${s.title}`);
        for (const [value, label] of Object.entries(Passes.ROLES)) pick.append(new Option(label, value));
        pick.value = s.role;
        if (s.tagged) pick.classList.add('tagged');
        pick.onchange = () => {
            const roles = { ...(record.roles || {}) };
            if (pick.value === s.auto) delete roles[s.key];
            else roles[s.key] = pick.value;
            record = Passes.save(record, { roles });
            Toc.show(currentView);
        };
        row.append(pick);
        if (s.mark) {
            const remove = el('button', 'toc_role link', '✕');
            remove.type = 'button';
            remove.dataset.rbUi = '';
            remove.title = 'Remove this heading you marked';
            remove.onclick = () => {
                record = Passes.save(record, { marks: (record.marks || []).filter(m => !(m.title === s.title && JSON.stringify(m.place) === JSON.stringify(s.place))) });
                Toc.show(currentView);
            };
            row.append(remove);
        }
    }

    const marksFor = view => (on() ? (record.marks || []).filter(m => m.place.view === view) : []);

    // right-click → Mark as a section heading (material_menu.js): from what you selected or clicked
    const canMark = target => on() && !!target && (target.page || target.line) && currentView !== 'html';
    function markSection(target) {
        const title = (target.quote || '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Section';
        let place;
        if (currentView === 'pdf') {
            const line = pdfPageLines[target.page - 1]?.[(Number(target.line) || 1) - 1];
            place = { view: 'pdf', page: Number(target.page), y: Math.max(0, (line?.box.y || 0) - 0.01), label: `p. ${target.page}` };
        } else place = { view: 'text', line: Number(target.line), label: `l. ${target.line}` };
        record = Passes.save(record, { marks: [...(record.marks || []), { title, level: 1, place, mark: true }] });
        Toc.show(currentView);
        toast(`“${title}” is a section now. Change its role in Contents.`);
    }

    // ---- the pass's notes, at the end of the paper ----
    // A header card (which pass, what it's for, the time), your earlier passes (folded), the pass's steps in the
    // order you do them while reading, then the decision as three choices.

    function field(label, path, value, { rows = 2, hint = '', placeholder = '' } = {}) {
        const box = el('label', 'pass_field');
        if (label) box.append(el('strong', '', label));
        if (hint) box.append(el('small', '', hint));
        const area = el('textarea');
        area.rows = rows;
        area.dataset.path = path;
        area.value = value || '';
        if (placeholder) area.placeholder = placeholder;
        if (!label) area.setAttribute('aria-label', placeholder || path);
        box.append(area);
        return box;
    }

    function check(label, path, checked) {
        const box = el('label', 'check');
        const input = el('input');
        input.type = 'checkbox';
        input.dataset.path = path;
        input.checked = !!checked;
        box.append(input, ' ' + label);
        return box;
    }

    // a numbered step: ① Title · count, a line on what it's for, then its content
    function step(n, title, hint, ...content) {
        const box = el('section', 'pass_stepbox');
        const head = el('h4', 'pass_stephead');
        head.append(el('span', 'badge pass_stepnum', String(n)), el('span', '', title));
        box.append(head);
        if (hint) box.append(el('p', 'pass_stephint', hint));
        box.append(...content.filter(Boolean));
        return box;
    }

    function renderForm() {
        if (!on()) return;
        const form = $('#pass_form');
        const n = pass();
        const data = passData(n);
        const info = Passes.PASSES[n];

        const head = el('header', 'pass_headcard');
        const kicker = el('div', 'pass_kicker');
        kicker.append(el('span', '', `Pass ${n} of 3`));
        const target = info.target ? (info.target[1] >= 60 ? 'about 1 h' : `${info.target[0]}–${info.target[1]} min`) : '';
        const spent = data.activeMs ? Passes.duration(data.activeMs) : '';
        if (spent || target) kicker.append(el('span', 'pass_time', [spent && `${spent} spent`, target && `aim ${target}`].filter(Boolean).join(' · ')));
        head.append(kicker, el('h3', '', info.name), el('p', '', info.aim), el('p', 'pass_shows', info.shows));
        if (n === 1 && isSeed()) head.append(el('p', 'pass_shows', 'A seed paper of your survey: its background and related work are open too.'));
        if (Passes.isSurvey(source, record)) {
            head.append(el('p', 'pass_note', 'This looks like a survey paper. After its first pass, its references can be your key papers: Literature → Survey.'));
        }
        const parts = [head];
        if (record.state !== 'reading') {
            const why = passData().reason;
            parts.push(el('p', 'pass_banner', `${Passes.label(record)}${why ? ': ' + why : ''}. Choose a pass at the top to go on any time.`));
        }
        const earlier = earlierPasses(n);
        if (earlier) parts.push(earlier);
        parts.push(...(n === 1 ? formOne(data) : n === 2 ? formTwo(data) : formThree(data)));
        parts.push(decision(n));

        // keep what's being typed (a re-render while you write keeps the box and where the cursor is)
        const active = document.activeElement;
        const path = form.contains(active) ? active.dataset.path : null;
        const caret = path && active.selectionStart;
        const open = new Set($$('details[data-keep]', form).filter(d => d.open).map(d => d.dataset.keep));
        form.replaceChildren(...parts);
        for (const d of $$('details[data-keep]', form)) if (open.has(d.dataset.keep)) d.open = true;
        if (path) {
            const again = $(`[data-path="${CSS.escape(path)}"]`, form);
            again?.focus({ preventScroll: true });
            if (again?.setSelectionRange && caret != null) again.setSelectionRange(caret, caret);
        }
    }

    // the boxes of the passes before this one: still there to change (each is a section of the Summary)
    function earlierPasses(n) {
        if (n === 1) return null;
        const box = el('details', 'pass_earlier');
        box.dataset.keep = 'earlier';
        box.append(el('summary', '', n === 2 ? 'Pass 1: the five Cs' : 'Passes 1 and 2: the five Cs, the main argument'));
        const grid = el('div', 'pass_grid');
        for (const s of Passes.SECTIONS.filter(s => s.pass < n && (s.key !== 'field' || isSeed() || sec('field')))) grid.append(secField(s));
        box.append(grid, el('small', 'hint', 'Each box is a section of the paper’s Summary, in the notes side: change it here or there.'));
        return box;
    }

    // ---- what you write is the material's Summary, in sections (sources/passes.js) ----
    const summaryNow = () => source.summary ?? source.body ?? '';
    const sec = key => Passes.section(summaryNow(), key);
    const secOf = key => Passes.SECTIONS.find(s => s.key === key);
    // a box for one section of the Summary
    const secField = (s, { label = s.title, rows = 2, placeholder = '' } = {}) => field(label, 'sec:' + s.key, sec(s.key), { rows, hint: label ? s.hint : '', placeholder });
    const refsNow = () => source.references || [];

    // a reference row: its words, a tick for the mark, "In project ↗" when it is
    function refRow(ref, mark, sources) {
        const li = el('li');
        li.append(check(`[${ref.n}] ${ref.text}`, `ref:${mark}:${ref.n}`, ref[mark]));
        const there = sources && ((ref.sourceId && sources.find(s => s.id === ref.sourceId)) || References.match(ref, sources));
        if (there) {
            const a = el('a', 'pass_in', 'In project ↗');
            a.href = 'material.html?id=' + encodeURIComponent(there.id);
            li.append(a);
        }
        return li;
    }

    function formOne(data) {
        const refs = refsNow();
        let refsBox = el('p', 'hint', 'No reference list was found in this paper.');
        if (refs.length) {
            refsBox = el('details', 'pass_refs');
            refsBox.dataset.keep = 'known';
            refsBox.append(el('summary', '', `${refs.filter(r => r.known).length} of ${refs.length} known`));
            const list = el('ol', 'pass_ref_list');
            for (const ref of refs) list.append(refRow(ref, 'known'));
            refsBox.append(list, el('small', 'hint', 'The same marks show in the References panel, beside your notes.'));
        }
        const grid = el('div', 'pass_grid');
        for (const [key] of Passes.FIVE_CS) grid.append(secField(secOf(key)));
        return [
            step(1, 'Glance at the references', 'Tick the ones you already know: it tells you how close this paper is to what you know.', refsBox),
            step(2, 'The five Cs', 'A line or two each is enough. Each is a section of the paper’s Summary.', grid),
            (isSeed() || sec('field')) && step(3, 'What the field has done', secOf('field').hint,
                secField(secOf('field'), { label: '', rows: 3, placeholder: 'The work it builds on, the gaps it names…' })),
        ].filter(Boolean);
    }

    // ---- pass 2's evidence: the highlights in the project's evidence colour ----

    const evidenceColor = () => {
        const colors = NoteColors.of(project);
        return colors.find(c => c.id === project.evidenceColor)?.id || colors.find(c => /evidence/i.test(c.label))?.id || '';
    };

    function evidenceStep() {
        const colors = NoteColors.of(project);
        const color = evidenceColor();
        const box = el('div', 'pass_evidence');
        const pick = el('label', 'pass_color_pick');
        pick.append('Evidence is the colour ');
        const select = el('select');
        select.dataset.act = 'evidence_color';
        select.append(new Option('(choose one)', ''), ...colors.map(c => new Option(c.label, c.id)));
        select.value = color;
        pick.append(select);
        const add = el('button', 'link', '+ an “Evidence” colour');
        add.type = 'button';
        add.dataset.act = 'evidence_add';
        add.hidden = colors.some(c => /evidence/i.test(c.label));
        box.append(pick, add);
        if (!color) {
            box.append(el('p', 'hint', 'Choose which highlight colour means evidence: what you highlight in it while reading shows here.'));
            return box;
        }
        const marked = notes.filter(n => n.quote || n.body);
        if (!marked.length) {
            box.append(el('p', 'hint', `No highlights yet: highlight the passages that carry the argument in ${NoteColors.find(project, color).label}.`));
            return box;
        }
        const list = el('ul', 'pass_list');
        for (const note of [...marked].sort((a, b) => Number(b.color === color) - Number(a.color === color))) {
            const li = el('li');
            const words = (note.quote || note.body).replace(/\s+/g, ' ').trim();
            const row = check((words.length > 140 ? words.slice(0, 140) + '…' : words) + (note.page ? ` (p. ${note.page})` : ''), 'evidence:' + note.id, note.color === color);
            row.prepend(NoteColors.dot(NoteColors.hexOf(project, note.color)));
            li.append(row);
            list.append(li);
        }
        box.append(list, el('small', 'hint', 'Ticking one gives it the evidence colour (unticking puts its colour back).'));
        return box;
    }

    // ---- pass 2's figures: checked once, on the figure itself when you captured it ----

    // the project figures captured from this paper, by the number in their place or caption ("figure 2")
    const figureKey = text => { const m = (text || '').match(/\b(fig(?:ure)?\.?|table)\s*(\d+)/i); return m ? (/^t/i.test(m[1]) ? 'table ' : 'figure ') + m[2] : ''; };
    const capturedFigures = () => Store.getItems(project.id).filter(i => i.type === 'figure' && i.sourceId === source.id);

    function figuresList(data) {
        const found = figuresIn();
        const captured = capturedFigures();
        const rows = found.map(fig => ({ ...fig, item: captured.find(c => figureKey(c.locator) === fig.key || figureKey(c.caption) === fig.key) }));
        for (const item of captured) {
            if (rows.some(r => r.item === item)) continue;
            rows.push({ key: 'item:' + item.id, label: item.locator || (item.kind === 'table' ? 'Table' : 'Figure'), caption: item.caption || '', item });
        }
        if (!rows.length) return [rows, el('p', 'hint', 'None found in this view. Check them as you go: labelled axes, error bars, results that mean something.')];
        const list = el('ul', 'pass_list pass_figs');
        for (const fig of rows) {
            const c = fig.item?.checks || data.figures?.[fig.key] || {};
            const li = el('li');
            const top = el('div', 'pass_fig_top');
            const go = el('button', 'link pass_fig_go', fig.label);
            go.type = 'button';
            if (fig.place) { go.dataset.go = JSON.stringify(fig.place); go.title = 'Go to it'; } else go.disabled = true;
            top.append(go, el('span', 'pass_fig_caption', fig.caption));
            if (fig.item) top.append(el('span', 'badge material', 'Captured'));
            const path = fig.item ? `figitem:${fig.item.id}` : `fig:${fig.key}`;
            const row = el('div', 'pass_fig_checks');
            row.append(check('Axes labelled', `${path}:axes`, c.axes), check('Error bars', `${path}:errors`, c.errors), check('Meaningful', `${path}:significant`, c.significant));
            const note = el('input', 'pass_fig_note');
            note.dataset.path = `${path}:note`;
            note.value = c.note || '';
            note.placeholder = 'What it shows, what’s off…';
            note.setAttribute('aria-label', `Note on ${fig.label}`);
            li.append(top, row, note);
            list.append(li);
        }
        return [rows, list];
    }

    function formTwo(data) {
        const [figures, figs] = figuresList(data);

        // ④ references to follow up (the ones not known already): marks on the paper's one reference list
        const refs = refsNow().filter(r => !r.known);
        let follow = el('p', 'hint', refsNow().length ? 'You know every reference already.' : 'No reference list was found in this paper.');
        if (refs.length) {
            const chosen = refs.filter(r => r.followUp);
            const sources = Store.getItems(project.id).filter(i => i.type === 'source' && i.id !== source.id);
            follow = el('details', 'pass_refs');
            follow.dataset.keep = 'follow';
            follow.append(el('summary', '', `${chosen.length} to follow up, of ${refs.length}`));
            const list = el('ol', 'pass_ref_list');
            for (const ref of refs) list.append(refRow(ref, 'followUp', sources));
            const add = el('button', 'btn small', `Add ${chosen.length || 'them'} to the project`);
            add.type = 'button';
            add.dataset.act = 'add_follow';
            add.disabled = !chosen.length;
            follow.append(list, add, el('small', 'hint', 'Marked here, they also show in the References panel, and as key papers on the survey board.'));
        }

        return [
            step(1, `Figures and tables${figures.length ? ` (${figures.length})` : ''}`, 'Look closely as you meet each one. A figure you captured keeps its checks.', figs),
            step(2, 'Key evidence', 'The passages that carry the argument, highlighted in the evidence colour.', evidenceStep()),
            step(3, 'The main argument', 'Write it last, in your own words: you should be able to explain it to someone else. It is the heart of the paper’s Summary.',
                secField(secOf('argument'), { label: '', rows: 4, placeholder: 'What it claims, how, and what it found…' })),
            step(4, 'References to follow up', 'The ones worth reading next. Added references are looked up for you.', follow),
        ];
    }

    function formThree(data) {
        const predictions = data.predictions || {};
        const top = Passes.predictions(sections).map(p => p.section);
        let list = el('p', 'hint', 'No main sections found to predict. Change a section’s role in Contents to Main work.');
        if (top.length) {
            list = el('ul', 'pass_list');
            for (const s of top) {
                const p = predictions[s.key] || {};
                const li = el('li', 'pass_pred');
                const go = el('button', 'link', Passes.clean(s.title));
                go.type = 'button';
                go.dataset.go = JSON.stringify(s.place);
                const state = p.state === 'revealed' ? 'predicted' : p.state === 'skipped' ? 'skipped' : 'waiting';
                li.append(go, el('span', 'pass_tag ' + state, state));
                if (p.differs) li.append(el('p', 'pass_differs', p.differs));
                list.append(li);
            }
        }
        const done = top.filter(s => predictions[s.key]?.state).length;
        const grid = el('div', 'pass_grid');
        for (const key of ['assumptions', 'weaknesses', 'missing', 'future']) grid.append(secField(secOf(key)));
        const outline = el('details', 'pass_outline');
        outline.dataset.keep = 'outline';
        outline.open = !!sec('outline');
        outline.append(el('summary', '', 'Write it'));
        const compare = el('button', 'btn small', 'Compare with the contents');
        compare.type = 'button';
        compare.dataset.act = 'compare';
        outline.append(secField(secOf('outline'), { label: '', rows: 5, placeholder: 'Its sections and what each one says, without looking…' }), compare, el('ol', 'pass_compare'));
        return [
            step(1, `Your predictions${top.length ? ` (${done} of ${top.length})` : ''}`, 'Each main section waits behind a card in the paper: predict, reveal, compare. They are written into the Summary as “Predictions vs the paper”.', list),
            step(2, 'Close-out', 'Where the paper is strong, where it isn’t, and what comes next: sections of the paper’s Summary.',
                grid, secField(secOf('other'), { rows: 2, placeholder: 'Anything, as you go…' })),
            step(3, 'The outline, from memory', 'Optional: rebuild the paper’s structure without looking, then compare.', outline),
        ];
    }

    function decision(n) {
        const data = passData(n);
        const box = el('section', 'pass_decide');
        box.append(el('h4', '', n === 1 ? 'Is a second pass worth it?' : n === 2 ? 'Is a third pass worth it?' : 'Done with the paper?'));
        const choices = el('div', 'pass_choices');
        const choice = (value, title, text, primary) => {
            const b = el('button', 'btn pass_choice' + (primary ? ' primary' : ''));
            b.type = 'button';
            if (data.decision === value) b.setAttribute('aria-pressed', 'true');
            b.dataset.decide = value;
            b.append(el('strong', '', title), el('small', '', text));
            return b;
        };
        if (n < 3) choices.append(choice('next', 'Go deeper', `Start pass ${n + 1}: ${Passes.PASSES[n + 1].name.toLowerCase()}.`, true));
        else choices.append(choice('enough', 'Finish', 'Read in three passes: it’s Done.', true));
        if (n < 3) choices.append(choice('enough', 'Enough', 'I have what I need from it: it’s Done.'));
        choices.append(choice('park', 'Park it', 'Not now: it stays in Reading.'));
        const reason = el('input', 'pass_reason');
        reason.placeholder = 'Why? (optional)';
        reason.dataset.path = 'reason';
        reason.value = data.reason || '';
        reason.setAttribute('aria-label', 'Why (optional)');
        box.append(choices, reason);
        if (data.decision) {
            const said = { next: 'You went on to the next pass', enough: n === 3 ? 'You finished' : 'You stopped here', park: 'You parked it' }[data.decision];
            box.append(el('small', 'hint', `${said}${data.doneAt ? ' on ' + new Date(data.doneAt).toLocaleDateString() : ''}.`));
        }
        return box;
    }

    // figures and tables in the view shown: { key ("figure 2"), label, caption, place }
    function figuresIn() {
        const found = new Map();
        const add = (label, caption, place) => {
            const key = figureKey(label);
            if (key && !found.has(key)) found.set(key, { key, label, caption: caption.slice(0, 160), place });
        };
        const CAPTION = /^((?:fig\.?|figure|table)\s*\d+)\s*[.:|]?\s*(.*)$/i;
        if (currentView === 'html') {
            for (const fig of paperDoc()?.querySelectorAll('figure.ltx_figure[id], figure.ltx_table[id]') || []) {
                if (fig.parentElement.closest('figure')) continue;
                const tag = fig.querySelector('.ltx_tag')?.textContent.replace(/[:.]\s*$/, '').trim();
                const caption = fig.querySelector('figcaption')?.textContent.replace(/\s+/g, ' ').trim() || '';
                if (tag) add(tag, caption.replace(tag, '').replace(/^[:.\s]+/, ''), { view: 'html', anchor: fig.id, y: 0 });
            }
        } else if (currentView === 'pdf') {
            pdfPageLines.forEach((lines, p) => lines.forEach(line => {
                const m = line.text.trim().match(CAPTION);
                if (m && /[.:|]/.test(line.text.slice(m[1].length, m[1].length + 3))) add(m[1].replace(/^fig(?:ure|\.)?\s*/i, 'Figure '), m[2], { view: 'pdf', page: p + 1, y: Math.max(0, line.box.y - 0.02) });
            }));
        } else if (currentView === 'text') {
            Reader.textLines(source.text || '').forEach((line, i) => {
                const m = line.text.trim().match(CAPTION);
                if (m) add(m[1], m[2], { view: 'text', line: i + 1 });
            });
        }
        return [...found.values()];
    }

    // ---- a box in the form changed: saved where it belongs (text after a pause) ----
    // The material's: its Summary's sections, its reference marks. A note: its colour. A figure: its checks.
    // The pass's own: the reason for a decision, the checks of a figure not captured.

    let formTimer = null;
    let formChanges = {};
    function onFormInput(e) {
        const input = e.target.closest('[data-path]');
        if (!input) return;
        // a text box sends "change" again when you leave it: what it had is saved already (and may be older than
        // what you've since written elsewhere, e.g. in the notes side)
        if (e.type === 'change' && input.type !== 'checkbox' && input.tagName !== 'SELECT') return;
        const path = input.dataset.path;
        const value = input.type === 'checkbox' ? input.checked : input.value;
        let m;
        // a section of the Summary
        if ((m = path.match(/^sec:(\w+)$/))) return sectionSoon(m[1], value);
        if ((m = path.match(/^ref:(known|followUp):(.+)$/))) {
            source.references = Passes.markReference(source, m[2], m[1], value);
            ReferencesPanel.render();
            refresh();
            return renderForm();
        }
        if ((m = path.match(/^evidence:(.+)$/))) {
            const note = notes.find(n => n.id === m[1]);
            if (!note) return;
            const color = evidenceColor();
            Store.saveItem(value ? { id: note.id, color, colorBefore: note.color || '' } : { id: note.id, color: note.colorBefore || '', colorBefore: '' });
            refresh();
            return renderForm();
        }
        if ((m = path.match(/^figitem:([^:]+):(\w+)$/))) {
            const item = Store.getItem(m[1]);
            if (item) Store.saveItem({ id: item.id, checks: { ...(item.checks || {}), [m[2]]: value } });
            return;
        }
        const n = pass();
        const data = structuredClone(passData(n));
        if ((m = path.match(/^fig:(.+):(\w+)$/))) {
            data.figures = { ...(data.figures || {}) };
            data.figures[m[1]] = { ...(data.figures[m[1]] || {}), [m[2]]: value };
        } else data[path] = value;
        record = { ...record, passes: { ...record.passes, [n]: data } };
        Object.assign(formChanges, data);
        clearTimeout(formTimer);
        const write = () => {
            record = Passes.savePass(record, n, formChanges);
            formChanges = {};
        };
        if (input.type === 'checkbox') write(); else formTimer = setTimeout(write, 600);
    }

    // a section of the Summary: shown at once (source is this page's copy), saved after a pause, onto the Summary as
    // it is then (so an edit made meanwhile in the notes side, or another tab, is kept)
    let sourceTimer = null;
    let pendingSections = {};
    function sectionSoon(key, text) {
        pendingSections[key] = text;
        source.summary = Passes.setSection(summaryNow(), key, text);
        clearTimeout(sourceTimer);
        sourceTimer = setTimeout(flushSource, 600);
    }
    function flushSource() {
        clearTimeout(sourceTimer);
        if (!Object.keys(pendingSections).length) return;
        const latest = Store.getItem(source.id);
        let summary = latest.summary ?? latest.body ?? '';
        for (const [key, text] of Object.entries(pendingSections)) summary = Passes.setSection(summary, key, text);
        pendingSections = {};
        Store.saveItem({ id: source.id, summary });
        refresh(); // (the side panel's Summary)
    }
    function flushForm() {
        flushSource();
        if (!Object.keys(formChanges).length) return;
        clearTimeout(formTimer);
        record = Passes.savePass(record, pass(), formChanges);
        formChanges = {};
    }

    // the material changed elsewhere on the page (the side panel, a note): the pass's notes follow
    function sourceChanged() {
        const active = document.activeElement;
        if (!on() || ($('#pass_form').contains(active) && active.matches('textarea, input:not([type="checkbox"])'))) return; // (not while you type)
        renderForm();
    }

    async function onFormClick(e) {
        const go = e.target.closest('[data-go]');
        if (go) return Places.go(JSON.parse(go.dataset.go));
        const decide = e.target.closest('[data-decide]');
        if (decide) {
            flushForm();
            timer.flush();
            const n = pass();
            const reason = $('#pass_form .pass_reason').value.trim();
            record = Passes.decide(record, decide.dataset.decide, reason);
            refresh(); // (its status follows the passes)
            render();
            if (decide.dataset.decide === 'next') {
                $('.reader').scrollIntoView({ behavior: 'smooth', block: 'start' });
                toast(`Pass ${pass()}: ${Passes.PASSES[pass()].name.toLowerCase()}.`);
            } else if (decide.dataset.decide === 'park') toast(`Parked at pass ${n}: it stays in Reading.`);
            else toast(n === 3 ? 'Read in three passes: marked Done.' : `Stopped after pass ${n}: marked Done.`);
            return;
        }
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'add_follow') {
            await ReferencesPanel.add(refsNow().filter(r => r.followUp && !r.known).map(r => r.n));
            source = Store.getItem(source.id);
            renderForm();
        }
        if (act === 'evidence_add') {
            const colors = NoteColors.of(project);
            const added = { id: NoteColors.newId(), label: 'Evidence', hex: NoteColors.suggest(colors) };
            NoteColors.save(project, [...colors, added]);
            project.evidenceColor = added.id;
            Store.saveProject({ id: project.id, evidenceColor: added.id });
            NoteColors.applyCss(document, project);
            if (paperDoc()) NoteColors.applyCss(paperDoc(), project);
            renderColorPick(); // (material.js: the note form's colours)
            refresh();
            renderForm();
        }
        if (act === 'compare') {
            const list = $('#pass_form .pass_compare');
            list.replaceChildren(...sections.filter(s => s.isTop).map(s => el('li', '', Passes.clean(s.title))));
        }
    }
    $('#pass_form').addEventListener('change', e => {
        if (e.target.dataset.act !== 'evidence_color') return;
        project.evidenceColor = e.target.value;
        Store.saveProject({ id: project.id, evidenceColor: e.target.value });
        renderForm();
    });

    // ---- the timer (reader/timer.js): the time on this pass, as a quiet clock ----

    const timer = (() => {
        let nudged = false;
        const counter = ReadingTimer.create({
            onTick: () => show(),
            onFlush: ms => { if (record) record = Passes.savePass(record, pass(), { activeMs: (passData().activeMs || 0) + ms }); },
        });
        const visible = () => Settings.read().passTimer !== false;

        function setup() {
            addEventListener('pagehide', flushForm);
            addEventListener('settingssaved', show);
        }
        function restart() {
            counter.stop();
            nudged = false;
            if (on() && record.state === 'reading') counter.start();
            show();
        }
        const total = () => (passData().activeMs || 0) + counter.pending();
        function show() {
            const pill = $('#pass_timer');
            pill.hidden = !on() || !visible();
            if (pill.hidden) return;
            const reading = record.state === 'reading';
            const target = Passes.PASSES[pass()].target;
            const over = reading && target && total() >= target[1] * 60000;
            pill.classList.toggle('over', !!over);
            pill.classList.toggle('paused', !reading);
            $('#pass_timer_text').textContent = ReadingTimer.clock(total())
                + (!reading ? ' · ' + (record.state === 'parked' ? 'parked' : 'stopped')
                    : over ? ' · time to decide?'
                    : target ? ` · aim ${target[1] >= 60 ? '~1 h' : `${target[0]}–${target[1]} min`}` : '');
            pill.title = 'Time spent on this pass (counts only while you’re reading here). Hide it in Settings → Reading.'
                + (over ? ' Click to go to the notes and decide.' : '');
            if (over && !nudged) { nudged = true; pill.classList.add('nudge'); setTimeout(() => pill.classList.remove('nudge'), 2400); }
        }
        return { setup, restart, flush: () => counter.flush(), show, watch: counter.watch };
    })();

    return { setup, apply, watchFrame, canMark, markSection, sourceChanged, on: () => on() };
})();

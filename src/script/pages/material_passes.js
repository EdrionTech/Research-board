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

    // ---- turning it on and off ----

    function setup() {
        record = Passes.of(source);
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
        if ((source.status || 'to_read') === 'to_read') {
            Store.saveItem({ id: source.id, status: 'reading' });
            source.status = 'reading';
            $('#status_select').value = 'reading';
        }
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

    // ---- the bar: the passes, the timer, the form ----

    function renderBar() {
        const steps = [1, 2, 3].map(n => {
            const data = passData(n);
            const btn = el('button', 'pass_step');
            btn.type = 'button';
            btn.dataset.pass = n;
            const state = n === pass() ? 'current' : data.doneAt ? 'done' : data.skipped ? 'skipped' : '';
            if (state) btn.dataset.state = state;
            btn.setAttribute('aria-current', n === pass() ? 'step' : 'false');
            btn.title = `Pass ${n}: ${Passes.PASSES[n].name}` + (state === 'done' ? ' (done)' : state === 'skipped' ? ' (skipped)' : '')
                + (n > pass() ? '. Skip to it' : '');
            btn.append(el('span', 'pass_num', state === 'done' ? '✓' : state === 'skipped' ? '↷' : String(n)), el('span', 'pass_name', Passes.PASSES[n].short));
            return btn;
        });
        $('#pass_steps').replaceChildren(...steps);
        $('#pass_form_btn').textContent = Passes.PASSES[pass()].form + ' ↓';
        $('#pass_state').textContent = record.state !== 'reading' ? Passes.label(record) : '';
        renderHint();
        timer.show();
    }

    function renderHint() {
        const view = reflow();
        let hint = Passes.PASSES[pass()].shows;
        if (view === 'video') hint = 'Reading in passes is for papers: a video has no sections to fold.';
        else if (view === 'pages') hint = pass() === 3
            ? 'In the printed pages nothing can be hidden: switch to Read (⋯ View) to predict each section before you read it.'
            : 'Printed pages: the ones you can skip are dimmed. Read (⋯ View) folds the sections instead.';
        else if (!sections.length) hint = 'No sections found here. Mark headings with a right-click (Mark as a section heading), and they fold like any other.';
        $('#pass_hint').textContent = hint;
        $('#pass_hint').title = hint;
    }

    async function onBarClick(e) {
        const step = e.target.closest('.pass_step');
        if (step) return goTo(Number(step.dataset.pass));
        if (e.target.closest('#pass_form_btn, #pass_timer')) return $('#pass_form').scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (e.target.closest('#pass_leave')) return leave();
        if (e.target.closest('#pass_hint')) $('#pass_hint').classList.toggle('full'); // (phones show one line)
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
            if (!unit || Passes.shown(s.role, n)) return;
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

    // folded: the heading, and a button saying what's under it
    function fold(unit, s, view) {
        unit.head.classList.add('pass_head');
        for (const node of unit.body) node.classList.add('pass_folded');
        const count = unit.body.length;
        const what = view === 'text' ? (count === 1 ? 'line' : 'lines') : count === 1 ? 'paragraph' : 'paragraphs';
        const btn = ui(docOf(unit), 'button', 'pass_peek', count ? `▸ ${count} ${what} · open` : '▸ open');
        btn.type = 'button';
        btn.dataset.peek = s.key;
        btn.title = `Not part of pass ${pass()} (${Passes.ROLES[s.role].toLowerCase()}). Open it if you need to.`;
        place(unit, btn);
    }

    // opened with a click: it can be folded again
    function markOpen(unit, s) {
        const btn = ui(docOf(unit), 'button', 'pass_peek open', '▾ fold again');
        btn.type = 'button';
        btn.dataset.unpeek = s.key;
        place(unit, btn);
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
            if (!Passes.shown(s.role, pass()) && !peeked.has(s.key)) return;
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
            const btn = ui(proof.ownerDocument, 'button', 'pass_peek', '▸ proof · open');
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

    function card(doc, s, saved, view) {
        const box = ui(doc, 'div', 'pass_card');
        box.dataset.key = s.key;
        const title = Passes.clean(s.title);
        if (!saved.state) {
            box.append(ui(doc, 'strong', '', `Before you read “${title}”`));
            box.append(ui(doc, 'small', '', 'What do you expect it to say? How would you have done it yourself?'));
            const area = ui(doc, 'textarea', '');
            area.rows = 3;
            area.dataset.predict = 'predicted';
            area.value = saved.predicted || '';
            area.setAttribute('aria-label', `What you expect in ${title}`);
            const row = ui(doc, 'div', 'pass_card_row');
            const reveal = ui(doc, 'button', 'pass_btn primary', 'Reveal');
            reveal.type = 'button';
            reveal.dataset.reveal = 'revealed';
            const skip = ui(doc, 'button', 'pass_btn', 'Skip');
            skip.type = 'button';
            skip.dataset.reveal = 'skipped';
            skip.title = 'Not worth predicting: show it';
            row.append(reveal, skip);
            box.append(area, row);
        } else if (saved.state === 'revealed') {
            box.classList.add('done');
            box.append(ui(doc, 'strong', '', `You expected (“${title}”)`));
            box.append(ui(doc, 'p', 'pass_expected', saved.predicted?.trim() || '(nothing written)'));
            const area = ui(doc, 'textarea', '');
            area.rows = 2;
            area.dataset.predict = 'differs';
            area.placeholder = 'How does theirs differ? Why might they have done it that way?';
            area.value = saved.differs || '';
            area.setAttribute('aria-label', `How ${title} differs from what you expected`);
            box.append(area);
        } else {
            box.classList.add('done', 'skipped');
            box.append(ui(doc, 'small', '', `“${title}”: shown without a prediction.`));
            const again = ui(doc, 'button', 'pass_btn', 'Predict it after all');
            again.type = 'button';
            again.dataset.reveal = '';
            box.append(again);
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
            .pass_blur { filter: blur(5px); opacity: .55; user-select: none; pointer-events: none; }
            .pass_head { opacity: .7; }
            .pass_peek { display: block; margin: 2px 0 14px; padding: 3px 10px; border: 1px dashed #b9b4ab; border-radius: 6px;
                background: #faf8f4; color: #5b5750; font: 600 13px system-ui, sans-serif; cursor: pointer; }
            .pass_peek:hover { border-style: solid; color: #1f1d1a; }
            .pass_card { margin: 8px 0 16px; padding: 12px 14px; border: 1px solid #c9c4ff; border-radius: 10px;
                background: #f5f4ff; font: 14px/1.45 system-ui, sans-serif; color: #1f1d1a; display: grid; gap: 6px; }
            .pass_card.done { background: #f7f7f5; border-color: #ddd8cf; }
            .pass_card small { color: #5b5750; }
            .pass_card textarea { width: 100%; box-sizing: border-box; font: inherit; padding: 6px 8px; border: 1px solid #ccc6bc; border-radius: 6px; resize: vertical; }
            .pass_card .pass_expected { margin: 0; white-space: pre-wrap; color: #3a3732; }
            .pass_card_row { display: flex; gap: 6px; }
            .pass_btn { padding: 5px 12px; border: 1px solid #ccc6bc; border-radius: 6px; background: #fff; font: 600 13px system-ui, sans-serif; cursor: pointer; }
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
        for (const type of ['pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart']) doc.addEventListener(type, timer.touch, { capture: true, passive: true });
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
        if (btn.dataset.reveal !== undefined) {
            const key = btn.closest('.pass_card').dataset.key;
            const area = btn.closest('.pass_card').querySelector('textarea[data-predict="predicted"]');
            savePrediction(key, { state: btn.dataset.reveal, ...(area ? { predicted: area.value } : {}) }, true);
        }
    }

    let predictTimer = null;
    function savePrediction(key, changes, now) {
        const predictions = { ...(passData(3).predictions || {}) };
        predictions[key] = { ...(predictions[key] || {}), ...changes };
        record = { ...record, passes: { ...record.passes, 3: { ...passData(3), predictions } } }; // (shown at once)
        clearTimeout(predictTimer);
        const write = () => { record = Passes.savePass(record, 3, { predictions: record.passes[3].predictions }); renderForm(); };
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

    // ---- the form at the end of the reader ----

    function field(label, path, value, { rows = 2, hint = '', placeholder = '' } = {}) {
        const box = el('label', 'pass_field');
        box.append(el('strong', '', label));
        if (hint) box.append(el('small', 'hint', hint));
        const area = el('textarea');
        area.rows = rows;
        area.dataset.path = path;
        area.value = value || '';
        if (placeholder) area.placeholder = placeholder;
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

    function decision(n) {
        const box = el('div', 'pass_decide');
        const data = passData(n);
        if (n < 3) box.append(el('strong', '', n === 1 ? 'Is a second pass worth it?' : 'Is a third pass worth it?'));
        else box.append(el('strong', '', 'Done with the paper?'));
        const row = el('div', 'pass_decide_row');
        const btn = (label, value, primary, title) => {
            const b = el('button', 'btn small' + (primary ? ' primary' : ''), label);
            b.type = 'button';
            b.dataset.decide = value;
            if (title) b.title = title;
            return b;
        };
        if (n < 3) row.append(btn(`Go to pass ${n + 1}`, 'next', true), btn('Enough: stop here', 'enough', false, 'You have what you need from it'));
        else row.append(btn('Finish: read in three passes', 'enough', true));
        row.append(btn('Park it', 'park', false, 'Come back to it later'));
        const reason = el('input', 'pass_reason');
        reason.placeholder = 'Why? (optional)';
        reason.dataset.path = 'reason';
        reason.value = data.reason || '';
        reason.setAttribute('aria-label', 'Why (optional)');
        box.append(row, reason);
        if (data.decision) {
            const said = { next: 'You went on to the next pass', enough: n === 3 ? 'You finished' : 'You stopped here', park: 'You parked it' }[data.decision];
            box.append(el('small', 'hint', `${said}${data.doneAt ? ' on ' + new Date(data.doneAt).toLocaleDateString() : ''}.`));
        }
        return box;
    }

    function renderForm() {
        if (!on()) return;
        const form = $('#pass_form');
        const n = pass();
        const data = passData(n);
        const head = el('header', 'pass_form_head');
        head.append(el('h3', '', `Pass ${n} · ${Passes.PASSES[n].name}`));
        const time = data.activeMs ? `${Passes.duration(data.activeMs)} so far` : '';
        if (time) head.append(el('small', 'hint', time));
        const parts = [head];
        if (record.state !== 'reading') parts.push(el('p', 'pass_banner', `${Passes.label(record)}${passData().reason ? ': ' + passData().reason : ''}. Pick a pass above to go on any time.`));
        if (n === 1) parts.push(...formOne(data));
        if (n === 2) parts.push(...formTwo(data));
        if (n === 3) parts.push(...formThree(data));
        parts.push(decision(n));
        // keep what's being typed (a re-render while you write keeps the box and where the cursor is)
        const active = document.activeElement;
        const path = form.contains(active) ? active.dataset.path : null;
        const caret = path && active.selectionStart;
        form.replaceChildren(...parts);
        if (path) {
            const again = $(`[data-path="${CSS.escape(path)}"]`, form);
            again?.focus({ preventScroll: true });
            if (again?.setSelectionRange && caret != null) again.setSelectionRange(caret, caret);
        }
    }

    function formOne(data) {
        const cs = data.cs || {};
        const parts = [el('p', 'hint', 'Five to ten minutes: title, abstract, introduction, the headings, the conclusion, a glance at the references. Then answer the five Cs.')];
        const grid = el('div', 'pass_cs');
        for (const [key, label, hint] of Passes.FIVE_CS) grid.append(field(label, 'cs.' + key, cs[key], { hint }));
        parts.push(grid);
        const refs = source.references || [];
        if (refs.length) {
            const known = new Set(data.refsKnown || []);
            const box = el('details', 'pass_refs');
            box.append(el('summary', '', `References you already know (${known.size} of ${refs.length})`));
            const list = el('ol', 'pass_ref_list');
            for (const ref of refs) {
                const li = el('li');
                li.append(check(`[${ref.n}] ${ref.text}`, 'refsKnown:' + ref.n, known.has(ref.n)));
                list.append(li);
            }
            box.append(list);
            parts.push(box);
        }
        return parts;
    }

    function formTwo(data) {
        const parts = [el('p', 'hint', 'Up to an hour: read it with care but skip the proofs. Then say what it argues, and with what evidence.')];
        parts.push(field('The main argument, in your own words', 'summary', data.summary, { rows: 4, placeholder: 'What it claims, how, and what it found…' }));

        // evidence: your highlights and notes on it, pinned
        const pinned = new Set(data.evidence || []);
        const box = el('section', 'pass_sub');
        box.append(el('strong', '', 'Key evidence'));
        const marks = notes.filter(note => note.quote || note.body);
        if (!marks.length) box.append(el('small', 'hint', 'Highlight passages as you read: they show here, to pin as the evidence for the argument.'));
        else {
            const list = el('ul', 'pass_list');
            for (const note of marks) {
                const li = el('li');
                const words = (note.quote || note.body).replace(/\s+/g, ' ').trim();
                li.append(check((words.length > 140 ? words.slice(0, 140) + '…' : words) + (note.page ? ` (p. ${note.page})` : ''), 'evidence:' + note.id, pinned.has(note.id)));
                list.append(li);
            }
            box.append(list);
        }
        parts.push(box);

        // the figures: looked at closely
        const figures = figuresIn();
        const checks = data.figures || {};
        const figs = el('section', 'pass_sub');
        figs.append(el('strong', '', `Figures and tables${figures.length ? ` (${figures.length})` : ''}`));
        if (!figures.length) figs.append(el('small', 'hint', 'None found in this view. Check them as you go: labelled axes, error bars, results that mean something.'));
        const list = el('ul', 'pass_list pass_figs');
        for (const fig of figures) {
            const c = checks[fig.key] || {};
            const li = el('li');
            const go = el('button', 'link pass_fig_go', fig.label);
            go.type = 'button';
            go.dataset.go = JSON.stringify(fig.place);
            const caption = el('small', 'hint', fig.caption);
            const row = el('div', 'pass_fig_checks');
            row.append(check('Axes labelled', `fig:${fig.key}:axes`, c.axes), check('Error bars', `fig:${fig.key}:errors`, c.errors),
                check('Meaningful', `fig:${fig.key}:significant`, c.significant));
            const note = el('input', 'pass_fig_note');
            note.dataset.path = `fig:${fig.key}:note`;
            note.value = c.note || '';
            note.placeholder = 'What it shows, what’s off…';
            note.setAttribute('aria-label', `Note on ${fig.label}`);
            li.append(go, caption, row, note);
            list.append(li);
        }
        if (figures.length) figs.append(list);
        parts.push(figs);

        // references to follow up (the ones not known already)
        const refs = (source.references || []).filter(r => !(passData(1).refsKnown || []).includes(r.n));
        if (refs.length) {
            const follow = new Set(data.followUp || []);
            const sources = Store.getItems(project.id).filter(i => i.type === 'source' && i.id !== source.id);
            const box = el('details', 'pass_refs');
            box.open = follow.size > 0;
            box.append(el('summary', '', `References to follow up (${follow.size})`));
            const list = el('ol', 'pass_ref_list');
            for (const ref of refs) {
                const li = el('li');
                const there = (ref.sourceId && sources.find(s => s.id === ref.sourceId)) || References.match(ref, sources);
                li.append(check(`[${ref.n}] ${ref.text}`, 'followUp:' + ref.n, follow.has(ref.n)));
                if (there) {
                    const a = el('a', 'pass_in', 'In project ↗');
                    a.href = 'material.html?id=' + encodeURIComponent(there.id);
                    li.append(a);
                }
                list.append(li);
            }
            const add = el('button', 'btn small', 'Add the ones to follow up to the project');
            add.type = 'button';
            add.dataset.act = 'add_follow';
            add.disabled = !follow.size;
            box.append(list, add);
            parts.push(box);
        }
        return parts;
    }

    function formThree(data) {
        const parts = [el('p', 'hint', 'Re-create the work: the main sections wait behind a card in the paper. Predict, reveal, compare. That is where hidden assumptions show.')];
        const predictions = data.predictions || {};
        const top = Passes.predictions(sections).map(p => p.section);
        if (top.length) {
            const box = el('section', 'pass_sub');
            const done = top.filter(s => predictions[s.key]?.state).length;
            box.append(el('strong', '', `Your predictions (${done} of ${top.length} sections)`));
            const list = el('ul', 'pass_list');
            for (const s of top) {
                const p = predictions[s.key] || {};
                const li = el('li');
                const go = el('button', 'link', Passes.clean(s.title));
                go.type = 'button';
                go.dataset.go = JSON.stringify(s.place);
                li.append(go, ' ', el('small', 'hint', p.state === 'revealed' ? 'predicted' : p.state === 'skipped' ? 'skipped' : 'waiting'));
                if (p.differs) li.append(el('p', 'pass_differs', p.differs));
                list.append(li);
            }
            box.append(list);
            parts.push(box);
        }
        parts.push(field('Notes', 'notes', data.notes, { rows: 3, placeholder: 'Anything, as you go…' }));
        const grid = el('div', 'pass_cs');
        grid.append(
            field('Assumptions', 'assumptions', data.assumptions, { hint: 'Stated, and the ones it relies on without saying.' }),
            field('Weak spots', 'weaknesses', data.weaknesses, { hint: 'In the experiments, the analysis, the claims.' }),
            field('Missing citations', 'missing', data.missing, { hint: 'Work it should have compared with or credited.' }),
            field('Ideas for future work', 'future', data.future, { hint: 'What you would do next, or differently.' }),
        );
        parts.push(grid);
        const outline = el('details', 'pass_sub');
        outline.open = !!data.outline;
        outline.append(el('summary', '', 'Optional: the paper’s outline, from memory'));
        outline.append(field('', 'outline', data.outline, { rows: 5, placeholder: 'Its sections and what each one says, without looking…' }));
        const compare = el('button', 'btn small', 'Compare with the contents');
        compare.type = 'button';
        compare.dataset.act = 'compare';
        outline.append(compare, el('ol', 'pass_compare'));
        parts.push(outline);
        return parts;
    }

    // figures and tables in the view shown: { key, label, caption, place }
    function figuresIn() {
        const found = new Map();
        const add = (label, caption, place) => {
            const key = Passes.norm(label);
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

    // a box in the form changed: saved to the pass (text after a pause)
    let formTimer = null;
    let formChanges = {};
    function onFormInput(e) {
        const input = e.target.closest('[data-path]');
        if (!input) return;
        const n = pass();
        const data = structuredClone(passData(n));
        const path = input.dataset.path;
        const value = input.type === 'checkbox' ? input.checked : input.value;
        let m;
        if ((m = path.match(/^cs\.(\w+)$/))) data.cs = { ...(data.cs || {}), [m[1]]: value };
        else if ((m = path.match(/^(refsKnown|followUp|evidence):(.+)$/))) {
            const list = new Set(data[m[1]] || []);
            if (value) list.add(m[2]); else list.delete(m[2]);
            data[m[1]] = [...list];
        } else if ((m = path.match(/^fig:(.+):(\w+)$/))) {
            data.figures = { ...(data.figures || {}) };
            data.figures[m[1]] = { ...(data.figures[m[1]] || {}), [m[2]]: value };
        } else data[path] = value;
        record = { ...record, passes: { ...record.passes, [n]: data } };
        Object.assign(formChanges, data);
        clearTimeout(formTimer);
        const write = () => {
            record = Passes.savePass(record, n, formChanges);
            formChanges = {};
            if (input.type === 'checkbox') renderForm(); // (counts in the headings)
        };
        if (input.type === 'checkbox') write(); else formTimer = setTimeout(write, 600);
    }
    function flushForm() {
        if (!Object.keys(formChanges).length) return;
        clearTimeout(formTimer);
        record = Passes.savePass(record, pass(), formChanges);
        formChanges = {};
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
            render();
            if (decide.dataset.decide === 'next') {
                $('.reader').scrollIntoView({ behavior: 'smooth', block: 'start' });
                toast(`Pass ${pass()}: ${Passes.PASSES[pass()].name.toLowerCase()}.`);
            } else if (decide.dataset.decide === 'enough' && source.status !== 'done') {
                toast(n === 3 ? 'Read in three passes.' : `Stopped after pass ${n}.`, {
                    action: 'Mark as done', onAction: () => { Store.saveItem({ id: source.id, status: 'done' }); refresh(); },
                });
            } else toast(decide.dataset.decide === 'park' ? `Parked at pass ${n}: pick it up any time.` : `Stopped after pass ${n}.`);
            return;
        }
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'add_follow') {
            const numbers = passData(2).followUp || [];
            await ReferencesPanel.add(numbers);
            source = Store.getItem(source.id);
            renderForm();
        }
        if (act === 'compare') {
            const list = $('#pass_form .pass_compare');
            list.replaceChildren(...sections.filter(s => s.isTop).map(s => el('li', '', Passes.clean(s.title))));
        }
    }

    // ---- the gentle timer: active time only (the page shown, and you did something in the last two minutes) ----

    const timer = (() => {
        const IDLE = 120000;
        let last = Date.now();
        let pending = 0;
        let tick = null;
        let nudged = false;
        const touch = () => { last = Date.now(); };
        const visible = () => Settings.read().passTimer !== false;

        function setup() {
            addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
            addEventListener('pagehide', () => { flush(); flushForm(); });
            addEventListener('settingssaved', show);
        }
        function restart() {
            clearInterval(tick);
            nudged = false;
            if (on() && record.state === 'reading') tick = setInterval(step, 1000);
            show();
        }
        function step() {
            if (document.hidden || Date.now() - last > IDLE) return;
            pending += 1000;
            if (pending >= 30000) flush();
            show();
        }
        function flush() {
            if (!pending || !record) return;
            const ms = (passData().activeMs || 0) + pending;
            pending = 0;
            record = Passes.savePass(record, pass(), { activeMs: ms });
        }
        const total = () => (passData().activeMs || 0) + pending;
        function show() {
            const pill = $('#pass_timer');
            pill.hidden = !on() || !visible() || record.state !== 'reading';
            if (pill.hidden) return;
            const target = Passes.PASSES[pass()].target;
            const minutes = Math.floor(total() / 60000);
            const over = target && minutes >= target[1];
            pill.classList.toggle('over', !!over);
            pill.textContent = !target ? `${Passes.duration(total())} so far`
                : over ? `${Passes.duration(total())} · ready to decide?`
                : `${Passes.duration(total())} of ${target[1] >= 60 ? '~1 h' : `${target[0]}–${target[1]} min`}`;
            pill.title = 'Time spent reading (paused when you’re away). Hide it in Settings → Reading.'
                + (over ? ' Click to go to the form.' : '');
            if (over && !nudged) { nudged = true; pill.classList.add('nudge'); setTimeout(() => pill.classList.remove('nudge'), 2400); }
        }
        return { setup, restart, flush, show, touch };
    })();

    return { setup, apply, watchFrame, canMark, markSection, on: () => on() };
})();

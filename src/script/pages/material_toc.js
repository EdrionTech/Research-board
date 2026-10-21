// Material page: the table of contents. "☰ Contents" in the reader bar drops down the sections and
// subsections (collapsible) to jump to, showing the section you're in; it stays in reach as you scroll.
// From the PDF's own outline, or headings found in its text ("2.1 Method", "I. INTRODUCTION", "References"),
// arXiv's sections in the HTML version, Markdown or numbered headings in pasted text.
// An entry: { title, level (1, 2, 3…), place } — a place as in material_places.js. Loaded before material.js;
// material.js tells it what each view has (fromPdf / fromHtml / fromText) and which view is shown (show).

const Toc = (() => {
    let byView = {};   // view -> entries
    let shown = [];    // entries of the view being read

    const KNOWN = /^(abstract|introduction|related work|background|preliminaries|method|methods|methodology|approach|experiments?|experimental (setup|results)|evaluation|results|discussion|limitations|conclusions?|future work|acknowledge?ments?|references|bibliography|appendix|appendices)$/i;
    const NUMBERED = /^((?:\d+\.){0,3}\d+)\.?\s+(\p{Lu}[\p{L}\p{N} ,:&'’()/-]{1,80})$/u;   // 2.1 Method
    const ROMAN = /^([IVX]{1,5})\.\s+(\p{Lu}[\p{L}\p{N} ,:&'’()/-]{1,80})$/u;          // IV. RESULTS
    const LETTERED = /^([A-H])\.\s+(\p{Lu}[\p{L}\p{N} ,:&'’()/-]{1,60})$/u;              // B. Training (a subsection)

    function reset() {
        byView = {};
        render();
    }

    // ---- what each view has ----

    // the PDF's outline, or headings found in its lines ({ text, box } per line, per page)
    async function fromPdf(pdf, pages) {
        let entries = await outlineOf(pdf).catch(() => []);
        if (entries.length < 2) entries = headingsIn(pages);
        byView.pdf = entries;
        if (currentView === 'pdf') show('pdf');
    }

    async function outlineOf(pdf) {
        const outline = await pdf.getOutline();
        const entries = [];
        async function walk(items, level) {
            for (const item of items || []) {
                let dest = item.dest;
                if (typeof dest === 'string') dest = await pdf.getDestination(dest);
                if (Array.isArray(dest) && dest[0]) {
                    const index = typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0]);
                    const page = await pdf.getPage(index + 1);
                    const height = page.view[3] - page.view[1];
                    // [ref, {name: 'XYZ'}, left, top, zoom]: top counts up from the bottom of the page
                    const top = dest[1]?.name === 'XYZ' && typeof dest[3] === 'number' ? dest[3] : null;
                    const y = top == null ? 0 : Math.min(1, Math.max(0, 1 - (top - page.view[1]) / height));
                    entries.push({ title: item.title.trim(), level, place: { view: 'pdf', page: index + 1, y: Math.max(0, y - 0.01), label: `p. ${index + 1}` } });
                }
                if (level < 3) await walk(item.items, level + 1);
            }
        }
        await walk(outline, 1);
        return entries.filter(e => e.title);
    }

    // numbered and well-known headings, no smaller than the text around them, numbered in order
    function headingsIn(pages) {
        const heights = pages.flat().map(l => l.box.h).sort((a, b) => a - b);
        const body = heights[Math.floor(heights.length / 2)] || 0;
        const entries = [];
        let last = [];
        pages.forEach((lines, i) => lines.forEach(line => {
            const text = line.text.replace(/\s+/g, ' ').trim();
            if (text.length > 90 || /[.;,:]$/.test(text) || line.box.h < body * 0.95) return;
            let level = 0;
            let number = null;
            let m;
            if ((m = text.match(NUMBERED))) {
                number = m[1].split('.').map(Number);
                level = number.length;
                if (number[0] > 30 || /^\d+\s+\d/.test(text)) return; // a table row, a date
            } else if ((m = text.match(ROMAN))) {
                number = [romanValue(m[1])];
                level = 1;
                if (!/^[\p{Lu}\s\d,:&'’()/-]+$/u.test(m[2]) && m[2].split(' ').length > 6) return; // IEEE section titles are in capitals
            } else if ((m = text.match(LETTERED)) && entries.length) {
                number = [...last.slice(0, 1), m[1].charCodeAt(0) - 64];
                level = 2;
            } else if (KNOWN.test(text.replace(/^\d+\.?\s*/, ''))) {
                level = 1;
            } else return;
            // numbering goes up: "3 Results" after "2.4 Training"; a list inside the text doesn't
            if (number) {
                if (last.length && !after(number, last)) return;
                last = number;
            }
            entries.push({ title: text, level, place: { view: 'pdf', page: i + 1, y: Math.max(0, line.box.y - 0.01), label: `p. ${i + 1}` } });
        }));
        // the same heading twice in a row (a running header): once
        return entries.filter((e, i) => !i || e.title !== entries[i - 1].title);
    }

    const romanValue = r => [...r].reduce((sum, c, i, all) => {
        const v = { I: 1, V: 5, X: 10 }[c];
        return sum + (v < ({ I: 1, V: 5, X: 10 }[all[i + 1]] || 0) ? -v : v);
    }, 0);
    // a > b in numbering order: 2.1 after 2, 3 after 2.4
    function after(a, b) {
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const x = a[i] ?? 0, y = b[i] ?? 0;
            if (x !== y) return x > y && (i === 0 ? x - y <= 2 : true); // a jump of more than two sections is a list
        }
        return a.length > b.length;
    }

    function fromHtml(doc) {
        const sections = doc.querySelectorAll('section.ltx_section, section.ltx_subsection, section.ltx_subsubsection, section.ltx_appendix, section.ltx_bibliography, .ltx_abstract');
        byView.html = [...sections].map(section => {
            const title = section.querySelector(':scope > .ltx_title')?.textContent.replace(/\s+/g, ' ').trim()
                || (section.matches('.ltx_abstract') ? 'Abstract' : '');
            if (!title || !section.id) return null;
            const level = section.matches('.ltx_subsubsection') ? 3 : section.matches('.ltx_subsection') ? 2 : 1;
            return { title, level, place: { view: 'html', anchor: section.id, y: 0, label: '' } };
        }).filter(Boolean);
        if (currentView === 'html') show('html');
    }

    // Markdown headings (# …) and numbered headings in pasted text; lines as the text view numbers them
    function fromText(lines) {
        byView.text = lines.map((line, i) => {
            const text = line.text;
            const md = text.match(/^(#{1,4})\s+(.+)$/);
            if (md) return { title: md[2].replace(/[*_`]/g, '').trim(), level: md[1].length, place: { view: 'text', line: i + 1, label: `l. ${i + 1}` } };
            const m = text.length <= 90 && !/[.;,:]$/.test(text) && text.match(NUMBERED);
            if (m && Number(m[1].split('.')[0]) <= 30) return { title: text, level: m[1].split('.').length, place: { view: 'text', line: i + 1, label: `l. ${i + 1}` } };
            return null;
        }).filter(Boolean);
        if (currentView === 'text') show('text');
    }

    // ---- showing it ----

    function show(view) {
        shown = byView[view] || [];
        render();
    }

    // entries → a tree, by level
    function tree(entries) {
        const root = { children: [], level: 0 };
        const stack = [root];
        entries.forEach((entry, index) => {
            const node = { ...entry, index, children: [] };
            while (stack.at(-1).level >= entry.level) stack.pop();
            stack.at(-1).children.push(node);
            stack.push(node);
        });
        return root.children;
    }

    function list(nodes, open) {
        const ol = el('ol', 'toc_list');
        ol.append(...nodes.map(node => {
            const li = el('li', 'toc_item');
            li.dataset.index = node.index;
            const row = el('div', 'toc_row');
            if (node.children.length) {
                const twist = el('button', 'toc_twist', '▸');
                twist.type = 'button';
                twist.setAttribute('aria-expanded', open);
                twist.setAttribute('aria-label', 'Show or hide its subsections');
                row.append(twist);
            } else row.append(el('span', 'toc_twist_space'));
            const go = el('button', 'toc_go');
            go.type = 'button';
            go.append(el('span', '', node.title));
            if (node.place.label) go.append(el('small', '', node.place.label));
            row.append(go);
            li.append(row);
            if (node.children.length) {
                const sub = list(node.children, false);
                sub.hidden = !open;
                li.append(sub);
            }
            return li;
        }));
        return ol;
    }

    // the button shows when the material has contents; short ones open fully, long ones show their sections
    // with the subsections a click away
    function render() {
        const has = shown.length > 0;
        $('#toc_menu').hidden = !has;
        $('#toc_drop_list').replaceChildren(...(has ? [list(tree(shown), shown.length <= 24)] : []));
        if (!has) openDrop(false);
    }

    function openDrop(open) {
        $('#toc_drop').hidden = !open;
        $('#toc_btn').setAttribute('aria-expanded', open);
        if (open) markCurrent();
    }

    // the section you're in, highlighted (and shown: its parents open) in the dropdown
    async function markCurrent() {
        const place = await Places.current();
        if (!place) return;
        const index = shown.reduce((found, entry, i) => (isBefore(entry.place, place) ? i : found), -1);
        for (const item of $$('#toc_drop .toc_item.current')) item.classList.remove('current');
        const item = index >= 0 && $(`#toc_drop .toc_item[data-index="${index}"]`);
        if (!item) return;
        item.classList.add('current');
        for (let parent = item.parentElement.closest('.toc_item'); parent; parent = parent.parentElement.closest('.toc_item')) {
            setOpen(parent, true);
        }
        item.scrollIntoView({ block: 'nearest' });
    }

    // an entry starts at or before where you are
    function isBefore(a, b) {
        if (a.view !== b.view) return false;
        if (a.view === 'pdf') return a.page < b.page || (a.page === b.page && (a.y || 0) <= (b.y || 0) + 0.02);
        if (a.view === 'text') return a.line <= b.line;
        if (a.view === 'html') {
            const target = paperDoc()?.getElementById(a.anchor);
            return !!target && target.getBoundingClientRect().top <= 40;
        }
        return false;
    }

    function setOpen(item, open) {
        const twist = item.querySelector(':scope > .toc_row > .toc_twist');
        const sub = item.querySelector(':scope > .toc_list');
        if (!twist || !sub) return;
        twist.setAttribute('aria-expanded', open);
        sub.hidden = !open;
    }

    function onClick(e) {
        const item = e.target.closest('.toc_item');
        if (!item) return;
        if (e.target.closest('.toc_twist')) return setOpen(item, item.querySelector(':scope > .toc_list').hidden);
        if (e.target.closest('.toc_go')) {
            openDrop(false);
            if (smallScreen.matches) setSideCollapsed(true);
            Places.go(shown[Number(item.dataset.index)].place);
        }
    }

    function setup() {
        $('#toc_drop_list').addEventListener('click', onClick);
        $('#toc_btn').onclick = () => openDrop($('#toc_drop').hidden);
        document.addEventListener('click', e => { if (!e.composedPath().includes($('#toc_menu'))) openDrop(false); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#toc_drop').hidden) openDrop(false); });
    }

    // a click inside the HTML paper (its own frame) closes the dropdown too
    function watchFrame(doc) {
        doc.addEventListener('click', () => openDrop(false));
    }

    return { setup, reset, fromPdf, fromHtml, fromText, show, watchFrame, headingsIn };
})();

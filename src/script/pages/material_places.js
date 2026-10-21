// Material page: places in the material, the summary pad.
//   - Continue where you left off: where you are is kept as you read (source.readingAt) and the page opens there
//     next time ("Continued from p. 5", with a way back to the start).
//   - Bookmarks: places you mark (🔖, or B), listed under 🔖 Bookmarks to jump back to; items of type 'bookmark'.
//   - 📝 Summary: the material's summary in a pad over the reader, to write while you read (full screen too).
//
// A place: { view: 'pdf', page, y } (y: how far down the page, 0–1) · { view: 'text', line } ·
// { view: 'html', anchor, y } (a paragraph or figure) · { view: 'video', time }; with a label ("p. 5", "l. 120",
// "§3.1 ¶2", "12:30") and progress (0–1 through the material).
// Uses material.js (currentView, available, showView, player, pdfDoc, paperDoc, anchorLabel, source, project…);
// loaded before it, so nothing here runs until material.js calls Places.setup().

const Places = (() => {
    const SAVE_EVERY = 2500;           // ms: how often where you are is noted (when it changed)
    let ready = false;                 // not before the page has gone back to where you were
    let lastSaved = '';
    let bookmarks = [];

    const round = v => Math.round(v * 1000) / 1000;
    // the line under the sticky reader bar that counts as "where you are"
    const readingLine = () => Math.max(0, $('.reader_bar').getBoundingClientRect().bottom) + 24;
    // the same line once the bar has stuck under the top bar (where it is after scrolling into the material)
    const stuckLine = () => {
        const bar = $('.reader_bar');
        return (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight + 24;
    };
    // scrolls the page so that `y()` (a point on the page, measured now) sits on the reading line; checked again
    // once there, as the bar may only stick (or the page settle) after the first move
    async function scrollPageTo(y, behavior, stopped = () => false) {
        if (stopped()) return;
        scrollTo({ top: scrollY + y() - stuckLine() + 8, behavior });
        if (behavior === 'smooth') return;
        for (let i = 0; i < 3; i++) {
            await new Promise(requestAnimationFrame);
            if (stopped()) return;
            const off = y() - readingLine() + 8;
            if (Math.abs(off) < 2) break;
            scrollTo({ top: scrollY + off });
        }
    }
    const waitFor = (find, ms = 15000) => new Promise(resolve => {
        const started = Date.now();
        (function look() {
            const found = find();
            if (found || Date.now() - started > ms) return resolve(found || null);
            setTimeout(look, 120);
        })();
    });

    // ---- where you are ----

    async function current() {
        if (currentView === 'video') {
            if (!player) return null;
            const time = await player.getTime().catch(() => null);
            if (time == null) return null;
            return { view: 'video', time: Math.floor(time), label: formatTime(time), progress: videoDuration ? round(time / videoDuration) : 0 };
        }
        if (currentView === 'pdf') {
            const pages = $$('#reader_pdf .pdf_page');
            if (!pages.length) return null;
            const y = readingLine();
            const page = pages.find(p => p.getBoundingClientRect().bottom > y) || pages.at(-1);
            const r = page.getBoundingClientRect();
            const down = Math.min(1, Math.max(0, (y - r.top) / r.height));
            const n = Number(page.dataset.page);
            return { view: 'pdf', page: n, y: round(down), label: `p. ${n}`, progress: round((n - 1 + down) / (pdfDoc?.numPages || pages.length)) };
        }
        if (currentView === 'text') {
            const lines = $$('#reader_text .line');
            if (!lines.length) return null;
            const y = readingLine();
            const line = lines.find(l => l.getBoundingClientRect().bottom > y) || lines.at(-1);
            const n = Number(line.dataset.line);
            return { view: 'text', line: n, label: `l. ${n}`, progress: round((n - 1) / lines.length) };
        }
        if (currentView === 'html') {
            const doc = paperDoc();
            const win = doc?.defaultView;
            if (!doc?.body || !win) return null;
            const scrollable = Math.max(1, doc.scrollingElement.scrollHeight - win.innerHeight);
            const progress = round(Math.min(1, win.scrollY / scrollable));
            const block = [...doc.querySelectorAll('[data-anchor]')].find(b => b.getBoundingClientRect().bottom > 30);
            if (!block) return { view: 'html', label: 'Start', progress };
            const r = block.getBoundingClientRect();
            return { view: 'html', anchor: block.dataset.anchor, y: round(Math.min(1, Math.max(0, (30 - r.top) / r.height))), label: anchorLabel(block), progress };
        }
        return null;
    }

    // a few words from the place, to name a bookmark
    function wordsAt(place) {
        if (place.view === 'pdf') {
            const page = $(`#reader_pdf .pdf_page[data-page="${place.page}"]`);
            const lines = page ? [...page.querySelectorAll('.line')] : [];
            const top = page?.getBoundingClientRect();
            const line = top && lines.find(l => (l.getBoundingClientRect().top - top.top) / top.height >= place.y - 0.01);
            return line?.dataset.text || '';
        }
        if (place.view === 'text') return $(`#reader_text .line[data-line="${place.line}"]`)?.dataset.text || '';
        if (place.view === 'html') return paperDoc()?.getElementById(place.anchor)?.textContent || '';
        return '';
    }

    // ---- going to a place ----

    // stopped(): true once going there no longer makes sense (you started reading elsewhere meanwhile)
    async function go(place, { smooth = true, mark = true, stopped = () => false } = {}) {
        if (!place || !available.includes(place.view)) return false;
        await showView(place.view);
        if (stopped()) return false;
        const behavior = smooth ? 'smooth' : 'auto';
        if (place.view === 'video') {
            if (!await waitFor(() => stopped() || player) || stopped()) return false;
            player.seek(place.time || 0);
            $('#reader_video').scrollIntoView({ block: 'nearest', behavior });
            return true;
        }
        if (place.view === 'pdf') {
            const page = await waitFor(() => stopped() || $(`#reader_pdf .pdf_page[data-page="${place.page}"]`));
            if (!page || stopped()) return false;
            await scrollPageTo(() => { const r = page.getBoundingClientRect(); return r.top + r.height * (place.y || 0); }, behavior, stopped);
            if (mark) flashAt(page, place.y || 0);
            return true;
        }
        if (place.view === 'text') {
            const line = await waitFor(() => stopped() || $(`#reader_text .line[data-line="${place.line}"]`));
            if (!line || stopped()) return false;
            await scrollPageTo(() => line.getBoundingClientRect().top, behavior, stopped);
            if (mark) flash(line);
            return true;
        }
        if (place.view === 'html') {
            const doc = await waitFor(() => stopped() || (paperDoc()?.querySelector('[data-anchor]') && paperDoc()));
            if (!doc || stopped()) return false;
            $('#reader_html').scrollIntoView({ block: 'nearest', behavior });
            const block = place.anchor && doc.getElementById(place.anchor);
            const win = doc.defaultView;
            if (block) {
                const r = block.getBoundingClientRect();
                win.scrollTo({ top: win.scrollY + r.top + r.height * (place.y || 0) - 24, behavior });
                if (mark) flash(block);
            } else {
                win.scrollTo({ top: (place.progress || 0) * (doc.scrollingElement.scrollHeight - win.innerHeight), behavior });
            }
            return true;
        }
        return false;
    }

    function flash(node) {
        node.classList.remove('flash');
        void node.offsetWidth;
        node.classList.add('flash');
    }

    // a short-lived line across the PDF page where the place is
    function flashAt(page, y) {
        const line = el('div', 'place_flash');
        line.style.top = (y * 100).toFixed(2) + '%';
        page.append(line);
        setTimeout(() => line.remove(), 1600);
    }

    // ---- continue where you left off ----

    async function keep() {
        if (!ready || (document.hidden && !keep.leaving)) return;
        const place = await current();
        if (!place) return;
        const key = JSON.stringify(place);
        if (key === lastSaved) return;
        lastSaved = key;
        source.readingAt = { ...place, at: Date.now() };
        Store.saveItem({ id: source.id, readingAt: source.readingAt }, { touch: false });
        // started reading: "To read" becomes "Reading"
        if ((source.status || 'to_read') === 'to_read' && place.progress > 0.03) {
            Store.saveItem({ id: source.id, status: 'reading' });
            refresh();
        }
    }

    // back to where you were (not when the page was opened to show a note)
    async function resume() {
        const at = source.readingAt;
        const linked = /^#note=/.test(location.hash);
        if (!at || linked || !(at.progress > 0.01) || !available.includes(at.view)) {
            ready = true;
            return;
        }
        // you scrolled, tapped or pressed a key before it got there: you're reading, it stays out of the way
        let moved = false;
        const stop = () => { moved = true; };
        const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
        for (const type of events) addEventListener(type, stop, { capture: true, passive: true });
        const went = await go(at, { smooth: false, mark: false, stopped: () => moved });
        for (const type of events) removeEventListener(type, stop, { capture: true });
        lastSaved = JSON.stringify(await current());
        ready = true;
        if (went && !moved) {
            toast(`Continued from ${at.label}, where you were ${Reading.ago(at.at)}.`, {
                action: 'Start from the beginning',
                onAction: () => go(startOf(at.view)),
            });
        }
    }

    const startOf = view => ({ view, page: 1, y: 0, line: 1, time: 0, progress: 0, label: 'the start' });

    // ---- bookmarks ----

    function loadBookmarks() {
        bookmarks = Store.getItems(project.id)
            .filter(i => i.type === 'bookmark' && i.sourceId === source.id)
            .sort((a, b) => (a.place.progress || 0) - (b.place.progress || 0) || a.createdAt - b.createdAt);
    }

    async function addBookmark() {
        const place = await current();
        if (!place) return toast('Open the material to bookmark a place in it.');
        const words = wordsAt(place).replace(/\s+/g, ' ').trim();
        const title = words.length > 70 ? words.slice(0, 70).replace(/\s+\S*$/, '') + '…' : words;
        const id = Store.saveItem({ projectId: project.id, type: 'bookmark', sourceId: source.id, place, title });
        renderBookmarks();
        toast(`Bookmarked ${place.label}.`, { action: 'Name it', onAction: () => { openList(); rename(id); } });
    }

    function renderBookmarks() {
        loadBookmarks();
        $('#bookmarks_count').textContent = bookmarks.length ? bookmarks.length : '';
        $('#bookmark_list').replaceChildren(...(bookmarks.length ? bookmarks.map(b => {
            const li = el('li', 'bookmark');
            li.dataset.id = b.id;
            const jump = el('button', 'bookmark_go');
            jump.type = 'button';
            jump.append(el('strong', '', b.title || b.place.label), el('small', '', b.place.label + (available.includes(b.place.view) ? '' : ` (${b.place.view})`)));
            const edit = el('button', 'link bookmark_rename', '✎');
            edit.type = 'button';
            edit.title = 'Rename';
            const del = el('button', 'link bookmark_delete', '×');
            del.type = 'button';
            del.title = 'Delete this bookmark';
            li.append(jump, edit, del);
            return li;
        }) : [el('li', 'none', 'No bookmarks yet.')]));
        markBookmarks();
    }

    // a ribbon where each bookmark is: on the PDF page, the text line, the paragraph
    function markBookmarks() {
        for (const old of $$('#reader_pdf .bookmark_mark')) old.remove();
        for (const line of $$('#reader_text .line.bookmarked')) line.classList.remove('bookmarked');
        const doc = paperDoc();
        for (const block of doc?.querySelectorAll('.bookmarked') || []) block.classList.remove('bookmarked');
        for (const b of bookmarks) {
            const place = b.place;
            if (place.view === 'pdf') {
                const page = $(`#reader_pdf .pdf_page[data-page="${place.page}"]`);
                if (!page) continue;
                const mark = el('div', 'bookmark_mark');
                mark.style.top = (place.y * 100).toFixed(2) + '%';
                mark.title = b.title || place.label;
                page.append(mark);
            } else if (place.view === 'text') {
                $(`#reader_text .line[data-line="${place.line}"]`)?.classList.add('bookmarked');
            } else if (place.view === 'html') {
                doc?.getElementById(place.anchor)?.classList.add('bookmarked');
            }
        }
    }

    function rename(id) {
        const li = $(`#bookmark_list .bookmark[data-id="${id}"]`);
        const b = bookmarks.find(x => x.id === id);
        if (!li || !b) return;
        const input = el('input', 'bookmark_name');
        input.value = b.title || '';
        input.placeholder = b.place.label;
        input.setAttribute('aria-label', 'Bookmark name');
        const done = save => {
            if (save) Store.saveItem({ id, title: input.value.trim() });
            renderBookmarks();
        };
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); done(true); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
        });
        input.addEventListener('blur', () => done(true));
        li.replaceChildren(input);
        input.focus();
        input.select();
    }

    function openList(open = true) {
        $('#bookmark_list_box').hidden = !open;
        sheetOnPhone($('#bookmark_list_box'), open);
        $('#bookmarks_btn').setAttribute('aria-expanded', open);
        if (open) current().then(place => { $('#bookmark_here').textContent = place ? `+ Bookmark where I am (${place.label})` : '+ Bookmark where I am'; });
    }

    // ---- 📝 summary pad ----

    let padTimer = null;
    function openPad(open = true) {
        const pad = $('#summary_pad');
        pad.hidden = !open;
        $('#summary_btn').setAttribute('aria-pressed', open);
        if (!open) return savePad();
        $('#summary_pad_text').value = summaryOf(source);
        $('#summary_pad_state').textContent = '';
        $('#summary_pad_text').focus();
    }

    function savePad() {
        clearTimeout(padTimer);
        const text = $('#summary_pad_text').value.trim();
        if (text === summaryOf(source).trim()) return;
        Store.saveItem({ id: source.id, summary: text });
        source.summary = text;
        $('#summary_pad_state').textContent = 'Saved';
        // the summary on the side shows it too (unless you're editing it there)
        const field = $('.md_field[data-field="summary"]');
        if ($('.md_edit', field).hidden) renderMarkdown($('.md', field), PaperLinks.withLinks(text, projectSources(), project.citeStyle || 'apa'), 'Nothing written yet.');
    }

    // where you are, or the words you selected, into the summary
    async function insertIntoPad(kind) {
        const area = $('#summary_pad_text');
        let text = '';
        if (kind === 'place') {
            const place = await current();
            if (!place) return;
            text = `(${place.label})`;
        } else {
            const selected = (paperDoc()?.getSelection()?.toString() || getSelection().toString()).replace(/\s+/g, ' ').trim();
            if (!selected) return toast('Select some words in the material first.');
            const place = await current();
            text = `\n> ${selected}${place ? ` (${place.label})` : ''}\n\n`;
        }
        area.focus();
        area.setRangeText(text, area.selectionStart, area.selectionEnd, 'end');
        area.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // ---- wiring ----

    function setup() {
        renderBookmarks();
        // where you are: noted every few seconds while it changes, and when you leave
        setInterval(keep, SAVE_EVERY);
        const leave = () => { keep.leaving = true; keep(); keep.leaving = false; };
        addEventListener('pagehide', leave);
        document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); });
        resume();

        $('#bookmarks_btn').onclick = () => openList($('#bookmark_list_box').hidden);
        $('#bookmark_here').onclick = () => { addBookmark(); openList(false); };
        $('#bookmark_list').addEventListener('click', e => {
            const li = e.target.closest('.bookmark');
            if (!li) return;
            const b = bookmarks.find(x => x.id === li.dataset.id);
            if (e.target.closest('.bookmark_rename')) return rename(b.id);
            if (e.target.closest('.bookmark_delete')) {
                Store.deleteItem(b.id);
                return renderBookmarks();
            }
            if (e.target.closest('.bookmark_go')) {
                openList(false);
                if (!available.includes(b.place.view)) return toast(`This bookmark is in the ${b.place.view.toUpperCase()} version, which isn't available now.`);
                go(b.place);
            }
        });
        document.addEventListener('click', e => {
            const path = e.composedPath();
            if (!path.includes($('#bookmarks_menu')) && !path.includes($('#bookmark_list_box'))) openList(false); // (a sheet on phones)
        });

        $('#summary_btn').onclick = () => openPad($('#summary_pad').hidden);
        $('#summary_pad_close').onclick = () => openPad(false);
        $('#summary_pad_text').addEventListener('input', () => {
            $('#summary_pad_state').textContent = 'Editing…';
            clearTimeout(padTimer);
            padTimer = setTimeout(savePad, 800);
        });
        $('#summary_pad_place').onclick = () => insertIntoPad('place');
        $('#summary_pad_quote').onclick = () => insertIntoPad('quote');
        // (mousedown keeps the selection in the material while the button is pressed)
        for (const id of ['#summary_pad_place', '#summary_pad_quote']) $(id).addEventListener('mousedown', e => e.preventDefault());
        MdBar.attach($('#summary_pad_text'));
        MdImages.enable($('#summary_pad_text'));
        CitePicker.attach($('#summary_pad_text'), projectSources);
        addEventListener('pagehide', savePad);

        // B: bookmark this place (not while typing)
        document.addEventListener('keydown', e => {
            if (e.key.toLowerCase() !== 'b' || e.ctrlKey || e.metaKey || e.altKey || !$('#modals').hidden) return;
            if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
            e.preventDefault();
            addBookmark();
        });
    }

    return { setup, current, go, renderBookmarks, markBookmarks, keep };
})();

// Material page: the app's own right-click menu in the reader (HTML paper, PDF, pasted text), in place of the
// browser's. Shift + right-click (or a right-click on a link or in a text box) still gives the browser's menu.
// It acts on what you selected or, with nothing selected, on what you right-clicked (the paragraph or line, or the
// sentence / word in those modes): add a note, highlight or underline it in a colour, copy it (with its citation),
// bookmark, capture, save a picture as a figure.
// Uses material.js (targetAt, selectionTarget, attachTo, openComposer, saveMarkAt, lastColor, captureArea,
// saveFeature, project, source…); loaded before it, so nothing here runs until material.js calls ReaderMenu.watch.

const ReaderMenu = (() => {
    let menu = null;
    let state = null; // { target, text, img, color } for the menu that's open

    // with a finger, a long press selects words: leave that alone
    const isMouse = e => (e.pointerType ? e.pointerType === 'mouse' : !matchMedia('(pointer: coarse)').matches);

    // `area`: the element (or the paper's document) to listen on; `doc`: the document it's in
    function watch(area, doc) {
        area.addEventListener('contextmenu', e => {
            if (e.shiftKey || !isMouse(e) || e.target.closest('a[href], input, textarea, select, [contenteditable="true"]')) return;
            e.preventDefault();
            // the paper's frame reports points inside it: move them to the page
            const frame = doc === document ? null : $('#reader_html');
            const r = frame?.getBoundingClientRect() || { left: 0, top: 0 };
            open(e, doc, e.clientX + r.left, e.clientY + r.top);
        });
        if (doc !== document) {
            doc.addEventListener('pointerdown', e => { if (e.button !== 2) close(); });
            doc.addEventListener('scroll', close, { passive: true });
        }
    }

    function open(e, doc, x, y) {
        const selected = selectionTarget(doc);
        // nothing selected: what's under the pointer, in the sentence / word mode if that's on, else the paragraph or line
        const target = selected || targetAt(e, doc, attachMode === 'sentence' || attachMode === 'word' ? attachMode : 'block')
            || targetAt(e, doc, 'block');
        const img = doc !== document ? e.target.closest('img.ltx_graphics') : null;
        const text = String(doc.getSelection()).trim() || target?.quote || '';
        state = { target, text, img, color: lastColor, doc };
        lastPointer = { x, y };
        render();
        place(x, y);
    }

    const item = (act, label, hint = '') => {
        const btn = el('button', 'menu_item', label);
        btn.type = 'button';
        btn.dataset.act = act;
        btn.setAttribute('role', 'menuitem');
        if (hint) btn.append(el('small', '', hint));
        return btn;
    };

    function render() {
        if (!menu) {
            menu = el('div', 'reader_menu');
            menu.setAttribute('role', 'menu');
            menu.hidden = true;
            menu.addEventListener('click', onClick);
            menu.addEventListener('contextmenu', e => e.preventDefault());
            document.body.append(menu);
        }
        const { target, text, img } = state;
        const parts = [];
        if (target) {
            const what = target.start !== undefined && target.start !== '' ? 'the words'
                : target.anchor ? (target.where || 'the paragraph') : target.line ? `line ${target.line}` : 'it';
            const quote = (target.quote || '').replace(/\s+/g, ' ').trim();
            parts.push(el('p', 'menu_head', quote ? '“' + (quote.length > 60 ? quote.slice(0, 60) + '…' : quote) + '”' : what));
            const noted = notesAt(target).length;
            parts.push(item('note', noted ? (noted > 1 ? `Open its notes (${noted})` : 'Open its note') : 'Add a note…', 'N'));
            // the colour the marks below use (the one you used last to start with)
            const dots = el('div', 'menu_colors');
            dots.setAttribute('role', 'radiogroup');
            dots.setAttribute('aria-label', 'Colour');
            for (const c of [{ id: '', label: 'No colour', hex: '' }, ...NoteColors.of(project)]) {
                const dot = el('button', 'menu_color');
                dot.type = 'button';
                dot.dataset.color = c.id;
                dot.title = c.label;
                dot.setAttribute('role', 'radio');
                dot.setAttribute('aria-checked', state.color === c.id);
                dot.append(NoteColors.dot(c.hex || 'transparent'));
                dots.append(dot);
            }
            parts.push(dots, item('highlight', 'Highlight', 'H'), item('underline', 'Underline', 'U'), item('both', 'Highlight and underline', '⇧H'));
            parts.push(el('hr'));
        }
        if (text) parts.push(item('copy', 'Copy'), item('cite', 'Copy with citation'));
        if (img) parts.push(item('figure', 'Save picture as figure…'));
        if (PassMode.canMark(target)) parts.push(item('section', 'Mark as a section heading'));
        parts.push(item('bookmark', 'Bookmark where I am', 'B'), item('capture', 'Capture part of the page…'));
        parts.push(el('p', 'menu_foot', "Shift + right-click: the browser's menu"));
        menu.replaceChildren(...parts);
        for (const node of $$('hr', menu)) if (!node.nextElementSibling || node.nextElementSibling.matches('hr')) node.remove();
    }

    // next to the pointer, kept on screen
    function place(x, y) {
        menu.hidden = false;
        const { width, height } = menu.getBoundingClientRect();
        menu.style.left = Math.max(8, Math.min(x, innerWidth - width - 8)) + 'px';
        menu.style.top = Math.max(8, y + height > innerHeight - 8 ? y - height : y) + 'px';
        $('.menu_item', menu)?.focus({ preventScroll: true });
    }

    function close() {
        if (menu && !menu.hidden) menu.hidden = true;
    }

    // "the words" (p. 3) by the paper's citation in the project's style
    function withCitation(text, target) {
        const locator = target?.page ? 'p. ' + target.page : '';
        return `“${text}” ${Cite.parenthetical([{ source, locator, n: 1 }], project.citeStyle || 'apa')}`;
    }

    async function onClick(e) {
        const dot = e.target.closest('.menu_color');
        if (dot) {
            state.color = dot.dataset.color;
            for (const d of $$('.menu_color', menu)) d.setAttribute('aria-checked', d === dot);
            return;
        }
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (!act) return;
        const { target, text, img, color, doc } = state;
        close();
        // marked or noted: the selection has done its job
        if (['note', 'highlight', 'underline', 'both'].includes(act)) doc.getSelection()?.removeAllRanges();
        if (act === 'note') {
            openAt(target); // its note, if it has one
        } else if (act === 'highlight' || act === 'underline' || act === 'both') {
            saveMarkAt(target, act, color);
            toast(act === 'highlight' ? 'Highlighted.' : act === 'underline' ? 'Underlined.' : 'Highlighted and underlined.');
        } else if (act === 'copy') {
            toast((await copyText(text)) ? 'Copied.' : "Couldn't copy.");
        } else if (act === 'cite') {
            toast((await copyText(withCitation(text, target))) ? 'Copied with its citation.' : "Couldn't copy.");
        } else if (act === 'figure') saveFeature(img);
        else if (act === 'bookmark') Places.addBookmark();
        else if (act === 'capture') captureArea();
        else if (act === 'section') PassMode.markSection(target);
    }

    // keys while it's open: Esc closes, arrows move, N adds a note
    document.addEventListener('keydown', e => {
        if (!menu || menu.hidden) return;
        if (e.key === 'Escape') {
            e.stopPropagation();
            close();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const items = $$('.menu_item', menu);
            const i = items.indexOf(document.activeElement);
            items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
        } else if (/^[nhu]$/i.test(e.key) && state.target) {
            // N note, H highlight, U underline (Shift: both)
            e.preventDefault();
            e.stopPropagation();
            const key = e.key.toLowerCase();
            $(`[data-act="${key === 'n' ? 'note' : e.shiftKey ? 'both' : key === 'h' ? 'highlight' : 'underline'}"]`, menu)?.click();
        }
    }, true);
    document.addEventListener('pointerdown', e => { if (menu && !menu.contains(e.target)) close(); });
    addEventListener('scroll', close, { passive: true });
    addEventListener('resize', close);

    return { watch, close };
})();

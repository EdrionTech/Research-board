// Formatting for Markdown text boxes: bold, italic, lists, quote, link, undo and redo.
// Phones and tablets have no Ctrl + B, so MdBar.attach(textarea) puts a row of buttons above a text box
// (notes, summaries). The edits are also used by the review's own toolbar in Markdown mode.
// Edits go through the browser's insertText, so they can be undone like typing.
//
// Two ways to write in each box, switched at the end of the bar (the choice is kept for every box):
//   Visual   - on the formatted text, as it will show (like the review's Visual mode)
//   Markdown - the text itself
// The textarea is always what gets saved: Visual writes into it as you type (Turndown turns the formatted text
// back into Markdown), and setting its value (a note opened to edit, a cleared form) redraws the Visual box.
// Visual needs marked, DOMPurify and Turndown (src/vendor); without them the box stays Markdown.
// Citations ([@key, p. 4], @key) show in Visual as finished chips, "(Vaswani et al., 2017, p. 4)", when the box
// knows the papers (CitePicker.attach gives it area.rbCiteText); they're saved as you'd type them.
// Link opens a small form for the link's words and its address (and edits a link the cursor is in).

// Afterwards: text you had selected stays selected (so bold and italic can be stacked); if you were just typing,
// the cursor goes where you'd carry on (after "- ", between ** and **), never over text already written.

const MdBar = (() => {
    // Replaces start..end with text, then selects selStart..selEnd (offsets from start)
    function replace(area, start, end, text, selStart = text.length, selEnd = selStart) {
        area.focus();
        area.setSelectionRange(start, end);
        // insertText keeps the browser's undo history and fires `input`; fall back where it's missing
        if (!document.execCommand('insertText', false, text)) {
            area.setRangeText(text, start, end, 'end');
            area.dispatchEvent(new Event('input', { bubbles: true }));
        }
        area.setSelectionRange(start + selStart, start + selEnd);
    }

    // **bold** / _italic_ around the selection, or an empty pair with the cursor inside
    function wrap(area, mark) {
        const { selectionStart: start, selectionEnd: end, value } = area;
        const inner = value.slice(start, end);
        // already wrapped: unwrap
        if (value.slice(start - mark.length, start) === mark && value.slice(end, end + mark.length) === mark) {
            return replace(area, start - mark.length, end + mark.length, inner, 0, inner.length);
        }
        replace(area, start, end, mark + inner + mark, mark.length, mark.length + inner.length);
    }

    // Toggles a line prefix ("## ", "- ", "1. ", "> ") on the selected lines
    function prefix(area, mark) {
        const { value } = area;
        const start = value.lastIndexOf('\n', area.selectionStart - 1) + 1;
        let end = value.indexOf('\n', area.selectionEnd);
        if (end < 0) end = value.length;
        const lines = value.slice(start, end).split('\n');
        const has = line => (mark === '1. ' ? /^\d+\.\s/.test(line) : line.startsWith(mark));
        const all = lines.every(has);
        const bareOf = line => line.replace(/^(#{1,6}|[-*>]|\d+\.)\s+/, '');
        const out = lines.map((line, i) => {
            const bare = bareOf(line);
            if (all) return bare;
            return (mark === '1. ' ? `${i + 1}. ` : mark) + bare;
        }).join('\n');
        if (area.selectionStart !== area.selectionEnd) return replace(area, start, end, out, 0, out.length);
        // just typing (one line): the cursor stays in the same place in your words, past the new prefix
        const bare = bareOf(lines[0]).length;
        const before = lines[0].length - bare;
        const after = out.length - bare;
        replace(area, start, end, out, Math.max(after, area.selectionStart - start - before + after));
    }

    // ---- Link: a small form for the link's words and its address ----
    let linkBox = null;

    // words for a link from its address alone: "example.org › docs › getting started"
    function linkWords(url) {
        try {
            const u = new URL(url);
            const parts = u.pathname.split('/').filter(Boolean).slice(-2)
                .map(part => decodeURIComponent(part).replace(/\.(html?|php|aspx?)$/i, '').replace(/[-_+]+/g, ' ').trim()).filter(Boolean);
            return [u.hostname.replace(/^www\./, ''), ...parts].join(' › ');
        } catch { return ''; }
    }
    // the page's own title, when the site lets the app read it (many don't from a browser: then null)
    async function pageTitle(url) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
            if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return null;
            const title = new DOMParser().parseFromString(await res.text(), 'text/html').querySelector('title')?.textContent;
            return title?.replace(/\s+/g, ' ').trim() || null;
        } catch { return null; }
    }
    const looksLikeUrl = text => /^https?:\/\/\S+$/i.test(text.trim());

    function linkForm(anchor, { text = '', url = '' }) {
        if (!linkBox) {
            linkBox = document.createElement('form');
            linkBox.className = 'composer link_form';
            linkBox.innerHTML = `<label>Address <input name="url" inputmode="url" placeholder="Paste or type the address: https://…" autocomplete="off" spellcheck="false"></label>
                <label>Text <input name="text" placeholder="Filled in from the address, or your own words" autocomplete="off"></label>
                <div class="actions"><span class="spacer"></span><button type="button" class="btn small" data-act="cancel">Cancel</button>
                <button type="submit" class="btn small primary">Add link</button></div>`;
            linkBox.hidden = true;
            document.body.append(linkBox);
        }
        const form = linkBox;
        form.elements.text.value = text;
        form.elements.url.value = url;
        // with no words of your own, they follow the address: readable at once, the page's title if it can be read
        let auto = !text;
        let asked = '';
        form.elements.text.oninput = () => { auto = !form.elements.text.value; };
        form.elements.url.oninput = () => {
            const address = form.elements.url.value.trim();
            if (!auto) return;
            form.elements.text.value = looksLikeUrl(address) ? linkWords(address) : '';
            if (!looksLikeUrl(address) || address === asked) return;
            asked = address;
            pageTitle(address).then(title => {
                if (title && auto && form.elements.url.value.trim() === address) form.elements.text.value = title;
            });
        };
        form.querySelector('[type="submit"]').textContent = url ? 'Save link' : 'Add link';
        form.hidden = false;
        // under the formatting bar, inside the screen
        const r = anchor.getBoundingClientRect();
        const width = Math.min(340, innerWidth - 16);
        form.style.width = width + 'px';
        form.style.left = Math.max(8, Math.min(r.left, innerWidth - width - 8)) + 'px';
        form.style.top = Math.min(r.bottom + 6, innerHeight - form.offsetHeight - 8) + 'px';
        form.elements.url.focus();
        form.elements.url.select();
        return new Promise(resolve => {
            const done = value => {
                form.hidden = true;
                form.onsubmit = form.onkeydown = null;
                form.querySelector('[data-act="cancel"]').onclick = null;
                resolve(value);
            };
            form.onsubmit = e => {
                e.preventDefault();
                let url = form.elements.url.value.trim();
                if (!url) return form.elements.url.focus();
                if (!/^[a-z][\w+.-]*:/i.test(url)) url = 'https://' + url; // "example.org" -> https://example.org
                done({ text: form.elements.text.value.trim() || url, url });
            };
            form.querySelector('[data-act="cancel"]').onclick = () => done(null);
            form.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); } };
        });
    }

    // [words](address) in place of the selection (or at the cursor)
    async function link(area) {
        const { selectionStart: start, selectionEnd: end, value } = area;
        const picked = await linkForm(area.previousElementSibling?.classList.contains('md_bar') ? area.previousElementSibling : area, { text: value.slice(start, end) });
        if (!picked) return area.focus();
        replace(area, start, end, `[${picked.text}](${picked.url})`);
    }

    function history(area, command) {
        area.focus();
        document.execCommand(command);
    }

    // keys: with Ctrl (⌘ on a Mac); `code` for the Shift + number ones, which type other characters
    const BUTTONS = [
        { act: 'bold', label: 'B', title: 'Bold', key: 'b', run: a => wrap(a, '**') },
        { act: 'italic', label: 'I', title: 'Italic', key: 'i', run: a => wrap(a, '_') },
        { act: 'list', label: '• List', title: 'Bullet list', shift: true, code: 'Digit8', keyLabel: '8', run: a => prefix(a, '- ') },
        { act: 'numbered', label: '1. List', title: 'Numbered list', shift: true, code: 'Digit7', keyLabel: '7', run: a => prefix(a, '1. ') },
        { act: 'quote', label: '❝', title: 'Quote', shift: true, code: 'Digit9', keyLabel: '9', run: a => prefix(a, '> ') },
        { act: 'link', label: 'Link', title: 'Link', key: 'k', run: link },
        { act: 'undo', label: '↶', title: 'Undo', keyLabel: 'Z', run: a => history(a, 'undo') },
        { act: 'redo', label: '↷', title: 'Redo', keyLabel: 'Y', run: a => history(a, 'redo') },
        // pages that load writing/sketch.js: draw or handwrite into the text
        { act: 'draw', label: '✎ Draw', title: 'Draw or handwrite (pen, finger or mouse)', shift: true, key: 'd', run: a => Sketch.draw(a), when: () => typeof Sketch !== 'undefined' },
    ];
    const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const shortcut = b => {
        const k = b.keyLabel || b.key?.toUpperCase();
        return k ? `${MAC ? '⌘' : 'Ctrl + '}${b.shift ? (MAC ? '⇧' : 'Shift + ') : ''}${k}` : '';
    };

    // the keys, in a text box with the bar (undo and redo are the browser's own)
    function onKey(area, e) {
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.isComposing) return;
        const key = e.key.toLowerCase();
        const b = BUTTONS.find(b => (b.key || b.code) && !!b.shift === e.shiftKey && (b.code ? e.code === b.code : key === b.key) && (!b.when || b.when()));
        if (!b) return;
        e.preventDefault();
        b.run(area);
    }

    // ---- Visual: writing on the formatted text ----

    const MODE_KEY = 'research_board_md_mode';
    let mode = (() => { try { return localStorage.getItem(MODE_KEY) || 'visual'; } catch { return 'visual'; } })();
    const canVisual = () => !!(window.TurndownService && window.marked && window.DOMPurify);
    const boxes = new Set(); // every attached text box on the page: a switch in one switches them all
    const VALUE = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    const FOCUS = HTMLTextAreaElement.prototype.focus;

    let turndown = null;
    function toMarkdown(box) {
        if (!turndown) {
            turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '_', strongDelimiter: '**', codeBlockStyle: 'fenced' });
            turndown.escape = text => text; // what you typed stays as typed: [@key] citations, asterisks, brackets
            turndown.addRule('lineBreak', { filter: 'br', replacement: () => '\n' }); // (marked shows single line breaks)
            turndown.addRule('assetImage', {
                filter: node => node.nodeName === 'IMG' && !!node.dataset.asset,
                replacement: (content, node) => `![${node.alt || ''}](asset:${node.dataset.asset})`,
            });
            turndown.addRule('listItem', { // "- item" rather than Turndown's "-   item"
                filter: 'li',
                replacement(content, node, options) {
                    content = content.replace(/^\n+/, '').replace(/\n+$/, '\n').replace(/\n/gm, '\n  ');
                    const list = node.parentNode;
                    let prefix = options.bulletListMarker + ' ';
                    if (list.nodeName === 'OL') prefix = (Number(list.getAttribute('start') || 1) + [...list.children].indexOf(node)) + '. ';
                    return prefix + content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '');
                },
            });
            turndown.addRule('citation', { // a citation chip: what you typed, [@key, p. 4] or @key
                filter: node => node.nodeName === 'SPAN' && node.classList.contains('cite') && !!node.dataset.cite,
                replacement: (content, node) => node.dataset.cite,
            });
            turndown.keep(['table']);
        }
        // (the browser types a space before formatting as a non-breaking one: back to a plain space)
        return turndown.turndown(box).replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    }

    // the formatting buttons, on the formatted text
    const inQuote = () => {
        const node = getSelection().anchorNode;
        return !!(node && (node.nodeType === 1 ? node : node.parentElement).closest('blockquote'));
    };
    const VISUAL_RUN = {
        bold: () => document.execCommand('bold'),
        italic: () => document.execCommand('italic'),
        list: () => document.execCommand('insertUnorderedList'),
        numbered: () => document.execCommand('insertOrderedList'),
        quote: () => document.execCommand('formatBlock', false, inQuote() ? 'p' : 'blockquote'),
        link: visualLink,
        undo: () => document.execCommand('undo'),
        redo: () => document.execCommand('redo'),
    };

    // in Visual: the words selected (or the link the cursor is in), then the form, then the link put in
    async function visualLink(box, bar) {
        const sel = getSelection();
        if (!sel.rangeCount || !box.contains(sel.anchorNode)) return;
        const range = sel.getRangeAt(0).cloneRange();
        const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
        const existing = node.closest('a');
        const picked = await linkForm(bar, existing ? { text: existing.textContent, url: existing.getAttribute('href') } : { text: range.toString() });
        box.focus();
        if (!picked) return;
        const a = existing || document.createElement('a');
        a.href = picked.url;
        a.textContent = picked.text;
        if (!existing) {
            range.deleteContents();
            range.insertNode(a);
        }
        const after = document.createRange();
        after.setStartAfter(a);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
        box.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function setMode(next) {
        if (next === 'visual' && !canVisual()) return;
        mode = next;
        try { localStorage.setItem(MODE_KEY, mode); } catch { }
        for (const area of boxes) area.rbShow();
    }

    function addVisual(area, bar) {
        const box = document.createElement('div');
        box.className = 'md md_visual';
        box.contentEditable = 'true';
        box.spellcheck = true;
        box.setAttribute('role', 'textbox');
        box.setAttribute('aria-multiline', 'true');
        box.setAttribute('aria-label', area.getAttribute('aria-label') || area.placeholder || 'Text');
        area.after(box);
        area.rbVisual = box;
        const visual = () => mode === 'visual' && canVisual();

        let syncing = false;
        let timer = null;
        // a citation as a chip: its finished text, what you typed kept in data-cite (and given back on saving)
        area.rbMakeChip = raw => {
            const chip = document.createElement('span');
            chip.className = 'cite';
            chip.dataset.cite = raw;
            chip.contentEditable = 'false';
            chip.textContent = area.rbCiteText?.(raw) || raw;
            return chip;
        };
        const draw = () => {
            let text = VALUE.get.call(area);
            // the citations the box knows become placeholders, swapped for chips once the rest is formatted
            const cites = [];
            if (area.rbCiteText) {
                const hold = raw => (area.rbCiteText(raw) ? `RBCITE${cites.push(raw) - 1}X` : raw);
                text = text.replace(/\[@[^\]]+\](?!\()/g, hold).replace(/(^|[^\w@\[\]/])(@[\w:.-]*\w)/g, (whole, before, raw) => before + hold(raw));
            }
            box.innerHTML = text.trim() ? DOMPurify.sanitize(marked.parse(text.replace(/\]\(asset:([a-z0-9]+)\)/gi, '](#asset-$1)'))) : '';
            if (cites.length) {
                const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
                const found = [];
                while (walker.nextNode()) if (/RBCITE\d+X/.test(walker.currentNode.data)) found.push(walker.currentNode);
                for (const node of found) {
                    const parts = node.data.split(/(RBCITE\d+X)/);
                    node.replaceWith(...parts.map(part => {
                        const m = part.match(/^RBCITE(\d+)X$/);
                        return m ? area.rbMakeChip(cites[Number(m[1])]) : document.createTextNode(part);
                    }));
                }
            }
            if (typeof loadAssetImages === 'function') loadAssetImages(box);
        };
        // Visual -> the textarea (and everything listening to it: saving, previews)
        const sync = () => {
            clearTimeout(timer);
            timer = null;
            syncing = true;
            VALUE.set.call(area, toMarkdown(box));
            area.rbFromVisual = true; // (the @ citation picker leaves these alone: it works in Markdown)
            area.dispatchEvent(new Event('input', { bubbles: true }));
            area.rbFromVisual = false;
            syncing = false;
        };
        area.rbFlush = () => { if (timer) sync(); };

        // the value set from code (a note opened to edit, a cleared form): drawn again
        Object.defineProperty(area, 'value', {
            configurable: true,
            get() { return VALUE.get.call(this); },
            set(text) { VALUE.set.call(this, text); if (!syncing && visual()) draw(); },
        });
        area.addEventListener('input', () => { if (!syncing && visual()) draw(); }); // an image added, a drawing
        area.form?.addEventListener('reset', () => setTimeout(() => visual() && draw()));
        // focus() from the page's code goes to whichever box shows, the cursor at the end
        area.focus = function (options) {
            if (!visual() || box.hidden) return FOCUS.call(this, options);
            box.focus(options);
            const range = document.createRange();
            range.selectNodeContents(box);
            range.collapse(false);
            getSelection().removeAllRanges();
            getSelection().addRange(range);
        };

        box.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(sync, 250);
        });
        box.addEventListener('blur', () => area.rbFlush());
        // a citation chip is one piece: the cursor never stays inside it (what you'd type there would be lost),
        // it goes just after it
        // (as you click and before each key too, not only when the browser reports it a moment later)
        const outOfChip = () => {
            const sel = getSelection();
            if (!sel.rangeCount || !box.contains(sel.anchorNode)) return;
            const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
            const chip = node?.closest('.cite');
            if (!chip || !box.contains(chip)) return;
            if (!chip.nextSibling || chip.nextSibling.nodeType !== Node.TEXT_NODE) chip.after(document.createTextNode('\u00a0'));
            const range = document.createRange();
            range.setStart(chip.nextSibling, chip.nextSibling.data.startsWith('\u00a0') || chip.nextSibling.data.startsWith(' ') ? 1 : 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        };
        document.addEventListener('selectionchange', outOfChip);
        box.addEventListener('mouseup', outOfChip);
        box.addEventListener('keydown', outOfChip, true);
        // keys with Ctrl / ⌘ (save with Ctrl + Enter…): the textarea is brought up to date first, then they go on
        // to the form as usual; Ctrl + B, I, lists… format here
        box.addEventListener('keydown', e => {
            if (!(e.ctrlKey || e.metaKey) || e.altKey || e.isComposing) return;
            const key = e.key.toLowerCase();
            const b = BUTTONS.find(b => (b.key || b.code) && !!b.shift === e.shiftKey && (b.code ? e.code === b.code : key === b.key) && (!b.when || b.when()));
            if (b && VISUAL_RUN[b.act]) {
                e.preventDefault();
                VISUAL_RUN[b.act](box, bar);
                return;
            }
            area.rbFlush();
        });
        // pasting: plain words (no colours or fonts from where they came from); images are stored as in Markdown
        box.addEventListener('paste', e => {
            const files = [...(e.clipboardData?.files || [])];
            e.preventDefault();
            if (files.some(f => f.type.startsWith('image/')) && typeof MdImages !== 'undefined') {
                area.rbFlush();
                area.setSelectionRange(VALUE.get.call(area).length, VALUE.get.call(area).length); // (it goes at the end)
                MdImages.insert(area, files);
                return;
            }
            const pasted = e.clipboardData?.getData('text/plain') || '';
            // a web address on its own: a link, its words from the address (the page's title once it's read)
            if (looksLikeUrl(pasted) && getSelection().rangeCount) {
                const url = pasted.trim();
                const range = getSelection().getRangeAt(0);
                const a = document.createElement('a');
                a.href = url;
                a.textContent = range.toString() || linkWords(url) || url;
                const own = !!range.toString();
                range.deleteContents();
                range.insertNode(a);
                range.setStartAfter(a);
                range.collapse(true);
                getSelection().removeAllRanges();
                getSelection().addRange(range);
                box.dispatchEvent(new Event('input', { bubbles: true }));
                if (!own) pageTitle(url).then(title => {
                    if (title && a.isConnected) { a.textContent = title; box.dispatchEvent(new Event('input', { bubbles: true })); }
                });
                return;
            }
            document.execCommand('insertText', false, pasted);
        });
        new MutationObserver(() => { box.dataset.placeholder = area.placeholder; })
            .observe(area, { attributes: true, attributeFilter: ['placeholder'] });
        box.dataset.placeholder = area.placeholder;

        // which of the two shows (and the bar's switch)
        area.rbShow = () => {
            const on = visual();
            if (on) draw(); else area.rbFlush();
            area.classList.toggle('md_source_off', on);
            box.hidden = area.hidden || !on;
            for (const btn of bar.querySelectorAll('.md_mode button')) btn.setAttribute('aria-pressed', btn.dataset.mode === mode);
        };
    }

    // A bar of buttons right above the text box (once per box)
    function attach(area) {
        if (!area || area.previousElementSibling?.classList.contains('md_bar')) return;
        const bar = document.createElement('div');
        bar.className = 'md_bar';
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute('aria-label', 'Formatting');
        for (const b of BUTTONS) {
            const { act, label, when } = b;
            if (when && !when()) continue;
            const title = b.title + (shortcut(b) ? ` (${shortcut(b)})` : '');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.act = act;
            btn.textContent = label;
            btn.title = title;
            btn.setAttribute('aria-label', title);
            bar.append(btn);
        }
        // Visual / Markdown, at the end of the bar
        if (canVisual()) {
            const switcher = document.createElement('span');
            switcher.className = 'md_mode';
            switcher.setAttribute('role', 'group');
            switcher.setAttribute('aria-label', 'Write on');
            for (const [value, label, title] of [['visual', 'Visual', 'Write on the formatted text'], ['markdown', 'Markdown', 'Write the Markdown itself']]) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.dataset.mode = value;
                btn.textContent = label;
                btn.title = title;
                switcher.append(btn);
            }
            bar.append(switcher);
        }
        // keep the text box focused (and the phone keyboard open) when a button is pressed
        bar.addEventListener('mousedown', e => e.preventDefault());
        bar.addEventListener('click', e => {
            const pick = e.target.closest('.md_mode button');
            if (pick) return setMode(pick.dataset.mode);
            const btn = e.target.closest('button[data-act]');
            if (!btn) return;
            const visualOn = area.rbVisual && !area.rbVisual.hidden;
            if (visualOn && VISUAL_RUN[btn.dataset.act]) {
                if (!area.rbVisual.contains(getSelection().anchorNode)) area.focus();
                VISUAL_RUN[btn.dataset.act](area.rbVisual, bar);
                return;
            }
            if (visualOn) area.rbFlush(); // (drawing works on the Markdown, then shows here)
            BUTTONS.find(b => b.act === btn.dataset.act).run(area);
        });
        area.before(bar);
        area.addEventListener('keydown', e => onKey(area, e));
        if (canVisual()) {
            addVisual(area, bar);
            boxes.add(area);
        }
        // hidden with its box (e.g. the optional answer field)
        const sync = () => {
            bar.hidden = area.hidden;
            area.rbShow?.();
        };
        new MutationObserver(sync).observe(area, { attributes: true, attributeFilter: ['hidden'] });
        sync();
    }

    // before reading a box's text yourself (e.g. on Save): what was just typed in Visual is in it
    const flush = area => area?.rbFlush?.();

    return { attach, wrap, prefix, link, replace, keys: onKey, flush };
})();

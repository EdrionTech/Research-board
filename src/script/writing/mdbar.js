// Formatting for Markdown text boxes: bold, italic, lists, quote, link, undo and redo.
// Phones and tablets have no Ctrl + B, so MdBar.attach(textarea) puts a row of buttons above a text box
// (notes, summaries). The edits are also used by the review's own toolbar in Markdown mode.
// Edits go through the browser's insertText, so they can be undone like typing.

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

    // [selected text](https://) with the address selected, ready to paste over; with nothing selected,
    // [](https://) with the cursor where the link's words go
    function link(area) {
        const { selectionStart: start, selectionEnd: end, value } = area;
        const text = value.slice(start, end);
        const md = `[${text}](https://)`;
        if (text) replace(area, start, end, md, text.length + 3, md.length - 1);
        else replace(area, start, end, md, 1);
    }

    function history(area, command) {
        area.focus();
        document.execCommand(command);
    }

    const BUTTONS = [
        { act: 'bold', label: 'B', title: 'Bold', run: a => wrap(a, '**') },
        { act: 'italic', label: 'I', title: 'Italic', run: a => wrap(a, '_') },
        { act: 'list', label: '• List', title: 'Bullet list', run: a => prefix(a, '- ') },
        { act: 'numbered', label: '1. List', title: 'Numbered list', run: a => prefix(a, '1. ') },
        { act: 'quote', label: '❝', title: 'Quote', run: a => prefix(a, '> ') },
        { act: 'link', label: 'Link', title: 'Link', run: link },
        { act: 'undo', label: '↶', title: 'Undo', run: a => history(a, 'undo') },
        { act: 'redo', label: '↷', title: 'Redo', run: a => history(a, 'redo') },
    ];

    // A bar of buttons right above the text box (once per box)
    function attach(area) {
        if (!area || area.previousElementSibling?.classList.contains('md_bar')) return;
        const bar = document.createElement('div');
        bar.className = 'md_bar';
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute('aria-label', 'Formatting');
        for (const { act, label, title } of BUTTONS) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.act = act;
            btn.textContent = label;
            btn.title = title;
            btn.setAttribute('aria-label', title);
            bar.append(btn);
        }
        // keep the text box focused (and the phone keyboard open) when a button is pressed
        bar.addEventListener('mousedown', e => e.preventDefault());
        bar.addEventListener('click', e => {
            const btn = e.target.closest('button[data-act]');
            if (btn) BUTTONS.find(b => b.act === btn.dataset.act).run(area);
        });
        area.before(bar);
        // hidden with its box (e.g. the optional answer field)
        const sync = () => { bar.hidden = area.hidden; };
        new MutationObserver(sync).observe(area, { attributes: true, attributeFilter: ['hidden'] });
        sync();
    }

    return { attach, wrap, prefix, link, replace };
})();

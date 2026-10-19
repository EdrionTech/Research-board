// Formatting for Markdown text boxes: bold, italic, lists, quote, link, undo and redo.
// Phones and tablets have no Ctrl + B, so MdBar.attach(textarea) puts a row of buttons above a text box
// (notes, summaries). The edits are also used by the review's own toolbar in Markdown mode.
// Edits go through the browser's insertText, so they can be undone like typing.

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

    // **bold** / _italic_ around the selection (or around "text" to type over)
    function wrap(area, mark, placeholder = 'text') {
        const { selectionStart: start, selectionEnd: end, value } = area;
        const inner = value.slice(start, end);
        // already wrapped: unwrap
        if (value.slice(start - mark.length, start) === mark && value.slice(end, end + mark.length) === mark) {
            return replace(area, start - mark.length, end + mark.length, inner, 0, inner.length);
        }
        const text = inner || placeholder;
        replace(area, start, end, mark + text + mark, mark.length, mark.length + text.length);
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
        const out = lines.map((line, i) => {
            const bare = line.replace(/^(#{1,6}|[-*>]|\d+\.)\s+/, '');
            if (all) return bare;
            return (mark === '1. ' ? `${i + 1}. ` : mark) + bare;
        }).join('\n');
        replace(area, start, end, out, 0, out.length);
    }

    // [selected text](https://) with the address selected, ready to type or paste over
    function link(area) {
        const { selectionStart: start, selectionEnd: end, value } = area;
        const text = value.slice(start, end) || 'link';
        const md = `[${text}](https://)`;
        replace(area, start, end, md, text.length + 3, md.length - 1);
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

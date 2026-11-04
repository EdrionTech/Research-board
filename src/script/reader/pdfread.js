// Read mode for PDFs: the text of the pages reflowed as a plain readable page (headings and paragraphs, at any
// text size) instead of the printed pages. Built from the lines Reader.pageLines finds on each page
// ({ text, box: { x, y, w, h } as fractions of the page }), so nothing is read twice.
// Every paragraph keeps which page and lines it came from (data-page, data-lines "3-7"), so notes on the
// printed pages show here and notes made here show there. Pictures stay on the printed pages.

const PdfRead = (() => {
    const median = list => {
        const sorted = [...list].sort((a, b) => a - b);
        return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    };
    // running heads and footers: the same words (numbers aside) near the top or bottom of several pages
    const shape = text => text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
    const nearEdge = box => box.y < 0.08 || box.y + box.h > 0.92;

    function repeated(pages) {
        const counts = new Map();
        for (const lines of pages) {
            for (const s of new Set(lines.filter(l => nearEdge(l.box)).map(l => shape(l.text)))) counts.set(s, (counts.get(s) || 0) + 1);
        }
        const enough = Math.max(2, Math.ceil(pages.length * 0.4));
        return new Set([...counts].filter(([, n]) => n >= enough && pages.length >= 2).map(([s]) => s));
    }

    // "exam-" + "ple" -> "example"; otherwise lines join with a space
    const join = (text, next) => (/\p{L}-$/u.test(text) && /^\p{Ll}/u.test(next) ? text.slice(0, -1) + next : text + ' ' + next);

    // pages: [[{ text, box }]] (line n of page p is pages[p - 1][n - 1]).
    // -> [{ page, blocks: [{ kind: 'h2' | 'h3' | 'p', text, first, last }] }]
    function layout(pages) {
        const skip = repeated(pages);
        const all = pages.flat().filter(l => l.text.length > 2);
        const body = median(all.map(l => l.box.h)) || 0.015;

        return pages.map((lines, p) => {
            const blocks = [];
            let block = null;
            let prev = null;
            let right = 0; // where the paragraph's full lines end
            lines.forEach((line, i) => {
                const n = i + 1;
                const text = line.text.trim();
                const { box } = line;
                if (!text || /^\d{1,4}$/.test(text) || (nearEdge(box) && skip.has(shape(text)))) return;
                const tall = box.h > body * 1.18;
                const heading = tall && text.length < 110 && !/[.,;]$/.test(text) && /\p{L}/u.test(text);
                const kind = heading ? (box.h > body * 1.5 ? 'h2' : 'h3') : 'p';

                let fresh = !block || heading || block.kind !== 'p';
                if (!fresh && prev) {
                    const gap = box.y - (prev.box.y + prev.box.h);
                    const column = box.y < prev.box.y - body; // up the page again: the next column
                    const shortBefore = prev.box.x + prev.box.w < right - 0.06 && /[.!?:]["”’)]?$/.test(prev.text.trim());
                    const indented = box.x > prev.box.x + 0.012 && box.x - prev.box.x < 0.08 && /[.!?:]["”’)]?$/.test(prev.text.trim());
                    // a numbered reference, list item or bullet starts its own paragraph
                    const item = /^(\[\d{1,3}\]|\(?\d{1,3}[.)]\s|[•▪◦∙·–-]\s|\([a-z]\)\s)/.test(text);
                    fresh = gap > body * 0.8 || item || (!column && (shortBefore || indented)) || (column && /[.!?:]$/.test(prev.text.trim()));
                }
                if (fresh) {
                    block = { kind, text, first: n, last: n };
                    blocks.push(block);
                    right = box.x + box.w;
                } else {
                    block.text = join(block.text, text);
                    block.last = n;
                    right = Math.max(right, box.x + box.w);
                }
                // a heading is one line (two if it wraps at the same size)
                if (heading && prev && blocks.length > 1) {
                    const before = blocks.at(-2);
                    if (before.kind === kind && before.last === n - 1 && box.y - (prev.box.y + prev.box.h) < body * 0.6) {
                        before.text = join(before.text, text);
                        before.last = n;
                        blocks.pop();
                        block = before;
                    }
                }
                prev = line;
            });
            return { page: p + 1, blocks };
        });
    }

    // the read-mode page, as elements (the page number shows from CSS, so it isn't part of the text)
    function render(pages, container) {
        const laid = layout(pages);
        const words = laid.reduce((n, p) => n + p.blocks.length, 0);
        container.replaceChildren(...laid.map(({ page, blocks }) => {
            const section = document.createElement('section');
            section.className = 'read_page';
            section.dataset.page = page;
            for (const b of blocks) {
                const node = document.createElement(b.kind === 'p' ? 'p' : b.kind);
                node.className = b.kind === 'p' ? 'read_para' : 'read_para read_head';
                node.dataset.page = page;
                node.dataset.lines = b.first === b.last ? String(b.first) : `${b.first}-${b.last}`;
                node.textContent = b.text;
                section.append(node);
            }
            return section;
        }));
        return words > 0;
    }

    // the paragraph that holds line `line` of page `page`
    function blockAt(container, page, line) {
        const n = Number(line);
        return [...container.querySelectorAll(`.read_para[data-page="${page}"]`)].find(b => {
            const [first, last = first] = b.dataset.lines.split('-').map(Number);
            return n >= first && n <= last;
        }) || null;
    }

    const firstLine = block => block.dataset.lines.split('-')[0];

    return { layout, render, blockAt, firstLine };
})();

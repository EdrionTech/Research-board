// Text positions inside an element, used to attach notes to a sentence, phrase or word.
// Offsets count characters of the element's visible text (a line break counts as one space),
// and the quote is kept too, so a note can find its exact words again later.

const TextRange = (() => {
    // never part of the readable text: hidden maths source, arXiv conversion errors, line numbers
    const SKIP = 'annotation, annotation-xml, .ltx_ERROR.undefined, .num, script, style';

    // { text, nodes: [{ node, start }] } for the text inside `container`
    function map(container) {
        const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
            acceptNode(node) {
                if (node.nodeType !== Node.ELEMENT_NODE) return NodeFilter.FILTER_ACCEPT;
                if (node.matches(SKIP)) return NodeFilter.FILTER_REJECT;
                // a <br> or a new list line means a line break in the text
                return node.matches('br, li') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            },
        });
        let text = '';
        let lineBreak = false;
        const nodes = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                lineBreak = true;
                continue;
            }
            const value = node.nodeValue;
            if (lineBreak && text && !/\s$/.test(text) && !/^\s/.test(value)) text += ' ';
            lineBreak = false;
            nodes.push({ node, start: text.length });
            text += value;
        }
        return { text, nodes };
    }

    // character offset in map.text for a DOM point (node, offset)
    function offsetOf(m, node, offset) {
        const entry = m.nodes.find(e => e.node === node);
        if (entry) return entry.start + offset;
        // an element boundary or skipped text: use the next mapped text
        const point = node.ownerDocument.createRange();
        point.setStart(node, offset);
        for (const e of m.nodes) if (point.comparePoint(e.node, 0) >= 0) return e.start;
        return m.text.length;
    }

    // DOM Range covering map.text[start, end)
    function rangeOf(m, start, end) {
        if (!m.nodes.length) return null;
        const point = pos => {
            let entry = m.nodes[0];
            for (const e of m.nodes) {
                if (e.start > pos) break;
                entry = e;
            }
            return [entry.node, Math.min(pos - entry.start, entry.node.nodeValue.length)];
        };
        const range = m.nodes[0].node.ownerDocument.createRange();
        range.setStart(...point(start));
        range.setEnd(...point(end));
        return range;
    }

    // the text position under the pointer
    function caretAt(doc, x, y) {
        if (doc.caretPositionFromPoint) {
            const p = doc.caretPositionFromPoint(x, y);
            return p && { node: p.offsetNode, offset: p.offset };
        }
        if (doc.caretRangeFromPoint) {
            const r = doc.caretRangeFromPoint(x, y);
            return r && { node: r.startContainer, offset: r.startOffset };
        }
        return null;
    }

    // the sentence or word around `offset`: { start, end } or null
    function segmentAt(text, offset, granularity) {
        if (!window.Intl?.Segmenter || !text) return null;
        const segment = new Intl.Segmenter(undefined, { granularity })
            .segment(text).containing(Math.min(offset, text.length - 1));
        if (!segment || (granularity === 'word' && !segment.isWordLike)) return null;
        return trim(text, segment.index, segment.index + segment.segment.length);
    }

    function trim(text, start, end) {
        while (start < end && /\s/.test(text[start])) start++;
        while (end > start && /\s/.test(text[end - 1])) end--;
        return end > start ? { start, end } : null;
    }

    // find a saved range again: trust the offsets if the text still matches, else search for the quote
    function locate(m, start, end, quote) {
        if (!quote) return null;
        if (m.text.slice(start, end) === quote) return { start, end };
        const i = m.text.indexOf(quote);
        return i >= 0 ? { start: i, end: i + quote.length } : null;
    }

    return { map, offsetOf, rangeOf, caretAt, segmentAt, trim, locate };
})();

// Papers referenced in your notes, of any kind: general notes (inbox, ideas, summaries, findings…), notes on a
// paper, highlights, a paper's summary and review. A note references a paper two ways: explicitly
// (note.sourceIds, from "+ Link a paper" on the dashboard) or by citing it in its text: [@key], [@a; @b, p. 4]
// or @key (the same citations as the literature review; type @ in a note box to pick one: citepicker.js).
// Used by the dashboard's note popup (linking, previews), notes as they're shown (withLinks) and a paper's
// page ("In your notes").

const PaperLinks = (() => {
    // item types that are your own general notes (not sources, notes on a source, the review, figures, bookmarks)
    const OWN = new Set(['source', 'source_note', 'lit_review', 'figure', 'bookmark']);
    const isGeneralNote = item => !OWN.has(item.type);

    // the citation keys a text uses
    function citedKeys(text) {
        return new Set([...(text || '').matchAll(/(?:^|[^\w@\[\]])@([\w:.-]*\w)|\[@([^\]]+)\]/g)].flatMap(m => (m[1]
            ? [m[1]]
            : m[2].split(';').map(part => part.trim().match(/^@?([\w:.-]*\w)/)?.[1]).filter(Boolean))));
    }

    // the papers a note is about: linked, then cited (sources need their citekeys: assignCitekeys)
    function papersOf(note, sources) {
        const keys = citedKeys(note.body);
        const ids = new Set(note.sourceIds || []);
        return sources.filter(s => ids.has(s.id) || (s.citekey && keys.has(s.citekey)));
    }

    // the general notes about a paper
    function notesAbout(source, items) {
        return items.filter(i => isGeneralNote(i) && (i.sourceIds?.includes(source.id) || (source.citekey && citedKeys(i.body).has(source.citekey))));
    }

    // Everything else that cites a paper: notes and highlights on other papers, other papers' summaries and
    // reviews. [{ item, on (the paper it's on), kind: 'note' | 'summary' | 'review', text }]
    function mentionsOf(source, items) {
        if (!source.citekey) return [];
        const cites = text => citedKeys(text).has(source.citekey);
        const papers = new Map(items.filter(i => i.type === 'source').map(s => [s.id, s]));
        const found = [];
        for (const item of items) {
            if (item.type === 'source_note' && item.sourceId !== source.id && (cites(item.body) || cites(item.answer))) {
                found.push({ item, on: papers.get(item.sourceId), kind: 'note', text: item.body || item.quote || '' });
            }
            if (item.type === 'source' && item.id !== source.id) {
                for (const kind of ['summary', 'review']) {
                    const text = kind === 'summary' ? summaryOf(item) : item.review;
                    if (cites(text)) found.push({ item, on: item, kind, text });
                }
            }
        }
        return found;
    }

    // A note's text for a one-line preview: citations as "(Vaswani et al., 2017)", Markdown marks and images gone
    function preview(text, sources, style = 'apa') {
        const byKey = new Map(sources.filter(s => s.citekey).map(s => [s.citekey, s]));
        return (text || '')
            .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
            .replace(/\[@([^\]]+)\]/g, (whole, inner) => {
                const items = inner.split(';').map(part => {
                    const m = part.trim().match(/^@?([\w:.-]*\w)\s*,?\s*(.*)$/);
                    const source = m && byKey.get(m[1]);
                    return source && { source, locator: m[2] };
                });
                return items.every(Boolean) ? Cite.parenthetical(items, style) : whole;
            })
            .replace(/(^|[^\w@\[\]])@([\w:.-]*\w)/g, (whole, before, key) => (byKey.has(key) ? before + Cite.narrative({ source: byKey.get(key) }, style) : whole))
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/[#*_>`]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // A note's Markdown with its citations as links to the papers: [@vaswani2017attention, p. 4] reads
    // "(Vaswani et al., 2017, p. 4)" and opens the paper. Several in one [ … ] link each name. Unknown keys stay.
    function withLinks(text, sources, style = 'apa') {
        const byKey = new Map(sources.filter(s => s.citekey).map(s => [s.citekey, s]));
        const href = source => 'material.html?id=' + encodeURIComponent(source.id);
        const label = text => text.replace(/[[\]]/g, '');
        return (text || '')
            .replace(/\[@([^\]]+)\](?!\()/g, (whole, inner) => {
                const items = inner.split(';').map(part => {
                    const m = part.trim().match(/^@?([\w:.-]*\w)\s*,?\s*(.*)$/);
                    const source = m && byKey.get(m[1]);
                    return source && { source, locator: m[2] };
                });
                if (!items.every(Boolean)) return whole;
                if (items.length === 1) return `[${label(Cite.parenthetical(items, style))}](${href(items[0].source)})`;
                // (Vaswani et al., 2017; He, 2026): each name its own link
                const parts = items.map(item => `[${label(Cite.parenthetical([item], style).replace(/^\(|\)$/g, ''))}](${href(item.source)})`);
                return '(' + parts.join('; ') + ')';
            })
            .replace(/(^|[^\w@\[\]/])@([\w:.-]*\w)/g, (whole, before, key) => (byKey.has(key)
                ? `${before}[${label(Cite.narrative({ source: byKey.get(key) }, style))}](${href(byKey.get(key))})`
                : whole));
    }

    return { isGeneralNote, citedKeys, papersOf, notesAbout, mentionsOf, preview, withLinks };
})();

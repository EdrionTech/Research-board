// Papers linked to your general notes (inbox, ideas, notes, summaries, findings…).
// A note links a paper two ways: explicitly (note.sourceIds, from "+ Link a paper") or by citing it in its
// text: [@key], [@a; @b, p. 4] or @key (the same citations as the literature review).
// Used by the note popup on the dashboard (linking, previews) and a paper's page ("In your notes").

const PaperLinks = (() => {
    // item types that are your own general notes (not sources, notes on a source, the review or figures)
    const OWN = new Set(['source', 'source_note', 'lit_review', 'figure']);
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

    return { isGeneralNote, citedKeys, papersOf, notesAbout, preview };
})();

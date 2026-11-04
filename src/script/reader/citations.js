// In-text citations in a paper's text (PDF pages, pasted text), matched to the paper's own reference list
// (source.references, sources/references.js), so clicking "[12]" or "(Smith et al., 2020)" opens that reference.
//   numbered:    [12]  [3, 5]  [5–7]  [2; 9]
//   author–year: (Smith, 2020)  (Smith & Lee, 2019; Doe et al., 2021a)  Smith et al. (2020)  (Smith, 2020, p. 4)
// find(text, refs) -> [{ start, end, n }]: each citation's own span (one per reference in a group, so "[3, 5]"
// gives two), and the n of the reference it's in the list as. Only citations that match a reference are kept.
// The arXiv HTML version links its citations itself (material.js reads those links).

const Citations = (() => {
    const norm = text => (text || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

    // numbered references by their number; author–year ones by "surname year" (the first author's, and the year)
    function index(refs) {
        const byN = new Map(refs.map(r => [String(r.n), r]));
        const authorYear = refs.map(r => {
            const t = norm(r.text);
            const year = t.match(/\b(1[89]|20)\d{2}[a-z]?\b/)?.[0] || '';
            return { ref: r, head: t.slice(0, 120), year };
        });
        return { byN, authorYear };
    }

    // "Smith et al." / "Smith and Lee" / "van der Berg" + "2020a" -> the reference whose authors start that way
    function byAuthorYear({ authorYear }, who, year) {
        const surname = norm(who).replace(/\bet al\.?|\b(and|&)\b.*$/g, '').replace(/[^a-z\s'-]/g, ' ').trim().split(/\s+/).pop();
        if (!surname || surname.length < 2) return null;
        const y = norm(year);
        const hits = authorYear.filter(a => a.head.includes(surname) && (a.year === y || a.year.slice(0, 4) === y.slice(0, 4)));
        // "2020a" and "2020b": the exact one if the list says so, else the first
        return (hits.find(a => a.year === y) || hits[0])?.ref || null;
    }

    function find(text, refs) {
        if (!text || !refs?.length) return [];
        const idx = index(refs);
        const out = [];

        // [12], [3, 5–7]: each number (or range) its own span
        for (const m of text.matchAll(/\[(\d{1,3}(?:\s*[-–,;]\s*\d{1,3})*)\]/g)) {
            const inner = m[1];
            const base = m.index + 1;
            for (const part of inner.matchAll(/(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/g)) {
                const first = Number(part[1]);
                const last = part[2] ? Number(part[2]) : first;
                if (last < first || last - first > 50) continue;
                const n = [...Array(last - first + 1)].map((_, i) => String(first + i)).find(k => idx.byN.has(k));
                if (n) out.push({ start: base + part.index, end: base + part.index + part[0].length, n: idx.byN.get(n).n });
            }
        }

        // (Smith, 2020; Lee & Doe, 2019a, p. 4): each "who, year" in the brackets
        for (const m of text.matchAll(/\(([^()]{4,300}?)\)/g)) {
            const base = m.index + 1;
            let offset = 0;
            for (const piece of m[1].split(';')) {
                const at = m[1].indexOf(piece, offset);
                offset = at + piece.length;
                const cite = piece.match(/^\s*(?:e\.g\.,?\s*|see\s+|cf\.\s*)?([\p{Lu}][\p{L}'’\- ]*?(?:\s+et al\.?|\s+(?:and|&)\s+[\p{Lu}][\p{L}'’\-]+)?),?\s+((?:1[89]|20)\d{2}[a-z]?)\b/u);
                if (!cite) continue;
                const ref = byAuthorYear(idx, cite[1], cite[2]);
                if (ref) {
                    const lead = piece.length - piece.trimStart().length;
                    out.push({ start: base + at + lead, end: base + at + piece.trimEnd().length, n: ref.n });
                }
            }
        }

        // Smith et al. (2020): the name before the brackets, the year inside
        for (const m of text.matchAll(/([\p{Lu}][\p{L}'’\-]+(?:\s+et al\.?|\s+(?:and|&)\s+[\p{Lu}][\p{L}'’\-]+)?)\s+\(((?:1[89]|20)\d{2}[a-z]?)(?:,[^)]*)?\)/gu)) {
            const ref = byAuthorYear(idx, m[1], m[2]);
            if (ref && !out.some(c => c.start < m.index + m[0].length && c.end > m.index)) out.push({ start: m.index, end: m.index + m[0].length, n: ref.n });
        }
        return out.sort((a, b) => a.start - b.start);
    }

    return { find };
})();

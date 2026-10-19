// A paper's own reference list: the works it cites ("subreferences").
// - read from the arXiv HTML version (exact: one item per reference) or from the PDF's References section
// - each reference's text is split into authors, title, year and venue with simple rules
// - matched against the project's sources (DOI, arXiv id or title), so "already in your project" shows
// - looked up to add one: its DOI / arXiv id if the reference has one, else a Crossref bibliographic search
//   (checked against the reference's own words before it's trusted), then OpenAlex for details and an open PDF
// A reference is { n, text, doi?, arxiv?, url?, sourceId? }; sourceId is the project source made from it.

const References = (() => {
    const norm = text => (text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ').trim();
    const findDoiIn = text => findDoi(text || '');
    // "arXiv:1607.06450", "arXiv preprint arXiv:…", "CoRR, abs/1409.0473" (arXiv's ids in DBLP references)
    const findArxivIn = text => (text || '').match(/arxiv[:\s.]*(?:abs\/)?(\d{4}\.\d{4,5})/i)?.[1]
        || (text || '').match(/\bcorr\b,?\s*abs\/(\d{4}\.\d{4,5})/i)?.[1] || null;

    // ---- reading the list ----

    // arXiv HTML: <li class="ltx_bibitem"> with a [n] tag and blocks of text
    function fromHtml(doc) {
        return [...doc.querySelectorAll('.ltx_bibliography .ltx_bibitem')].map((item, i) => {
            const tag = item.querySelector('.ltx_tag_bibitem')?.textContent.replace(/[\[\]\s]/g, '');
            const text = [...item.querySelectorAll('.ltx_bibblock')].map(b => b.textContent.trim()).join(' ')
                .replace(/\s+/g, ' ').trim() || item.textContent.replace(/\s+/g, ' ').trim();
            const hrefs = [...item.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
            return withIds({ n: tag || String(i + 1), text }, hrefs);
        }).filter(r => r.text.length > 10);
    }

    // PDF: the lines after a "References" heading, split into references by their numbering
    // ([1], 1.) or, for author–year lists, where a new "Surname, I." starts after a full stop.
    function fromPdfLines(pages) {
        const lines = pages.flat().map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
        const start = lines.findLastIndex(t => /^(\d+\.?\s*)?(references|bibliography|works cited|literature cited)$/i.test(t));
        if (start < 0) return [];
        const body = [];
        for (const line of lines.slice(start + 1)) {
            if (/^(appendix|supplementary material|appendices)\b/i.test(line) && body.length > 3) break;
            if (/^\d{1,4}$/.test(line)) continue; // a page number
            body.push(line);
        }
        const bracket = /^\[(\d+)\]\s*/;
        const numbered = /^(\d{1,3})\.\s+(?=[A-Z])/;
        const style = body.filter(l => bracket.test(l)).length >= 3 ? bracket : body.filter(l => numbered.test(l)).length >= 3 ? numbered : null;
        const refs = [];
        for (const line of body) {
            const m = style && line.match(style);
            const newAuthorYear = !style && /^\p{Lu}[\p{L}'’-]+,\s+(\p{Lu}\.|\p{Lu}[\p{L}]+)/u.test(line) && (!refs.length || /[.)]$/.test(refs.at(-1).text));
            if (m) refs.push({ n: m[1], text: line.slice(m[0].length) });
            else if (newAuthorYear || !refs.length) refs.push({ n: String(refs.length + 1), text: line });
            else refs.at(-1).text += (/-$/.test(refs.at(-1).text) ? '' : ' ') + line; // a reference wraps onto the next line
        }
        return refs.filter(r => r.text.length > 15 && /\b(19|20)\d{2}\b/.test(r.text)).map(r => withIds(r, []));
    }

    function withIds(ref, hrefs) {
        const all = [ref.text, ...hrefs].join(' ');
        const arxiv = findArxivIn(all) || hrefs.map(h => findArxivId(h)).find(Boolean) || null;
        const doi = arxiv ? null : findDoiIn(all);
        const url = hrefs.find(h => /^https?:\/\//.test(h) && !/arxiv\.org\/html\/.*#/.test(h)) || '';
        return { ...ref, ...(doi ? { doi } : {}), ...(arxiv ? { arxiv } : {}), ...(url ? { url } : {}) };
    }

    // ---- splitting one reference into fields ----

    // "D. Mellinger, A. Kushleyev, and V. Kumar, “Title,” in Venue, May 2012, pp. 477–483."
    // "Jimmy Lei Ba, … and Geoffrey E Hinton. Layer normalization. arXiv preprint arXiv:1607.06450, 2016."
    // "Vaswani, A., Shazeer, N. (2017). Attention is all you need. In NeurIPS."
    function parse(text) {
        const t = text.replace(/\s+/g, ' ').trim();
        const year = [...t.matchAll(/\b((?:19|20)\d{2})[a-z]?\b/g)].map(m => m[1]).at(-1) || '';
        let authors = '', title = '', venue = '';
        const quoted = t.match(/[“"]([^”"]{8,})[”"]/);
        const apa = t.match(/^(.+?)\s*\(((?:19|20)\d{2})[a-z]?\)\.?\s+(.+)$/);
        if (quoted) {
            authors = t.slice(0, quoted.index);
            title = quoted[1];
            venue = t.slice(quoted.index + quoted[0].length);
        } else if (apa) {
            authors = apa[1];
            [title, venue = ''] = splitSentences(apa[3]);
        } else {
            [authors, title = '', venue = ''] = splitSentences(t);
        }
        title = title.replace(/[,.\s]+$/, '');
        venue = venue.replace(/^[,.\s]*(in:?\s+)?/i, '').replace(/,?\s*(pp?\.|pages)\s*[\d–-]+.*$/i, '')
            .replace(/,\s*((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*)?(19|20)\d{2}[a-z]?\.?\s*$/i, '').replace(/[,.\s]+$/, '');
        return { authors: authorsFrom(authors), title, published: year, venue };
    }

    // sentences, but not at initials ("D. Mellinger") or "et al." mid-list
    function splitSentences(text) {
        return text.split(/(?<!\b\p{Lu})(?<!\bet al)\.\s+(?=[\p{L}\d“"])/u).map(s => s.trim()).filter(Boolean);
    }

    function authorsFrom(text) {
        const parts = text.replace(/,?\s*et al\.?/i, '').replace(/[,.\s]+$/, '')
            .split(/\s*,\s*(?:and\s+|&\s*)?|\s+and\s+|\s*&\s*/).map(s => s.trim()).filter(Boolean);
        const names = [];
        for (const part of parts) {
            // "Vaswani, A." comes split in two: the initials belong to the surname before them
            if (/^(\p{Lu}\.?\s*-?)+$/u.test(part) && names.length && !/\s/.test(names.at(-1))) names[names.length - 1] = part.replace(/(\p{Lu})(?!\.)/gu, '$1.') + ' ' + names.at(-1);
            else names.push(part);
        }
        return names.filter(n => /\p{L}{2,}/u.test(n) && n.split(' ').length <= 5).slice(0, 30).map(splitName);
    }

    // ---- already in the project? ----

    const titleOf = ref => parse(ref.text).title;

    function match(ref, sources) {
        const doi = ref.doi?.toLowerCase();
        const words = norm(ref.text);
        return sources.find(s =>
            (doi && s.doi?.toLowerCase() === doi) ||
            (ref.arxiv && arxivIdOf(s) === ref.arxiv) ||
            (norm(s.title).length >= 15 && words.includes(norm(s.title)))) || null;
    }

    // ---- finding the paper ----

    // how many of the found title's words are in the reference (1 = all of them)
    function overlap(foundTitle, text) {
        const words = norm(foundTitle).split(' ').filter(w => w.length > 2);
        const ref = new Set(norm(text).split(' '));
        return words.length ? words.filter(w => ref.has(w)).length / words.length : 0;
    }

    // { doi, venue } of the work the reference describes (Crossref's venue names read better for proceedings)
    async function crossrefSearch(text) {
        const url = 'https://api.crossref.org/works?rows=3&select=DOI,title,container-title,score&query.bibliographic=' + encodeURIComponent(text.slice(0, 400));
        const res = await fetch(url);
        if (!res.ok) return null;
        const items = (await res.json()).message?.items || [];
        const hit = items.find(item => overlap(item.title?.[0], text) >= 0.85);
        return hit ? { doi: hit.DOI, venue: hit['container-title']?.[0] || '' } : null;
    }

    async function openAlexSearch(title, text) {
        if (!title) return null;
        const res = await fetch('https://api.openalex.org/works?per-page=3&search=' + encodeURIComponent(title));
        if (!res.ok) return null;
        const hit = ((await res.json()).results || []).find(w => overlap(w.title, text) >= 0.85);
        return hit?.doi?.replace(/^https?:\/\/doi\.org\//i, '') || null;
    }

    // The source fields for a reference: { fields, found } — found = details came from a catalogue
    // (otherwise the fields are what the reference's own text says, to check and complete by hand).
    async function lookup(ref) {
        const parsed = parse(ref.text);
        try {
            if (ref.arxiv) {
                const fields = await lookupMaterial('arXiv:' + ref.arxiv);
                if (fields?.title) return { fields, found: true };
            }
            const crossref = ref.doi ? null : await crossrefSearch(ref.text);
            const doi = ref.doi || crossref?.doi || await openAlexSearch(parsed.title, ref.text);
            if (doi) {
                const fields = await fromOpenAlex(doi) ?? await fromCrossref(doi);
                if (fields?.title) {
                    return { fields: { ...fields, venue: crossref?.venue || fields.venue, url: fields.url || 'https://doi.org/' + doi }, found: true };
                }
            }
        } catch { /* offline or blocked: use the reference's own text */ }
        return { fields: { ...parsed, kind: 'article', url: ref.url || '' }, found: false };
    }

    const scholarUrl = ref => 'https://scholar.google.com/scholar?q=' + encodeURIComponent(titleOf(ref) || ref.text.slice(0, 200));

    return { fromHtml, fromPdfLines, parse, match, lookup, scholarUrl, titleOf };
})();

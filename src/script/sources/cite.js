// A source as a reference in common citation styles (plain text, ready to paste).

const Cite = (() => {
    const STYLES = { apa: 'APA 7', mla: 'MLA 9', harvard: 'Harvard', ieee: 'IEEE', bibtex: 'BibTeX' };
    // styles with in-text citations (a project's default citation style is one of these)
    const INLINE_STYLES = { apa: 'APA 7', mla: 'MLA 9', harvard: 'Harvard', ieee: 'IEEE' };

    const initials = (first, spaced = true) => (first || '').split(/[\s.-]+/).filter(Boolean)
        .map(part => part[0].toUpperCase() + '.').join(spaced ? ' ' : '');
    const full = a => [a.firstName, a.lastName].filter(Boolean).join(' ');
    const inverted = a => [a.lastName, a.firstName].filter(Boolean).join(', ');
    const period = text => text && !/[.?!]$/.test(text) ? text + '.' : text;
    // "A and B", "A, B and C" (oxford: "A, B, and C")
    const joinNames = (names, word, oxford) => names.length < 3 ? names.join(` ${word} `)
        : `${names.slice(0, -1).join(', ')}${oxford ? ',' : ''} ${word} ${names.at(-1)}`;

    function parts(source) {
        return {
            authors: (source.authors || []).filter(a => a.lastName || a.firstName),
            year: (source.published || '').slice(0, 4) || 'n.d.',
            title: (source.title || 'Untitled').trim(),
            venue: (source.venue || '').trim(),
            link: source.doi ? 'https://doi.org/' + source.doi : source.url || '',
        };
    }

    // ---- videos: the channel is the author, the site is the "publisher" ----
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dateParts = published => (published || '').split('-').map(Number);

    function video(source, style) {
        const { authors, year, title, venue } = parts(source);
        const channel = authors.map(full).join(', ');
        const site = venue || 'YouTube';
        const url = source.url || '';
        const [y, m, d] = dateParts(source.published);
        if (style === 'apa') {
            const date = y ? [y, m ? MONTHS[m - 1] + (d ? ' ' + d : '') : ''].filter(Boolean).join(', ') : 'n.d.';
            return [period(channel), `(${date}).`, `${title} [Video].`, period(site), url].filter(Boolean).join(' ');
        }
        if (style === 'mla') {
            const date = y ? [d, m ? MONTHS[m - 1].slice(0, 3) + '.' : '', y].filter(Boolean).join(' ') : '';
            return [`“${period(title)}”`, `${site},${channel ? ` uploaded by ${channel},` : ''}`, period([date, url.replace(/^https?:\/\//, '')].filter(Boolean).join(', '))].join(' ');
        }
        if (style === 'harvard') return [channel, `(${year})`, `${title} [Video].`, url ? `Available at: ${url}.` : ''].filter(Boolean).join(' ');
        if (style === 'ieee') return `${channel ? channel + ', ' : ''}“${title},” ${site}, ${year}. [Online video]. Available: ${url}`;
        const key = source.citekey || ((channel.toLowerCase().match(/[a-z0-9]+/g) || ['video']).join('').slice(0, 20)
            + year.replace(/\D/g, '') + ((title.toLowerCase().match(/[a-z0-9]+/g) || []).find(w => w.length > 3) || ''));
        const fields = [['title', `{${title}}`], ['author', channel && `{${channel}}`], ['year', year.replace(/\D/g, '')],
            ['howpublished', site], ['url', url], ['note', 'Video']].filter(([, value]) => value);
        return `@misc{${key},\n${fields.map(([name, value]) => `  ${name} = {${value}}`).join(',\n')}\n}`;
    }

    function apa(source) {
        const { authors, year, title, venue, link } = parts(source);
        const names = authors.map(a => [a.lastName, initials(a.firstName)].filter(Boolean).join(', '));
        const who = names.length > 20 ? [...names.slice(0, 19), '…', names.at(-1)].join(', ')
            : names.length > 1 ? `${names.slice(0, -1).join(', ')}, & ${names.at(-1)}` : names.join('');
        return [period(who), `(${year}).`, period(title), period(venue), link].filter(Boolean).join(' ');
    }

    function mla(source) {
        const { authors, year, title, venue, link } = parts(source);
        const who = authors.length === 1 ? inverted(authors[0])
            : authors.length === 2 ? `${inverted(authors[0])}, and ${full(authors[1])}`
            : authors.length > 2 ? `${inverted(authors[0])}, et al` : '';
        return [period(who), `“${period(title)}”`, period([venue, year].filter(Boolean).join(', ')),
            period(link.replace(/^https?:\/\//, ''))].filter(Boolean).join(' ');
    }

    function harvard(source) {
        const { authors, year, title, venue, link } = parts(source);
        const who = joinNames(authors.map(a => [a.lastName, initials(a.firstName, false)].filter(Boolean).join(', ')), 'and');
        return [who, `(${year})`, period(title), period(venue), link ? `Available at: ${link}.` : '']
            .filter(Boolean).join(' ');
    }

    function ieee(source) {
        const { authors, year, title, venue } = parts(source);
        const names = authors.map(a => [initials(a.firstName), a.lastName].filter(Boolean).join(' '));
        const who = names.length > 6 ? names[0] + ' et al.' : joinNames(names, 'and', true);
        const rest = [venue, year].filter(Boolean).join(', ') + (source.doi ? `, doi: ${source.doi}` : '');
        return `${who ? who + ', ' : ''}“${title},” ${period(rest)}`;
    }

    function bibtex(source) {
        const { authors, year, title, venue } = parts(source);
        const type = { article: 'article', book: 'book', chapter: 'incollection', report: 'techreport', thesis: 'phdthesis' }[source.kind] || 'misc';
        const venueField = { article: 'journal', chapter: 'booktitle', report: 'institution', thesis: 'school' }[source.kind] || 'publisher';
        const key = source.citekey || ((authors[0]?.lastName || 'source').toLowerCase().replace(/[^a-z0-9]/g, '')
            + year.replace(/\D/g, '')
            + ((title.toLowerCase().match(/[a-z0-9]+/g) || []).find(word => word.length > 3) || ''));
        const fields = [
            ['title', `{${title}}`],
            ['author', authors.map(inverted).join(' and ')],
            ['year', year.replace(/\D/g, '')],
            [venueField, venue],
            ['doi', source.doi],
            ['url', source.url],
        ].filter(([, value]) => value);
        return `@${type}{${key},\n${fields.map(([name, value]) => `  ${name} = {${value}}`).join(',\n')}\n}`;
    }

    const FORMATS = { apa, mla, harvard, ieee, bibtex };
    const format = (source, style) => source.kind === 'video'
        ? video(source, FORMATS[style] ? style : 'apa')
        : (FORMATS[style] || apa)(source);

    // ---- citations inside your own writing ----

    const inlineStyle = style => (INLINE_STYLES[style] ? style : 'apa');
    const shortTitle = title => {
        const words = title.split(/\s+/);
        return `“${words.length > 4 ? words.slice(0, 4).join(' ') + '…' : title}”`;
    };
    // "He", "Klein & Sompel" (APA) / "Klein and Sompel", "Vaswani et al."; no author: the title
    function names(source, style) {
        const { authors, title } = parts(source);
        const last = authors.map(a => a.lastName || a.firstName);
        if (!last.length) return shortTitle(title);
        if (last.length === 1) return last[0];
        if (last.length === 2) return `${last[0]} ${style === 'apa' ? '&' : 'and'} ${last[1]}`;
        return `${last[0]} et al.`;
    }
    const mlaLocator = locator => locator.replace(/^pp?\.\s*/i, '');

    // items: [{ source, locator, n }] -> "(Vaswani et al., 2017, p. 4; He, 2026)", "(Vaswani et al. 4)", "[1, p. 4], [2]"
    function parenthetical(items, style) {
        style = inlineStyle(style);
        if (style === 'ieee') return items.map(({ n, locator }) => `[${n}${locator ? ', ' + locator : ''}]`).join(', ');
        return `(${items.map(({ source, locator }) => style === 'mla'
            ? [names(source, style), locator && mlaLocator(locator)].filter(Boolean).join(' ')
            : [names(source, style), parts(source).year, locator].filter(Boolean).join(', ')).join('; ')})`;
    }

    // "Vaswani et al. (2017)", "Vaswani et al." (MLA), "Vaswani et al. [1]" (IEEE)
    function narrative({ source, locator, n }, style) {
        style = inlineStyle(style);
        const who = names(source, style);
        if (style === 'ieee') return `${who} [${n}${locator ? ', ' + locator : ''}]`;
        if (style === 'mla') return locator ? `${who} (${mlaLocator(locator)})` : who;
        return `${who} (${[parts(source).year, locator].filter(Boolean).join(', ')})`;
    }

    // The credit line under a figure or table you reuse (it also puts the source in the reference list).
    //   APA:     From "Title," by A. Vaswani, N. Shazeer, and N. Parmar, 2017, arXiv, p. 3 (https://doi.org/…).
    //   Harvard: Source: Vaswani et al. (2017, p. 3).      MLA: Source: Vaswani et al., "Title." arXiv, 2017, p. 3.
    //   IEEE:    Reprinted from [1], p. 3.
    // adapted: you cropped or changed it ("Adapted from …").
    function credit(source, style, { locator = '', adapted = false, n } = {}) {
        style = inlineStyle(style);
        const { authors, year, title, venue, link } = parts(source);
        if (style === 'ieee') return `${adapted ? 'Adapted' : 'Reprinted'} from [${n ?? '#'}]${locator ? ', ' + locator : ''}.`;
        if (style === 'apa') {
            const list = authors.map(a => [initials(a.firstName), a.lastName].filter(Boolean).join(' '));
            const by = list.length > 20 ? [...list.slice(0, 19), '…', list.at(-1)].join(', ')
                : list.length > 2 ? `${list.slice(0, -1).join(', ')}, and ${list.at(-1)}` : list.join(' and ');
            const titled = source.kind === 'video' ? `“${title}” [Video],` : `“${title},”`;
            return `${adapted ? 'Adapted from' : 'From'} ${titled}${by ? ` by ${by},` : ''} ${year}`
                + `${venue ? ', ' + venue : ''}${locator ? ', ' + locator : ''}${link ? ` (${link})` : ''}.`;
        }
        const who = names(source, style);
        if (style === 'harvard') return `Source: ${adapted ? 'adapted from ' : ''}${who} (${[year, locator].filter(Boolean).join(', ')}).`;
        return `Source: ${adapted ? 'adapted from ' : ''}${who}, “${period(title)}” ${[venue, year, locator].filter(Boolean).join(', ')}.`;
    }

    // reference list: numbered in order of first citation for IEEE, alphabetical by author otherwise
    function referenceList(sources, style) {
        style = inlineStyle(style);
        if (style === 'ieee') return sources.map((source, i) => `[${i + 1}] ${format(source, 'ieee')}`);
        const sortKey = source => (source.authors?.[0]?.lastName || source.title || '').toLowerCase();
        return [...sources]
            .sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || (a.published || '').localeCompare(b.published || ''))
            .map(source => format(source, style));
    }

    return { STYLES, INLINE_STYLES, format, parenthetical, narrative, credit, referenceList };
})();

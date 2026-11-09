// Filter by author (the Library, a project's Literature tab), beside the tag filter.
// A chip for each author worth one: anyone with two or more of the papers listed, and everyone on a paper with
// fewer than 10 authors. The rest (names found once, on big collaborations) share one chip, "Other authors".
// The search box still finds every author by name. Picking several chips shows the papers by any of them.
//   const filter = AuthorFilter.create(row, onChange)   row: an empty element; onChange: draw the list again
//   filter.render(sources)    the chips for these papers (before filtering with matches)
//   filter.matches(source)    by a chosen author? (true while none is chosen)
//   filter.selectWhere(fn)    choose just the authors fn(author) says yes to (the survey board's recurring authors)

const AuthorFilter = (() => {
    const OTHER = '~other';
    const MANY = 10; // a paper with this many authors or more is a big collaboration

    // one person however their name is written: "Lovelace, Ada", accents, dots and spacing aside
    const keyOf = author => authorName(author).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ').trim();
    const keysOf = source => [...new Set((source.authors || []).map(keyOf).filter(Boolean))];

    function create(row, onChange) {
        const active = new Set();
        let chipOf = new Map(); // author key -> the chip it's under (its own key, or OTHER)

        function render(sources) {
            lastSources = sources;
            const papers = new Map();  // author key -> how many of the papers they're on
            const names = new Map();   // author key -> { spelling: count }
            const small = new Set();   // authors on a paper with fewer than MANY authors
            for (const source of sources) {
                const keys = keysOf(source);
                for (const key of keys) papers.set(key, (papers.get(key) || 0) + 1);
                if (keys.length < MANY) for (const key of keys) small.add(key);
                for (const author of source.authors || []) {
                    const key = keyOf(author);
                    if (!key) continue;
                    const spellings = names.get(key) || new Map();
                    spellings.set(authorName(author), (spellings.get(authorName(author)) || 0) + 1);
                    names.set(key, spellings);
                }
            }
            chipOf = new Map([...papers.keys()].map(key => [key, papers.get(key) > 1 || small.has(key) ? key : OTHER]));

            // how many papers each chip shows
            const counts = new Map();
            for (const source of sources) {
                for (const chip of new Set(keysOf(source).map(key => chipOf.get(key)))) counts.set(chip, (counts.get(chip) || 0) + 1);
            }
            for (const key of active) if (!counts.has(key)) active.delete(key);

            const label = key => (key === OTHER ? 'Other authors' : [...names.get(key)].sort((a, b) => b[1] - a[1])[0][0]);
            const chips = [...counts.keys()]
                .sort((a, b) => (a === OTHER) - (b === OTHER) || counts.get(b) - counts.get(a) || label(a).localeCompare(label(b)))
                .map(key => {
                    const chip = el('button', 'tag_chip' + (active.has(key) ? ' active' : '') + (key === OTHER ? ' other_authors' : ''), `${label(key)} ${counts.get(key)}`);
                    chip.type = 'button';
                    chip.dataset.author = key;
                    chip.setAttribute('aria-pressed', active.has(key));
                    if (key === OTHER) chip.title = 'Papers by big teams (10 or more authors) whose authors have no other paper here';
                    return chip;
                });
            const clear = el('button', 'link author_clear', 'Clear');
            clear.type = 'button';
            clear.hidden = !active.size;
            fillFilterRow(row, 'Authors', chips, [clear]);
        }

        let lastSources = [];
        function selectWhere(fn) {
            active.clear();
            for (const source of lastSources) for (const author of source.authors || []) if (fn(author)) active.add(chipOf.get(keyOf(author)) ?? OTHER);
            onChange();
        }

        const matches = source => !active.size || keysOf(source).some(key => active.has(chipOf.get(key) ?? OTHER));

        row.addEventListener('click', e => {
            if (e.target.closest('.author_clear')) active.clear();
            else {
                const chip = e.target.closest('[data-author]');
                if (!chip) return;
                if (active.has(chip.dataset.author)) active.delete(chip.dataset.author);
                else active.add(chip.dataset.author);
            }
            onChange();
        });

        return { render, matches, selectWhere };
    }

    return { create };
})();

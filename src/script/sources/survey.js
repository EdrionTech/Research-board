// A literature survey in passes (S. Keshav, "How to Read a Paper", 2007, section 3), over a project's materials:
//   1 Seed papers: a few recent papers in the area, starred
//   2 A first pass on each seed (reading in passes: sources/passes.js)
//   3 Find the key papers: the works the seeds' references share, and the authors who keep coming up
//   4 Two passes on the key papers
// The board puts each material in a column by how far it's been read; nothing is dragged, cards move as you read.
// The seeds are kept on the project (surveySeeds: [sourceId]); a key paper added from here is a source with
// surveyKey: true and citedIn: the papers that cite it.

const Survey = (() => {
    const COLUMNS = [
        ['new', 'Not started'],
        ['p1', 'Pass 1'],
        ['p2', 'Pass 2'],
        ['p3', 'Pass 3'],
        ['stopped', 'Stopped or parked'],
        ['finished', 'Read in three passes'],
    ];

    // which column a material is in, from its passes record
    function column(record) {
        if (!record || (!record.on && !record.passes?.[1]?.activeMs && !record.passes?.[1]?.doneAt && (record.pass || 1) === 1)) return 'new';
        if (record.state === 'finished') return 'finished';
        if (record.state === 'stopped' || record.state === 'parked') return 'stopped';
        return 'p' + (record.pass || 1);
    }

    // had its first pass: pass 1 decided, or gone past it
    const firstPassDone = record => !!record && (!!record.passes?.[1]?.doneAt || (record.pass || 1) > 1 || record.state === 'finished');
    // at least two passes: pass 2 decided, or gone past it
    const twoPassesDone = record => !!record && (!!record.passes?.[2]?.doneAt || (record.pass || 1) > 2 || record.state === 'finished');

    // sourceId → its passes record
    const recordsOf = items => new Map(items.filter(i => i.type === 'passes').map(r => [r.sourceId, r]));

    // The four steps, each with how far along it is, and the one you're on (the first not done).
    function steps(sources, records, seeds, keys) {
        const seeded = sources.filter(s => seeds.includes(s.id));
        const seedsRead = seeded.filter(s => firstPassDone(records.get(s.id)));
        const keyPapers = sources.filter(s => s.surveyKey);
        const keysRead = keyPapers.filter(s => twoPassesDone(records.get(s.id)));
        const list = [
            { n: 1, title: 'Seed papers', hint: 'Star a few recent papers in the area (3 to 5 is plenty).',
                status: seeded.length ? `${seeded.length} starred` : 'none yet', done: seeded.length > 0 },
            { n: 2, title: 'A first pass on each', hint: 'Five to ten minutes each: the five Cs, then decide.',
                status: seeded.length ? `${seedsRead.length} of ${seeded.length}` : '', done: seeded.length > 0 && seedsRead.length === seeded.length },
            { n: 3, title: 'Find the key papers', hint: 'The works and authors their references share: add the ones that matter.',
                status: keyPapers.length ? `${keyPapers.length} added` : keys ? `${keys} found` : '', done: keyPapers.length > 0 },
            { n: 4, title: 'Two passes on the key papers', hint: 'Read the key papers to the content: pass 2.',
                status: keyPapers.length ? `${keysRead.length} of ${keyPapers.length}` : '', done: keyPapers.length > 0 && keysRead.length === keyPapers.length },
        ];
        const current = list.find(s => !s.done)?.n || 4;
        return { list, current };
    }

    // The key papers and authors: what the references of the papers you've had a first pass on have in common.
    // Works already in the project aren't suggested. → { pool: [source], papers: [{ key, ref, title, citers }],
    // authors: [{ name, citers }] }, most cited first; a work or author counts once per citing paper.
    function keyPapers(sources, records) {
        const pool = sources.filter(s => (s.references || []).length && firstPassDone(records.get(s.id)));
        const works = new Map();
        const authors = new Map();
        for (const source of pool) {
            const seenAuthors = new Set();
            for (const ref of source.references) {
                // (a work already in the project isn't suggested; its authors still count)
                const have = (ref.sourceId && sources.some(s => s.id === ref.sourceId)) || References.match(ref, sources);
                const key = !have && References.identity(ref);
                if (key) {
                    const work = works.get(key) || { key, ref, title: References.titleOf(ref) || ref.text.slice(0, 120), citers: new Set() };
                    work.citers.add(source.id);
                    if (ref.text.length > work.ref.text.length || (!work.ref.doi && ref.doi)) work.ref = ref; // the fullest copy
                    works.set(key, work);
                }
                for (const a of References.parse(ref.text).authors) {
                    const name = [a.firstName?.[0] ? a.firstName[0] + '.' : '', a.lastName].filter(Boolean).join(' ');
                    if (!a.lastName || a.lastName.length < 2 || seenAuthors.has(name)) continue;
                    seenAuthors.add(name);
                    const entry = authors.get(name) || { name, lastName: a.lastName, citers: new Set() };
                    entry.citers.add(source.id);
                    authors.set(name, entry);
                }
            }
        }
        const ranked = map => [...map.values()].map(v => ({ ...v, citers: [...v.citers] }))
            .filter(v => v.citers.length >= 2).sort((a, b) => b.citers.length - a.citers.length);
        return { pool, papers: ranked(works), authors: ranked(authors) };
    }

    return { COLUMNS, column, firstPassDone, twoPassesDone, recordsOf, steps, keyPapers };
})();

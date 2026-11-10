// A literature survey in passes (S. Keshav, "How to Read a Paper", 2007, section 3), over a project's materials:
//   1 Seed papers: a few recent papers in the area, starred
//   2 A first pass on each seed (reading in passes: sources/passes.js)
//   3 Find the key papers: the works the seeds' references share, and the authors who keep coming up
//   4 Two passes on the key papers
// The board puts each material in a column by how far it's been read; nothing is dragged, cards move as you read.
// The seeds are kept on the project (surveySeeds: [sourceId]), and the survey papers whose references you use
// (surveyFrom: [sourceId]); a key paper added from here is a source with surveyKey: true and citedIn: the papers
// that cite it. Beyond the references: the venues they cite most (each a click from its recent papers), and a search
// for papers to start from (both OpenAlex: sources/paper_search.js).

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

    // The key papers, authors and venues: what the references of the papers you've had a first pass on have in
    // common. Works already in the project aren't suggested (their authors and venues still count). A survey paper
    // you chose to use (surveys: [sourceId]) gives all its references, even those only it cites.
    // References you marked to follow up count too, cited by one paper or more.
    // → { pool: [source], papers: [{ key, ref, title, citers, fromSurvey, followUp }], authors: [{ name, citers }],
    //     venues: [{ key, label, search, cites, citers }] }, most cited first; a work or author counts once per
    //     citing paper, a venue once per reference.
    function keyPapers(sources, records, surveys = []) {
        const pool = sources.filter(s => (s.references || []).length && firstPassDone(records.get(s.id)));
        const works = new Map();
        const authors = new Map();
        const venues = new Map();
        for (const source of pool) {
            const seenAuthors = new Set();
            const survey = surveys.includes(source.id);
            for (const ref of source.references) {
                const parsed = References.parse(ref.text);
                const have = (ref.sourceId && sources.some(s => s.id === ref.sourceId)) || References.match(ref, sources);
                const key = !have && References.identity(ref);
                if (key) {
                    const work = works.get(key) || { key, ref, title: parsed.title || ref.text.slice(0, 120), citers: new Set(), fromSurvey: false };
                    work.citers.add(source.id);
                    if (survey) work.fromSurvey = true;
                    if (ref.followUp) work.followUp = true; // (you marked it on the paper: pass 2, or its References panel)
                    if (ref.text.length > work.ref.text.length || (!work.ref.doi && ref.doi)) work.ref = ref; // the fullest copy
                    works.set(key, work);
                }
                for (const a of parsed.authors) {
                    const name = [a.firstName?.[0] ? a.firstName[0] + '.' : '', a.lastName].filter(Boolean).join(' ');
                    if (!a.lastName || a.lastName.length < 2 || seenAuthors.has(name)) continue;
                    seenAuthors.add(name);
                    const entry = authors.get(name) || { name, lastName: a.lastName, citers: new Set() };
                    entry.citers.add(source.id);
                    authors.set(name, entry);
                }
                const venue = parsed.venue && venueOf(parsed.venue); // (only the venue part: a surname like Chi is no conference)
                if (venue) {
                    const entry = venues.get(venue.key) || { ...venue, cites: 0, citers: new Set() };
                    entry.cites++;
                    entry.citers.add(source.id);
                    venues.set(venue.key, entry);
                }
            }
        }
        const list = map => [...map.values()].map(v => ({ ...v, citers: [...v.citers] }));
        const byCiters = (a, b) => b.citers.length - a.citers.length;
        return {
            pool,
            papers: list(works).filter(w => w.citers.length >= 2 || w.fromSurvey || w.followUp).sort((a, b) => byCiters(a, b) || Number(b.fromSurvey) - Number(a.fromSurvey)),
            authors: list(authors).filter(a => a.citers.length >= 2).sort(byCiters),
            venues: list(venues).filter(v => v.cites >= 2).sort((a, b) => b.cites - a.cites || byCiters(a, b)),
        };
    }

    // ---- venues: the same conference or journal however a reference writes it ----

    // [pattern, short name, the name to search for it by]; the more specific first (EMNLP and NAACL before ACL)
    const VENUES = [
        [/neural information processing systems|\bneurips\b|\bnips\b/, 'NeurIPS', 'Neural Information Processing Systems'],
        [/international conference on machine learning|\bicml\b/, 'ICML', 'International Conference on Machine Learning'],
        [/international conference on learning representations|\biclr\b/, 'ICLR', 'International Conference on Learning Representations'],
        [/computer vision and pattern recognition|\bcvpr\b/, 'CVPR', 'Computer Vision and Pattern Recognition'],
        [/international conference on computer vision|\biccv\b/, 'ICCV', 'International Conference on Computer Vision'],
        [/european conference on computer vision|\beccv\b/, 'ECCV', 'European Conference on Computer Vision'],
        [/empirical methods in natural language processing|\bemnlp\b/, 'EMNLP', 'Empirical Methods in Natural Language Processing'],
        [/north american chapter of the association for computational linguistics|\bnaacl\b/, 'NAACL', 'North American Chapter of the Association for Computational Linguistics'],
        [/association for computational linguistics|\bacl\b/, 'ACL', 'Annual Meeting of the Association for Computational Linguistics'],
        [/\baaai\b|association for the advancement of artificial intelligence/, 'AAAI', 'AAAI Conference on Artificial Intelligence'],
        [/\bijcai\b|international joint conference on artificial intelligence/, 'IJCAI', 'International Joint Conference on Artificial Intelligence'],
        [/knowledge discovery (and|&) data mining|\bkdd\b/, 'KDD', 'Knowledge Discovery and Data Mining'],
        [/human factors in computing systems|\bchi\b/, 'CHI', 'Human Factors in Computing Systems'],
        [/the web conference|world wide web conference|^(in )?www\s*'?\d{2}/, 'WWW', 'The Web Conference'],
        [/\bsigcomm\b/, 'SIGCOMM', 'ACM SIGCOMM'],
        [/\bsigmod\b/, 'SIGMOD', 'ACM SIGMOD'],
        [/\bvldb\b|very large data bases/, 'VLDB', 'Very Large Data Bases'],
        [/\bosdi\b/, 'OSDI', 'Operating Systems Design and Implementation'],
        [/\bsosp\b/, 'SOSP', 'Symposium on Operating Systems Principles'],
        [/\bnsdi\b/, 'NSDI', 'Networked Systems Design and Implementation'],
        [/\bicse\b|international conference on software engineering/, 'ICSE', 'International Conference on Software Engineering'],
        [/\bjmlr\b|journal of machine learning research/, 'JMLR', 'Journal of Machine Learning Research'],
        [/\btpami\b|pattern analysis and machine intelligence/, 'TPAMI', 'IEEE Transactions on Pattern Analysis and Machine Intelligence'],
        [/\bpnas\b|proceedings of the national academy of sciences/, 'PNAS', 'Proceedings of the National Academy of Sciences'],
    ];
    // not venues to scan: preprints, reports, the web
    const NOT_VENUES = /^(arxiv|corr|preprint|technical report|tech rep|thesis|phd thesis|online|available|url|http|retrieved|in press|personal communication|unpublished)/;

    // "In Proceedings of the 34th International Conference on Machine Learning (ICML), 2017" → { key: 'icml',
    // label: 'ICML', search: 'International Conference on Machine Learning' }; null when it isn't a venue
    function venueOf(text) {
        const words = (text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
        for (const [re, label, search] of VENUES) if (re.test(words)) return { key: label.toLowerCase(), label, search };
        let name = (text || '').replace(/\s+/g, ' ')
            .replace(/^\s*(in:?\s+)/i, '')
            .replace(/\bproceedings of (the )?/i, '')
            .replace(/\b\d+(st|nd|rd|th)\b\s*/gi, '')
            .replace(/\b(19|20)\d{2}\b/g, '')
            .replace(/\(.*?\)/g, '')
            .replace(/,?\s*(vol|volume|no|issue|pp|pages)\b.*$/i, '')
            .replace(/[\s,.:;]+[\d\s,.:;–-]*$/, '') // its volume, issue and pages ("…, 85(2), 123–130")
            .replace(/[\s,.:;]+$/, '').replace(/^[\s,.:;]+/, '').trim();
        const key = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (key.length < 4 || NOT_VENUES.test(key) || /^\d/.test(key) || key.split(' ').length > 14) return null;
        return { key, label: name, search: name };
    }

    return { COLUMNS, column, firstPassDone, twoPassesDone, recordsOf, steps, keyPapers, venueOf };
})();

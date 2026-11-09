// Reading in passes (S. Keshav, "How to Read a Paper", 2007): a material read three times, each deeper.
//   1 Bird's-eye view: title, abstract, introduction, conclusion, headings; the five Cs; go on or stop
//   2 Grasp the content: everything but proofs and appendices; figures looked at closely; a summary
//   3 Re-implement it: predict each main section before reading it, compare; assumptions, weaknesses, future work
// It guides, never locks: any pass can be skipped (and is recorded as skipped), folded sections open with a click.
//
// One record per material, its own item (so your passes stay yours, and typing in them never clashes with an
// edit to the material's details):
// { type: 'passes', projectId, sourceId, on, pass: 1 | 2 | 3, state: 'reading' | 'stopped' | 'parked' | 'finished',
//   roles: { sectionKey: role },                 – your own tags, over the ones read from the headings
//   marks: [{ title, level, place }],            – headings you marked that weren't found
//   passes: {
//     1: { cs: { category, context, correctness, contributions, clarity }, refsKnown: [n] },
//     2: { summary, evidence: [noteId], figures: { key: { axes, errors, significant, note } }, followUp: [n] },
//     3: { predictions: { sectionKey: { predicted, differs, state: 'revealed' | 'skipped' } }, notes,
//          assumptions, weaknesses, missing, future, outline },
//     // and on each: activeMs, startedAt, doneAt, decision ('next' | 'enough' | 'park'), reason, skipped, peeks: [key]
//   } }
// A section key is its heading, cleaned up, and its level ("introduction|1"): the same in every view of the paper.

const Passes = (() => {
    const ROLES = {
        front: 'Opening',        // abstract, introduction
        context: 'Background',   // related work, background, preliminaries
        core: 'Main work',       // method, experiments, results… (and any heading not known)
        close: 'Closing',        // discussion, conclusion
        references: 'References',
        appendix: 'Appendix',
        other: 'Other',          // acknowledgements, declarations
    };

    const PASSES = {
        1: { name: 'Bird’s-eye view', short: 'Bird’s-eye', target: [5, 10], form: 'Five Cs',
            aim: 'Is this paper worth more of your time? Get its shape, then decide.',
            shows: 'In the paper: the title, abstract, introduction and conclusion. Other sections show only their heading; open one if you need it.' },
        2: { name: 'Grasp the content', short: 'Grasp', target: [45, 75], form: 'Summary',
            aim: 'Understand it well enough to explain it, with its evidence, to someone else.',
            shows: 'In the paper: everything but proofs and appendices. Skip the details; look closely at the figures.' },
        3: { name: 'Re-implement it', short: 'Re-implement', target: null, form: 'Close-out',
            aim: 'Rebuild the work in your head, and find where it is strong and where it is weak.',
            shows: 'In the paper: each main section waits behind a card. Predict it, reveal it, and note how theirs differs.' },
    };

    const FIVE_CS = [
        ['category', 'Category', 'What kind of paper is it? A measurement, an analysis of a system, a new design, a survey…'],
        ['context', 'Context', 'Which other papers is it related to? What theory does it build on?'],
        ['correctness', 'Correctness', 'Do the assumptions look valid?'],
        ['contributions', 'Contributions', 'What are its main contributions?'],
        ['clarity', 'Clarity', 'Is it well written?'],
    ];

    const NUMBERING = /^\s*((?:\d+\.){0,3}\d+\.?|[IVX]{1,5}\.|[A-H][.:)]|appendix\s+[A-Z0-9]+[.:]?)\s+/i;
    const clean = title => (title || '').replace(/\s+/g, ' ').replace(NUMBERING, '').trim();
    const norm = title => clean(title).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

    const PATTERNS = [
        ['references', /^(references|bibliography|works cited|literature cited|citations)$/],
        ['appendix', /^(appendix|appendices|supplementary|supplemental|online appendix)\b/],
        ['front', /^(abstract|introduction|intro|overview|motivation|preface|executive summary|summary of contributions)\b/],
        ['close', /^(conclusions?|concluding remarks|closing remarks|discussion|summary|future work|outlook|final remarks)\b/],
        ['context', /^(related work|related research|background|preliminar|literature review|review of (the )?literature|prior work|previous work|notation|definitions|problem (statement|setting|formulation))\b/],
        ['other', /^(acknowledge?ments?|funding|author contributions?|ethics|ethical|data availability|code availability|declarations?|competing interests|conflicts? of interest|broader impact|impact statement|reproducibility)\b/],
        ['core', /^(methods?|methodology|materials and methods|approach|proposed|model|models|architecture|design|implementation|system|framework|experiments?|experimental|evaluation|results?|findings|analysis|empirical|case stud|study|data|datasets?|setup|training|ablation)\b/],
    ];

    // the role a heading's words say, or null when they don't say
    function knownRole(title, hint) {
        if (hint === 'appendix' || hint === 'references') return hint;
        if (hint === 'abstract') return 'front';
        const words = norm(title);
        return PATTERNS.find(([, re]) => re.test(words))?.[0] || null;
    }
    // what a heading is; anything not known is the paper's main work
    const roleOf = (title, hint) => knownRole(title, hint) || 'core';

    const keyOf = entry => norm(entry.title) + '|' + entry.level;

    // Contents entries ({ title, level, place, hint? }) → sections, each with its key, role and the index of
    // the top-level section it's in. A subsection takes its parent's role unless its own name says otherwise
    // ("Method" under "Introduction" in pasted text) or you tagged it yourself.
    // One entry holding all the rest (a PDF outline's root, the paper's title) is the opening, and its
    // children count as the top level.
    function sections(entries, roles = {}) {
        if (!entries.length) return [];
        const seen = new Map();
        const keyed = entries.map(entry => {
            let key = keyOf(entry);
            const n = (seen.get(key) || 0) + 1;
            seen.set(key, n);
            if (n > 1) key += '#' + n;
            return { ...entry, key };
        });
        const minLevel = Math.min(...keyed.map(e => e.level));
        const wrapper = keyed.filter(e => e.level === minLevel).length === 1 && keyed.length > 2
            && keyed[0].level === minLevel && !knownRole(keyed[0].title, keyed[0].hint) ? keyed[0] : null;
        const topLevel = wrapper ? Math.min(...keyed.slice(1).map(e => e.level)) : minLevel;

        const stack = []; // the sections the next one may be inside
        return keyed.map((entry, index) => {
            const own = entry === wrapper ? 'front' : knownRole(entry.title, entry.hint);
            while (stack.length && stack.at(-1).level >= entry.level) stack.pop();
            const parent = entry === wrapper ? null : stack.findLast(s => s !== wrapper) || null;
            const auto = own || (parent && entry.level > topLevel ? parent.role : 'core');
            const role = roles[entry.key] || auto;
            const section = {
                ...entry, index, role, auto, tagged: !!roles[entry.key], parent: parent ? parent.index : null,
                top: entry === wrapper || !parent ? index : parent.top,
                isTop: entry === wrapper || !parent || entry.level <= topLevel,
            };
            stack.push(section);
            return section;
        });
    }

    // in a pass, a section is shown, or folded to its heading
    function shown(role, pass) {
        if (pass === 1) return role === 'front' || role === 'close';
        if (pass === 2) return role !== 'appendix';
        return true;
    }
    // pass 3: the paper's main work waits behind your prediction
    const predicted = (role, pass) => pass === 3 && role === 'core';

    // the sections you predict in pass 3: each run of main work, from its outermost section (a core section not
    // inside another core one), with its subsections → [{ section, group: [indexes] }]
    function predictions(list) {
        return list.filter(s => s.role === 'core' && (s.parent == null || list[s.parent].role !== 'core')).map(s => {
            const group = [s.index];
            for (let j = s.index + 1; j < list.length && list[j].level > s.level; j++) group.push(j);
            return { section: s, group };
        });
    }

    // a survey or review paper: its title says so, or you said so in its Category (pass 1). Its references can be
    // a literature survey's key papers (sources/survey.js).
    const SURVEY_WORDS = /\b(survey|review|overview|state of the art|tutorial|meta-analysis|systematic mapping)\b/i;
    const isSurvey = (source, record) => SURVEY_WORDS.test(source?.title || '') || SURVEY_WORDS.test(record?.passes?.[1]?.cs?.category || '');

    // ---- the record ----

    const of = source => source && Store.getItems(source.projectId).find(i => i.type === 'passes' && i.sourceId === source.id) || null;

    // the record, made the first time reading in passes is turned on
    function start(source) {
        const found = of(source);
        if (found) return found;
        const id = Store.saveItem({
            type: 'passes', projectId: source.projectId, sourceId: source.id, on: true, pass: 1, state: 'reading',
            roles: {}, marks: [], passes: { 1: { startedAt: Date.now(), activeMs: 0 } },
        });
        return Store.getItem(id);
    }

    function save(record, changes) {
        Store.saveItem({ id: record.id, ...changes });
        return Store.getItem(record.id);
    }

    // one pass's fields changed (merged in)
    function savePass(record, n, changes) {
        const passes = { ...record.passes, [n]: { ...(record.passes?.[n] || {}), ...changes } };
        return save(record, { passes });
    }

    // Move to pass n. Passes jumped over are recorded as skipped (not done, not forgotten).
    function moveTo(record, n) {
        const passes = structuredClone(record.passes || {});
        for (let k = (record.pass || 1); k < n; k++) {
            passes[k] ||= {};
            if (!passes[k].doneAt) passes[k].skipped = true;
        }
        passes[n] ||= {};
        passes[n].startedAt ||= Date.now();
        return save(record, { pass: n, state: 'reading', passes });
    }

    // the end of a pass: 'next', 'enough' (stop here) or 'park' (come back later), with a reason if given
    function decide(record, decision, reason = '') {
        const n = record.pass || 1;
        let next = savePass(record, n, { decision, reason, doneAt: Date.now(), skipped: false });
        if (decision === 'next' && n < 3) return moveTo(next, n + 1);
        const state = decision === 'park' ? 'parked' : n === 3 && decision !== 'park' ? 'finished' : 'stopped';
        return save(next, { state });
    }

    // where a material is, in a few words: "Pass 2", "Stopped after pass 1", "Read in three passes"
    function label(record) {
        if (!record?.on && !record?.passes) return '';
        const n = record.pass || 1;
        if (record.state === 'finished') return 'Read in three passes';
        if (record.state === 'stopped') return `Stopped after pass ${n}`;
        if (record.state === 'parked') return `Parked at pass ${n}`;
        return `Pass ${n}`;
    }

    // "6 min", "1 h 05"
    function duration(ms) {
        const minutes = Math.floor((ms || 0) / 60000);
        if (minutes < 60) return `${minutes} min`;
        return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
    }

    return { ROLES, PASSES, FIVE_CS, isSurvey, roleOf, keyOf, clean, norm, sections, shown, predicted, predictions, of, start, save, savePass, moveTo, decide, label, duration };
})();

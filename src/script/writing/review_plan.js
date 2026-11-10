// From your reading to a literature review: the skeleton the wizard writes (pages/dashboard/wizard.js), built from
// what the passes gathered in each paper's Summary (sources/passes.js: the five Cs, what the field has done, the
// main argument, weak spots, missing citations, ideas for future work).
//   Two kinds of review:
//     theme  – the usual literature review / related work: an introduction, one section per theme (the papers in it
//              cited together, then each one's main argument as a cited point to rewrite), gaps and open questions
//              gathered from every paper, a conclusion
//     paper  – a review of each paper in turn: what it is, its argument, contributions, weak spots, future work;
//              then how they compare, and a conclusion
//   Themes can be suggested four ways: by the works the papers cite in common, by your tags, by their Category,
//   or not at all (you make them).

const ReviewPlan = (() => {
    const UNSORTED = 'Not in a theme yet';
    const flat = text => (text || '').replace(/\s+/g, ' ').trim();
    const sec = (source, key) => flat(Passes.section(summaryOf(source), key));

    // ---- themes: [{ name, ids: [sourceId] }], the last one the papers in no theme ----

    function suggest(sources, basis) {
        const themes = basis === 'tags' ? byTags(sources) : basis === 'category' ? byCategory(sources)
            : basis === 'citations' ? byCitations(sources) : [{ name: 'Theme 1', ids: [] }];
        const placed = new Set(themes.flatMap(t => t.ids));
        return [...themes, { name: UNSORTED, ids: sources.filter(s => !placed.has(s.id)).map(s => s.id), unsorted: true }];
    }

    // each of your tags a theme; a paper with several goes under the one most papers share
    function byTags(sources) {
        const count = new Map();
        for (const s of sources) for (const tag of tagsOf(s)) count.set(tag, (count.get(tag) || 0) + 1);
        const themes = new Map();
        for (const s of sources) {
            const tag = tagsOf(s).sort((a, b) => count.get(b) - count.get(a) || a.localeCompare(b))[0];
            if (tag) themes.set(tag, [...(themes.get(tag) || []), s.id]);
        }
        return [...themes].map(([name, ids]) => ({ name, ids }));
    }

    // by what kind of paper each is (its Category): the usual kinds by their words, else the Category's own words
    const KINDS = [
        ['Surveys and reviews', /\b(survey|review|overview|meta-analysis|state of the art)\b/i],
        ['User studies', /\b(user stud|interview|participants|qualitative|ethnograph|field study)/i],
        ['Experiments', /\b(experiment|trial|randomi[sz]ed|controlled)/i],
        ['Measurements and evaluations', /\b(measurement|empirical|benchmark|evaluation|comparison)/i],
        ['New designs and systems', /\b(new (design|system|method|model|approach|algorithm|tool)|propos|framework|architecture|we (build|present|introduce))/i],
        ['Analyses and theory', /\b(analys[ie]s|theor|formal|model of|framework for understanding)/i],
    ];
    function byCategory(sources) {
        const themes = new Map();
        for (const s of sources) {
            const category = sec(s, 'category');
            if (!category) continue;
            const kind = KINDS.find(([, re]) => re.test(category))?.[0]
                || category.replace(/^(an?|the)\s+/i, '').split(/[.;:,(]/)[0].trim().replace(/^./, c => c.toUpperCase()).slice(0, 40);
            themes.set(kind, [...(themes.get(kind) || []), s.id]);
        }
        return [...themes].map(([name, ids]) => ({ name, ids }));
    }

    // papers that cite the same works go together (two works in common, at least); named after the work they share most
    function byCitations(sources) {
        const cites = new Map(sources.map(s => [s.id, new Map((s.references || []).map(r => [References.identity(r) || '', r]).filter(([k]) => k))]));
        let groups = sources.filter(s => cites.get(s.id).size).map(s => ({ ids: [s.id], works: new Map(cites.get(s.id)) }));
        const shared = (a, b) => [...a.works.keys()].filter(k => b.works.has(k)).length;
        for (;;) {
            let best = null;
            for (let i = 0; i < groups.length; i++) {
                for (let j = i + 1; j < groups.length; j++) {
                    const n = shared(groups[i], groups[j]);
                    if (n >= 2 && (!best || n > best.n)) best = { i, j, n };
                }
            }
            if (!best) break;
            const [a, b] = [groups[best.i], groups[best.j]];
            for (const [k, r] of b.works) a.works.set(k, r);
            a.ids.push(...b.ids);
            groups.splice(best.j, 1);
        }
        return groups.filter(g => g.ids.length > 1).map(g => {
            // the work most of them cite
            const counts = [...g.works.keys()].map(k => [k, g.ids.filter(id => cites.get(id).has(k)).length]).sort((x, y) => y[1] - x[1]);
            const title = flat(References.titleOf(g.works.get(counts[0][0])) || '').replace(/[.,;:]+$/, '');
            return { name: title ? `Around “${title.length > 60 ? title.slice(0, 57) + '…' : title}”` : 'Papers citing the same works', ids: g.ids };
        });
    }

    // ---- the skeleton, as Markdown ----

    const cite = ids => `[${ids.map(id => '@' + id).join('; ')}]`;

    // plan: { kind: 'theme' | 'paper', title, question, themes, sources (in order), seeds: [sourceId] }
    // (sources carry their citekey: sources.js assignCitekeys)
    function markdown({ kind, title, question, themes = [], sources, seeds = [] }) {
        const byId = new Map(sources.map(s => [s.id, s]));
        const key = s => s.citekey;
        const lines = [`# ${title || 'Literature review'}`, '', '## Introduction', ''];
        if (question?.trim()) lines.push(question.trim(), '');
        // what the field has done, from the seed papers' related work
        const field = sources.filter(s => seeds.includes(s.id) && sec(s, 'field'));
        if (field.length) lines.push(...field.map(s => `- ${sec(s, 'field')} [@${key(s)}]`), '');

        if (kind === 'paper') {
            for (const s of sources) {
                lines.push(`## ${shortCitation(s) || s.title}: ${s.title}`, '', `[@${key(s)}]`, '');
                const parts = [['What it is', 'category'], ['Its argument', 'argument'], ['Contributions', 'contributions'], ['Weak spots', 'weaknesses'], ['For future work', 'future']];
                for (const [label, k] of parts) if (sec(s, k)) lines.push(`**${label}:** ${sec(s, k)}`, '');
                if (!sec(s, 'argument')) lines.push('*(Its argument: not written yet.)*', '');
            }
            lines.push('## Comparing them', '', '*How they agree, differ and build on each other.*', '');
        } else {
            for (const theme of themes.filter(t => t.ids.length)) {
                const papers = theme.ids.map(id => byId.get(id)).filter(Boolean);
                lines.push(`## ${theme.unsorted ? 'Other work' : theme.name}`, '', `Papers: ${cite(papers.map(key))}`, '');
                for (const s of papers) {
                    const point = sec(s, 'argument') || sec(s, 'contributions') || sec(s, 'category') || flat(Passes.parseSummary(summaryOf(s)).intro);
                    lines.push(`- ${point || '*(its main argument: not written yet)*'} [@${key(s)}]`);
                }
                lines.push('');
            }
        }

        // gaps and open questions: what every paper's close-out says
        const gaps = [['Weak spots', 'weaknesses'], ['Missing work', 'missing'], ['Ideas for future work', 'future']]
            .map(([label, k]) => [label, sources.filter(s => sec(s, k)).map(s => `- ${sec(s, k)} [@${key(s)}]`)])
            .filter(([, list]) => list.length);
        lines.push('## Gaps and open questions', '');
        if (gaps.length) for (const [label, list] of gaps) lines.push(`### ${label}`, '', ...list, '');
        else lines.push('*What the papers leave open.*', '');
        lines.push('## Conclusion', '');
        return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    }

    return { UNSORTED, suggest, markdown };
})();

// Where you are in each material, for "Continue reading". The material page keeps it as you read
// (pages/material_places.js): source.readingAt = { view, page / line / anchor / time, label ("p. 5"),
// progress (0–1), at (when) }, and opens there next time.

const Reading = (() => {
    // read some of it, not finished
    const inProgress = source => !!source.readingAt && source.status !== 'done' && (source.readingAt.progress || 0) < 0.98;

    // "p. 5 · 38%"
    function placeLabel(source) {
        const at = source.readingAt;
        if (!at) return '';
        const percent = at.progress > 0 ? Math.round(at.progress * 100) + '%' : '';
        return [at.label, percent].filter(Boolean).join(' · ');
    }

    // "just now", "5 min ago", "yesterday", "3 days ago", or the date
    function ago(time) {
        const minutes = (Date.now() - time) / 60000;
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${Math.round(minutes)} min ago`;
        const hours = minutes / 60;
        if (hours < 24) return `${Math.round(hours)} h ago`;
        const days = Math.round(hours / 24);
        if (days === 1) return 'yesterday';
        if (days < 14) return `${days} days ago`;
        return new Date(time).toLocaleDateString();
    }

    // the materials you're in the middle of, most recent first
    const recent = (sources, n = 4) => sources.filter(inProgress).sort((a, b) => b.readingAt.at - a.readingAt.at).slice(0, n);

    // a card that opens it where you were (the material page continues there by itself)
    function card(source) {
        const a = el('a', 'continue_card');
        a.href = 'material.html?id=' + encodeURIComponent(source.id);
        a.title = 'Continue from ' + source.readingAt.label;
        const bar = el('span', 'continue_progress');
        bar.style.setProperty('--progress', Math.round((source.readingAt.progress || 0) * 100) + '%');
        a.append(el('strong', '', source.title), el('small', '', [placeLabel(source), ago(source.readingAt.at)].filter(Boolean).join(' · ')), bar);
        return a;
    }

    // the "Continue reading" row: hidden when there's nothing in progress
    function renderRow(container, sources) {
        const list = recent(sources);
        container.hidden = !list.length;
        container.querySelector('.continue_list').replaceChildren(...list.map(card));
    }

    return { inProgress, placeLabel, ago, recent, card, renderRow };
})();

// A checklist of sources for exports (bibliography, summaries). Everything is ticked to start with;
// Select all / Deselect all, "only those shown in the library", and chips that tick or untick a
// whole group at once: a reading status, a type (article, video…) or one of your tags.
//
// createSourcePicker(root, { sources, shown, onChange }) -> { reset(), selected() }
//   sources(): every source · shown(): those the library's filters show · onChange(): after each change

function createSourcePicker(root, { sources, shown, onChange }) {
    const picked = new Set();
    let groups = [];

    function buildGroups(list) {
        const result = [];
        const add = (label, test) => {
            const members = list.filter(test);
            if (members.length) result.push({ label, members });
        };
        for (const [status, label] of Object.entries(STATUS_LABELS)) add(label, s => (s.status || 'to_read') === status);
        const kinds = [...new Set(list.map(s => s.kind || 'article'))].sort();
        if (kinds.length > 1) for (const kind of kinds) add(KIND_LABELS[kind] || kind, s => (s.kind || 'article') === kind);
        const tags = new Map(); // lowercase -> spelling
        for (const source of list) for (const tag of tagsOf(source)) if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag);
        for (const [key, label] of [...tags].sort((a, b) => a[1].localeCompare(b[1]))) add('#' + label, s => hasTag(s, key));
        return result;
    }

    const action = (label, act) => {
        const btn = el('button', 'link', label);
        btn.type = 'button';
        btn.dataset.act = act;
        return btn;
    };

    function render() {
        const list = sources();
        const scroll = $('.picker_list', root)?.scrollTop || 0;
        groups = buildGroups(list);

        const head = el('div', 'picker_head');
        head.append(el('strong', '', 'Sources'), el('small', '', `${list.filter(s => picked.has(s.id)).length} of ${list.length} selected`));

        const actions = el('div', 'picker_actions');
        actions.append(action('Select all', 'all'), action('Deselect all', 'none'));
        const showing = shown().length;
        if (showing < list.length) actions.append(action(`Only the ${showing} shown in the library`, 'shown'));

        const chips = el('div', 'picker_groups');
        if (groups.length) chips.append(el('small', '', 'Tick / untick:'));
        groups.forEach((group, i) => {
            const on = group.members.filter(s => picked.has(s.id)).length;
            const all = on === group.members.length;
            const chip = el('button', 'group_chip' + (all ? ' on' : on ? ' partial' : ''), `${group.label} ${group.members.length}`);
            chip.type = 'button';
            chip.dataset.group = i;
            chip.title = all ? 'Untick these' : 'Tick these';
            chips.append(chip);
        });

        const listEl = el('ul', 'picker_list');
        listEl.append(...[...list].sort((a, b) => a.title.localeCompare(b.title)).map(source => {
            const box = el('input');
            box.type = 'checkbox';
            box.checked = picked.has(source.id);
            box.dataset.id = source.id;
            const label = el('label');
            label.append(box, el('span', '', source.title), el('small', '', shortCitation(source)));
            const li = el('li');
            li.append(label);
            return li;
        }));

        root.replaceChildren(head, actions, chips, listEl);
        listEl.scrollTop = scroll;
    }

    function changed() {
        render();
        onChange();
    }

    root.addEventListener('click', e => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        const chip = e.target.closest('.group_chip');
        if (act) {
            picked.clear();
            const ids = act === 'all' ? sources() : act === 'shown' ? shown() : [];
            for (const source of ids) picked.add(source.id);
            changed();
        } else if (chip) {
            const { members } = groups[Number(chip.dataset.group)];
            const allOn = members.every(s => picked.has(s.id));
            for (const source of members) allOn ? picked.delete(source.id) : picked.add(source.id);
            changed();
        }
    });
    root.addEventListener('change', e => {
        const box = e.target.closest('input[data-id]');
        if (!box) return;
        box.checked ? picked.add(box.dataset.id) : picked.delete(box.dataset.id);
        changed();
    });

    return {
        // tick everything again (each time the popup opens)
        reset() {
            picked.clear();
            for (const source of sources()) picked.add(source.id);
            render();
        },
        selected: () => sources().filter(s => picked.has(s.id)),
    };
}

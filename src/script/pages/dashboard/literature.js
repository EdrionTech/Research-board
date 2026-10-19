// Literature tab: the review card and the source library (each card shows its paper's first page, blurred,
// behind it: sources/bookshelf.js). Filter by text, status and your own tags,
// and export a bibliography or a digest of your summaries; which sources go in is chosen in each
// popup (sources/picker.js). Each source has its own page (material.html).
// Uses helpers from core/ui.js and sources/*, and items/project from dashboard.js.

const materialUrl = id => 'material.html?id=' + encodeURIComponent(id);
const sourceItems = () => items.filter(i => i.type === 'source');
const notesOf = source => items.filter(i => i.type === 'source_note' && i.sourceId === source.id);
const firstAuthor = source => source.authors?.[0]?.lastName || source.title || '';
const byAuthor = (a, b) => firstAuthor(a).localeCompare(firstAuthor(b)) || (a.published || '').localeCompare(b.published || '');

const activeTags = new Set(); // tag filter (lowercase); a source must have all of them
const exportForm = $('#export_form');
const digestForm = $('#digest_form');
const exportPicker = createSourcePicker($('#export_picker'), { sources: sourceItems, shown: () => shownSources(), onChange: () => updateExport() });
const digestPicker = createSourcePicker($('#digest_picker'), { sources: sourceItems, shown: () => shownSources(), onChange: () => updateDigest() });

for (const [value, label] of Object.entries(Cite.STYLES)) exportForm.elements.style.append(new Option(label, value));
for (const [value, label] of Object.entries(Cite.INLINE_STYLES)) $('#project_cite_style').append(new Option(label, value));
$('#open_review').href = 'review.html?id=' + encodeURIComponent(project?.id || '');

// sources that pass the search, status and tag filters
function shownSources() {
    const query = $('#source_search').value.trim().toLowerCase();
    const status = $('#source_filter').value;
    return sourceItems().filter(s => (!status || s.status === status)
        && [...activeTags].every(tag => hasTag(s, tag))
        && [s.title, (s.keywords || []).join(' '), tagsOf(s).join(' '), (s.authors || []).map(authorName).join(' ')]
            .join(' ').toLowerCase().includes(query));
}

// ---- literature review card ----

function renderReviewCard() {
    $('#project_cite_style').value = project.citeStyle || 'apa';
    const review = items.find(i => i.type === 'lit_review');
    if (!review?.body) {
        $('#review_info').textContent = 'Not started yet. Write it with your sources, summaries and notes at hand.';
        return;
    }
    const words = (review.body.replace(/\[@[^\]]*\]|@[\w:.-]+/g, ' ').match(/[\p{L}\p{N}'’-]+/gu) || []).length;
    const keys = new Set([...review.body.matchAll(/@([\w:.-]*\w)/g)].map(m => m[1]));
    const cited = sourceItems().filter(s => keys.has(s.citekey)).length;
    $('#review_info').textContent = `${words.toLocaleString()} words · ${cited} source${cited === 1 ? '' : 's'} cited · edited ${new Date(review.updatedAt).toLocaleDateString()}`;
}

// ---- library ----

function renderLiterature() {
    renderReviewCard();
    const all = sourceItems();
    renderTagFilter();
    const shown = shownSources();
    $('#source_list').replaceChildren(...(shown.length ? shown.map(sourceRow)
        : [el('li', 'none', all.length ? 'No sources match.' : 'No sources yet. Add one with + Source, a link is enough.')]));
    Bookshelf.whenVisible($$('#source_list .row_preview[data-source]'), (preview, url) => { preview.style.backgroundImage = `url("${url}")`; });
    $('#selection_info').textContent = `${shown.length} of ${all.length} shown`;
    renderColors();
    renderFigures();
}

// ---- highlight colours (sources/colors.js): their meanings, and every note of a colour across papers ----

let highlightColor = ''; // the colour shown in "Highlights across papers" ('' = all colours)
const coloredNotes = () => items.filter(i => i.type === 'source_note' && NoteColors.find(project, i.color));
const colorEditor = NoteColors.editor({
    list: $('#color_rows'),
    add: $('#add_color'),
    project,
    count: id => items.filter(i => i.type === 'source_note' && i.color === id).length,
    onChange: () => renderHighlights(),
});

function renderColors() {
    colorEditor.render();
    renderHighlights();
}

function renderHighlights() {
    const notes = coloredNotes();
    const withNotes = NoteColors.of(project).filter(c => notes.some(n => n.color === c.id));
    $('#highlights_panel').hidden = withNotes.length === 0;
    if (highlightColor && !withNotes.some(c => c.id === highlightColor)) highlightColor = '';
    const chip = (id, label, count, hex) => {
        const btn = el('button', 'color_chip');
        btn.type = 'button';
        btn.dataset.color = id;
        btn.setAttribute('aria-pressed', id === highlightColor);
        if (hex) btn.append(NoteColors.dot(hex));
        btn.append(`${label} ${count}`);
        return btn;
    };
    $('#highlight_filter').replaceChildren(chip('', 'All', notes.length),
        ...withNotes.map(c => chip(c.id, c.label, notes.filter(n => n.color === c.id).length, c.hex)));
    const list = highlightNotes();
    $('#copy_highlights').disabled = !list.length;
    $('#highlight_list').replaceChildren(...(list.length ? list.map(({ note, source }, i) => {
        const li = el('li', 'highlight');
        li.style.setProperty('--note-color', NoteColors.hexOf(project, note.color));
        // the passage opens it for review; the small link opens it in its paper
        const open = el('button', 'highlight_text', note.quote || snippetOf(note.body) || '(an image or area)');
        open.type = 'button';
        open.dataset.index = i;
        open.title = 'Review this note';
        const where = el('small', '', [NoteColors.find(project, note.color)?.label, highlightCite(source), locatorOfNote(note)].filter(Boolean).join(' · ') + ' · ');
        const link = el('a', 'highlight_open', 'Open in paper ↗');
        link.href = paperLink(note, source);
        where.append(link);
        li.append(open, where);
        if (note.quote && note.body) li.append(el('p', 'highlight_note', snippetOf(note.body)));
        return li;
    }) : [el('li', 'none', 'No coloured notes yet. On a source\'s page, pick a colour when you attach a note.')]));
}

const paperLink = (note, source) => materialUrl(source.id) + '#note=' + encodeURIComponent(note.id);

const snippetOf = text => (text || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 220);
const highlightCite = source => [firstAuthor(source) + (source.authors?.length > 1 ? ' et al.' : ''), source.published].filter(Boolean).join(', ');
// "p. 3", "§2 ¶4" or, in pasted text, "l. 12"
const locatorOfNote = note => (note.page ? 'p. ' + note.page : note.where || (note.line ? 'l. ' + note.line : '')).replace(/\s*·\s*(area|image)$/, '');

// the notes of the chosen colour (or of every colour), paper by paper in library order, in reading order inside a paper
function highlightNotes() {
    const order = (a, b) => (Number(a.page) || 0) - (Number(b.page) || 0) || (Number(a.line) || 0) - (Number(b.line) || 0) || a.createdAt - b.createdAt;
    const wanted = n => (highlightColor ? n.color === highlightColor : !!NoteColors.find(project, n.color));
    return sourceItems().sort(byAuthor).flatMap(source => notesOf(source).filter(wanted).sort(order).map(note => ({ note, source })));
}

$('#open_colors').onclick = () => {
    colorEditor.render();
    openModal($('#colors_form'));
};

// ---- review one highlight at a time ----

const reviewForm = $('#note_review');
let reviewList = [];   // the list as it was when the review opened (stays put while you change colours)
let reviewIndex = 0;

function openReview(index) {
    reviewList = highlightNotes();
    reviewIndex = index;
    showReview();
    openModal(reviewForm);
}

function showReview() {
    const { note, source } = reviewList[reviewIndex];
    const color = NoteColors.find(project, note.color);
    reviewForm.style.setProperty('--note-color', NoteColors.hexOf(project, note.color));
    $('#review_count').textContent = `${reviewIndex + 1} of ${reviewList.length}`;
    $('#review_prev').disabled = reviewIndex === 0;
    $('#review_next').disabled = reviewIndex === reviewList.length - 1;
    $('#review_where').textContent = [source.title, [highlightCite(source), locatorOfNote(note)].filter(Boolean).join(' · ')].filter(Boolean).join(' — ');
    $('#review_quote').textContent = note.quote || '';
    $('#review_quote').hidden = !note.quote;
    const thumb = $('#review_thumb');
    thumb.replaceChildren();
    if (note.thumb && /^data:image\//.test(note.thumb)) {
        const img = el('img');
        img.src = note.thumb;
        img.alt = 'The noted area';
        thumb.append(img);
    }
    renderMarkdown($('#review_body'), note.body, 'No note written.');
    $('#review_answer').hidden = note.kind !== 'question';
    if (note.kind === 'question') renderMarkdown($('#review_answer'), note.answer, 'No answer yet.');
    // its colour, changeable here
    $('#review_colors').replaceChildren(...[{ id: '', label: 'None', hex: 'transparent' }, ...NoteColors.of(project)].map(c => {
        const btn = el('button', 'color_chip');
        btn.type = 'button';
        btn.dataset.color = c.id;
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', (color?.id || '') === c.id);
        btn.append(NoteColors.dot(c.hex), c.label);
        return btn;
    }));
    $('#review_open').href = paperLink(note, source);
    setReviewEditing(false);
}

function setReviewEditing(editing) {
    const { note } = reviewList[reviewIndex];
    $('#review_edit').hidden = !editing;
    $('#review_body').hidden = editing;
    $('#review_edit_btn').textContent = editing ? 'Save note' : 'Edit note';
    if (editing) {
        const area = $('#review_edit textarea');
        area.value = note.body || '';
        area.focus();
    }
}

function stepReview(by) {
    const next = reviewIndex + by;
    if (next < 0 || next >= reviewList.length) return;
    reviewIndex = next;
    showReview();
}

$('#highlight_list').addEventListener('click', e => {
    const btn = e.target.closest('.highlight_text');
    if (btn) openReview(Number(btn.dataset.index));
});
$('#review_prev').onclick = () => stepReview(-1);
$('#review_next').onclick = () => stepReview(1);
$('#review_colors').addEventListener('click', e => {
    const btn = e.target.closest('button[data-color]');
    if (!btn) return;
    const { note } = reviewList[reviewIndex];
    note.color = btn.dataset.color;
    Store.saveItem({ id: note.id, color: note.color });
    showReview();
    renderHighlights();
});
$('#review_edit_btn').onclick = () => {
    if ($('#review_edit').hidden) return setReviewEditing(true);
    const { note } = reviewList[reviewIndex];
    note.body = $('#review_edit textarea').value.trim();
    Store.saveItem({ id: note.id, body: note.body });
    showReview();
    renderHighlights();
};
reviewForm.addEventListener('submit', e => e.preventDefault());
MdBar.attach($('#review_edit textarea'));
// ← / → step through the notes (not while typing)
document.addEventListener('keydown', e => {
    if (reviewForm.hidden || $('#modals').hidden || e.target.matches('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') stepReview(-1);
    if (e.key === 'ArrowRight') stepReview(1);
});

$('#highlight_filter').addEventListener('click', e => {
    const btn = e.target.closest('button[data-color]');
    if (!btn) return;
    highlightColor = btn.dataset.color;
    renderColors();
});
// each passage as a quote with its citation, ready for the review: > "text" [@key, p. 3]
$('#copy_highlights').onclick = async e => {
    const btn = e.currentTarget;
    assignCitekeys(sourceItems());
    const md = highlightNotes().map(({ note, source }) => {
        const loc = locatorOfNote(note);
        const cite = source.citekey ? ` [@${source.citekey}${loc ? ', ' + loc : ''}]` : '';
        return `> ${note.quote || snippetOf(note.body)}${cite}` + (note.quote && note.body ? `\n\n${note.body.trim()}` : '');
    }).join('\n\n');
    const ok = await copyText(md);
    btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
    setTimeout(() => { btn.textContent = 'Copy as Markdown'; }, 1600);
};

// ---- project figures (sources/figures.js) ----

function smallButton(label, title, onClick) {
    const btn = el('button', 'link', label);
    btn.type = 'button';
    btn.title = title;
    btn.onclick = onClick;
    return btn;
}

function renderFigures() {
    const figures = figureItems(items);
    const review = items.find(i => i.type === 'lit_review')?.body || '';
    $('#figure_count').textContent = figures.length ? `(${figures.length})` : '';
    $('#figure_grid').replaceChildren(...(figures.length ? figures.map(figure => {
        const source = items.find(i => i.id === figure.sourceId && i.type === 'source');
        const actions = [smallButton('Edit', 'Caption, figure or table, credit', () => openFigureForm(figure, source))];
        if (source) {
            actions.push(smallButton('Copy credit', 'Copy the credit line to reuse it anywhere', async e => {
                const ok = await copyText(figureCredit(figure, source, project.citeStyle || 'apa'));
                e.target.textContent = ok ? 'Copied ✓' : 'Copy failed';
                setTimeout(() => { e.target.textContent = 'Copy credit'; }, 1600);
            }));
        }
        actions.push(smallButton('Delete', 'Delete this figure', () => {
            const used = !!figure.file && review.includes('asset:' + figure.file.assetId);
            if (!confirm(used ? `Delete this ${figureLabel(figure).toLowerCase()}? It stays in your literature review where you placed it.` : `Delete this ${figureLabel(figure).toLowerCase()}?`)) return;
            Store.deleteItem(figure.id, { keepAssets: used });
            render();
        }));
        const card = figureCard(figure, source, actions);
        if (source) {
            const link = el('a', 'figure_source', 'Open source');
            link.href = materialUrl(source.id);
            card.querySelector('.figure_actions').prepend(link);
        }
        return card;
    }) : [el('li', 'none', 'No figures yet.')]));
}

// ---- edit a figure / table: caption, kind, credit, where in the source ----

const figureForm = $('#figure_form');
let editingFigure = null;

function openFigureForm(figure, source) {
    editingFigure = { figure, source };
    const f = figureForm.elements;
    f.caption.value = figure.caption || '';
    f.kind.value = figure.kind || 'figure';
    f.credit.value = figure.credit || 'from';
    f.locator.value = figure.locator || '';
    f.credit.disabled = f.locator.disabled = !source; // your own images need no credit
    previewFigureCredit();
    openModal(figureForm);
    f.caption.focus();
}

// the credit line as it will read in the project's style
function previewFigureCredit() {
    const { figure, source } = editingFigure;
    const f = figureForm.elements;
    $('#figure_credit_preview').textContent = source
        ? 'Note. ' + figureCredit({ ...figure, credit: f.credit.value, locator: f.locator.value.trim() }, source, project.citeStyle || 'apa')
        : 'Your own image: no credit needed.';
}

figureForm.addEventListener('input', previewFigureCredit);
figureForm.addEventListener('change', previewFigureCredit);
figureForm.addEventListener('submit', e => {
    e.preventDefault();
    const f = figureForm.elements;
    Store.saveItem({
        id: editingFigure.figure.id,
        caption: f.caption.value.trim(),
        kind: f.kind.value,
        credit: f.credit.value,
        locator: f.locator.value.trim(),
    });
    closeModals();
    render();
});

async function uploadFigures(files) {
    for (const file of [...files].filter(f => f.type.startsWith('image/'))) {
        try {
            const assetId = await Store.putAsset(file);
            Store.saveItem({
                projectId: project.id, type: 'figure', caption: file.name.replace(/\.[^.]+$/, ''), locator: '',
                file: { assetId, mime: file.type, name: file.name },
            });
        } catch {
            alert("Couldn't save the image in this browser (private window or storage full?).");
            return;
        }
    }
    render();
}

function renderTagFilter() {
    // tags match ignoring case; the chip shows the most used spelling
    const counts = new Map(); // lowercase tag -> { label, n, spellings }
    for (const source of sourceItems()) {
        for (const tag of tagsOf(source)) {
            const entry = counts.get(tag.toLowerCase()) || { label: tag, n: 0, spellings: new Map() };
            entry.n++;
            entry.spellings.set(tag, (entry.spellings.get(tag) || 0) + 1);
            entry.label = [...entry.spellings].sort((a, b) => b[1] - a[1])[0][0];
            counts.set(tag.toLowerCase(), entry);
        }
    }
    for (const tag of activeTags) if (!counts.has(tag)) activeTags.delete(tag);

    const row = $('#tag_filter');
    row.hidden = !counts.size;
    const chips = [...counts].sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([key, { label, n }]) => {
        const chip = el('button', 'tag_chip' + (activeTags.has(key) ? ' active' : ''), `${label} ${n}`);
        chip.type = 'button';
        chip.dataset.tag = key;
        chip.setAttribute('aria-pressed', activeTags.has(key));
        return chip;
    });
    row.replaceChildren(el('span', '', 'Tags'), ...chips);
}

function sourceRow(source) {
    const status = source.status || 'to_read';
    const link = el('a', 'source_row');
    link.href = materialUrl(source.id);
    // a preview of it, blurred, behind the card: its PDF's first page or the video's thumbnail
    if (Bookshelf.canPreview(source)) {
        const preview = el('span', 'row_preview');
        preview.setAttribute('aria-hidden', 'true');
        preview.dataset.source = source.id;
        link.append(preview);
        link.classList.add('has_preview');
    }
    link.append(el('strong', '', source.title), el('small', '', shortCitation(source) || 'No authors yet'));

    const badges = el('div', 'row_tags');
    badges.append(el('span', 'badge ' + status, STATUS_LABELS[status]));
    if (videoInfo(source)) badges.append(el('span', 'badge material', '▶ Video'));
    else if (hasMaterial(source)) badges.append(el('span', 'badge material', 'Full text'));
    const notes = notesOf(source).length;
    if (notes) badges.append(el('small', '', `${notes} note${notes > 1 ? 's' : ''}`));
    if (source.unverified) badges.append(el('span', 'badge check', 'Check details'));
    link.append(badges);
    // added from another paper's references
    const citer = (source.citedIn || []).map(id => items.find(i => i.id === id && i.type === 'source')).find(Boolean);
    if (citer) link.append(el('small', 'cited_from', 'From the references of ' + (shortCitation(citer) || citer.title)));

    if (tagsOf(source).length) {
        const tags = el('ul', 'tags');
        tags.append(...tagsOf(source).map(tag => el('li', 'tag', tag)));
        link.append(tags);
    }

    // copy its citation without opening it
    const cite = el('button', 'row_cite', '❝ Cite');
    cite.type = 'button';
    cite.dataset.id = source.id;
    cite.title = 'Copy its citation (' + (Cite.STYLES[project.citeStyle || 'apa'] || 'project style') + ')';
    cite.setAttribute('aria-label', 'Copy the citation of ' + source.title);

    const li = el('li', 'source_item');
    li.append(link, cite);
    return li;
}

$('#source_list').addEventListener('click', async e => {
    const btn = e.target.closest('.row_cite');
    if (!btn) return;
    const source = items.find(i => i.id === btn.dataset.id);
    if (!source) return;
    assignCitekeys(sourceItems());
    const ok = await copyText(Cite.format(source, project.citeStyle || 'apa'));
    btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
    setTimeout(() => { btn.textContent = '❝ Cite'; }, 1600);
});

// ---- export bibliography ----

function updateExport() {
    const f = exportForm.elements;
    const list = exportPicker.selected().sort(byAuthor);
    f.output.value = list
        .map((source, i) => (f.style.value === 'ieee' ? `[${i + 1}] ` : '') + Cite.format(source, f.style.value))
        .join('\n\n');
    $('#export_count').textContent = `${list.length} reference${list.length === 1 ? '' : 's'}, by first author`;
}

// ---- summaries digest ----

// your images are stored in this browser only, so exported text names them instead
const forExport = markdown => markdown.replace(/!\[([^\]]*)\]\(asset:[a-z0-9]+\)/gi, '[image: $1]');

// one bullet per sentence; lines that are already a list stay as they are
function toBullets(text) {
    const sentences = line => window.Intl?.Segmenter
        ? [...new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(line)].map(s => s.segment.trim()).filter(Boolean)
        : [line];
    return text.split(/\n+/).map(line => line.trim()).filter(Boolean).flatMap(line =>
        /^([-*+]|\d+\.)\s/.test(line) ? [line.replace(/^([*+]|\d+\.)\s/, '- ')] : sentences(line).map(s => '- ' + s));
}

function section(label, text, layout) {
    if (!text) return [`**${label}:** _not written yet_`];
    return [`**${label}**`, '', ...(layout === 'bullets' ? toBullets(text) : [text])];
}

function noteLine(note) {
    const where = note.where || [note.page ? 'p. ' + note.page : '', note.line ? 'l. ' + note.line : ''].filter(Boolean).join(' · ');
    const quote = note.quote ? `“${note.quote.length > 160 ? note.quote.slice(0, 160) + '…' : note.quote}” ` : '';
    const body = (note.body || '').replace(/\s*\n+\s*/g, ' ');
    const answer = note.kind === 'question' && note.answer ? ` → ${note.answer.replace(/\s*\n+\s*/g, ' ')}` : '';
    return `- ${where ? `(${where}) ` : ''}${quote}${note.kind === 'question' ? '**Q:** ' : ''}${body}${answer}`;
}

function digestMarkdown(list, options) {
    const lines = [`# Literature summaries: ${project.title}`, ''];
    for (const source of list) {
        lines.push(`## ${source.title}`, '');
        if (options.citation) lines.push(`_${Cite.format(source, 'apa')}_`, '');
        else if (shortCitation(source)) lines.push(`_${shortCitation(source)}_`, '');
        lines.push(...section('Summary', summaryOf(source), options.layout), '');
        if (options.review) lines.push(...section('Review', source.review, options.layout), '');
        if (options.notes) {
            const notes = notesOf(source).sort((a, b) => a.createdAt - b.createdAt);
            if (notes.length) lines.push('**Notes**', '', ...notes.map(noteLine), '');
        }
    }
    return lines.join('\n');
}

let digestText = '';

function updateDigest() {
    const f = digestForm.elements;
    let list = digestPicker.selected().sort(byAuthor);
    if (f.skipEmpty.checked) list = list.filter(s => summaryOf(s));
    digestText = digestMarkdown(list, {
        layout: f.layout.value,
        citation: f.citation.checked,
        review: f.review.checked,
        notes: f.notes.checked,
    });
    renderMarkdown($('#digest_preview'), digestText);
    $('#digest_count').textContent = `${list.length} source${list.length === 1 ? '' : 's'}`;
}

// ---- events ----

// ---- + From library: a material from the library (on its own, or in another project) ----

function renderLibraryResults() {
    const query = $('#library_search').value.trim().toLowerCase();
    const books = Library.books().filter(b => !Library.inProject(b, project.id))
        .filter(b => !query || [b.source.title, authorsLine(b.source), b.source.venue, ...b.copies.map(c => c.project.title)].join(' ').toLowerCase().includes(query))
        .sort((a, b) => b.added - a.added);
    $('#library_results').replaceChildren(...(books.length ? books.map(book => {
        const li = el('li', 'library_result');
        const where = book.copies.map(c => (c.project.library ? 'Library only' : c.project.title)).join(', ');
        li.append(el('strong', '', book.source.title), el('small', '', [shortCitation(book.source), where].filter(Boolean).join(' · ')));
        const add = el('button', 'btn small', '+ Add');
        add.type = 'button';
        add.dataset.key = book.key;
        li.append(add);
        return li;
    }) : [el('li', 'none', query ? 'Nothing in your library matches.' : 'Everything in your library is in this project already.')]));
}

$('#from_library').onclick = () => {
    $('#library_search').value = '';
    $('#library_state').textContent = '';
    renderLibraryResults();
    openModal($('#from_library_form'));
    $('#library_search').focus();
};
$('#library_search').oninput = renderLibraryResults;
$('#from_library_form').addEventListener('submit', e => e.preventDefault());
$('#library_results').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-key]');
    if (!btn) return;
    btn.disabled = true;
    const book = Library.books().find(b => b.key === btn.dataset.key);
    // prefer the copy on its own in the library (it moves here); else copy one from another project
    const from = book.copies.find(c => c.project.library)?.source || book.source;
    await Library.addToProject(from, project.id);
    $('#library_state').textContent = `Added "${book.source.title}" ✓`;
    render();
    renderLibraryResults();
});

$('#add_source').onclick = () => SourceForm.open(null, {
    projectId: project.id,
    onSaved: id => { location.href = materialUrl(id); },
});
$('#source_search').oninput = renderLiterature;
$('#source_filter').onchange = renderLiterature;

$('#tag_filter').addEventListener('click', e => {
    const chip = e.target.closest('.tag_chip');
    if (!chip) return;
    if (activeTags.has(chip.dataset.tag)) activeTags.delete(chip.dataset.tag);
    else activeTags.add(chip.dataset.tag);
    renderLiterature();
});

$('#add_figure').onclick = () => {
    const input = el('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => uploadFigures(input.files);
    input.click();
};

$('#project_cite_style').onchange = e => {
    project.citeStyle = e.target.value;
    Store.saveProject({ id: project.id, citeStyle: e.target.value });
};

$('#open_export').onclick = () => {
    assignCitekeys(sourceItems()); // BibTeX keys match the ones used in the review
    exportForm.elements.style.value = project.citeStyle || 'apa';
    exportPicker.reset();
    updateExport();
    openModal(exportForm);
};
exportForm.elements.style.addEventListener('change', updateExport);
$('#copy_export').onclick = async e => {
    const ok = await copyText(exportForm.elements.output.value);
    e.target.textContent = ok ? 'Copied ✓' : 'Copy failed';
    setTimeout(() => { e.target.textContent = 'Copy'; }, 1600);
};
$('#download_export').onclick = () => {
    const bibtex = exportForm.elements.style.value === 'bibtex';
    downloadText(bibtex ? 'bibliography.bib' : 'bibliography.txt', exportForm.elements.output.value);
};

$('#open_digest').onclick = () => {
    digestPicker.reset();
    updateDigest();
    openModal(digestForm);
};
// layout and include options (the picker reports its own changes)
digestForm.addEventListener('change', e => { if (!e.target.closest('.picker')) updateDigest(); });
$('#copy_digest').onclick = async e => {
    const ok = await copyText(forExport(digestText));
    e.target.textContent = ok ? 'Copied ✓' : 'Copy failed';
    setTimeout(() => { e.target.textContent = 'Copy'; }, 1600);
};
$('#download_digest').onclick = () => {
    const name = project.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'literature';
    downloadText(`${name}_summaries.md`, forExport(digestText), 'text/markdown');
};

for (const form of [exportForm, digestForm]) form.addEventListener('submit', e => e.preventDefault());

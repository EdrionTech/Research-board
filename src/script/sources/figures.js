// Project figures and tables ("features"): images and tables that belong to the project itself,
// ready to reuse in your writing with the right credit. They come from a source's page (📷 Capture,
// ★ Save as figure / table on a picture or table) or are uploaded on the Literature tab.
//
// item: { type: 'figure', projectId, kind: 'figure' | 'table', caption,
//         file?: { assetId, mime, name }   – a picture
//         table?: '<table>…</table>'       – a real table (from an arXiv paper), kept as a table
//         sourceId?, locator? ("p. 4", "Fig. 2", "Table I", "12:34"),
//         credit?: 'from' | 'adapted'      – reproduced as is, or cropped / changed
//         createdAt, updatedAt }

const figureItems = items => items.filter(i => i.type === 'figure').sort((a, b) => b.createdAt - a.createdAt);
const figureLabel = figure => (figure.kind === 'table' ? 'Table' : 'Figure');

// the credit line in a style, e.g. "From “Title,” by A. Vaswani…, 2017, arXiv, p. 3."
function figureCredit(figure, source, style) {
    return source ? Cite.credit(source, style, { locator: figure.locator, adapted: figure.credit === 'adapted' }) : '';
}

// For your writing, laid out the APA way: number, then title, then the figure or table, then the note.
//   **Figure #**  *Caption*  ![…](asset:ID) or <table>  *Note.* [credit: @key, p. 3]
// "Figure #" / "Table #" become Figure 1, 2… and Table 1, 2… in the preview and exports, and
// [credit: …] / [adapted: …] become the credit line in the project's style (the source also goes in
// the reference list).
function figureMarkdown(figure, source) {
    const caption = (figure.caption || figureLabel(figure)).replace(/[[\]*_]/g, '').trim();
    const content = figure.table ? figure.table.replace(/\n\s*\n/g, '\n') : `![${caption}](asset:${figure.file.assetId})`;
    const note = source?.citekey
        ? `*Note.* [${figure.credit === 'adapted' ? 'adapted' : 'credit'}: @${source.citekey}${figure.locator ? ', ' + figure.locator : ''}]`
        : '';
    return [`**${figureLabel(figure)} #**`, `*${caption}*`, content, note].filter(Boolean).join('\n\n');
}

// numbers "Figure #" and "Table #" in order, each on its own count
function numberFigures(markdown) {
    const count = { Figure: 0, Table: 0 };
    return markdown.replace(/\b(Figure|Table) #/g, (_, kind) => `${kind} ${++count[kind]}`);
}

// A card: the picture (or the table), its caption and where it came from; `actions` are extra buttons.
function figureCard(figure, source, actions = []) {
    const card = el('li', 'figure_card');
    card.dataset.id = figure.id;
    if (figure.table) {
        const preview = el('div', 'figure_table');
        preview.innerHTML = window.DOMPurify ? DOMPurify.sanitize(figure.table) : '';
        card.append(preview);
    } else {
        const img = el('img');
        img.setAttribute('src', '#asset-' + figure.file.assetId);
        img.alt = figure.caption || 'Figure';
        card.append(img);
        loadAssetImages(card); // writing/markdown.js
    }
    const kind = el('span', 'badge figure_kind', figureLabel(figure) + (figure.credit === 'adapted' ? ' · adapted' : ''));
    card.append(kind, el('strong', '', figure.caption || 'Untitled'));
    const origin = source ? [source.title, figure.locator].filter(Boolean).join(' · ') : figure.sourceId ? 'From a deleted source' : 'Uploaded (yours)';
    card.append(el('small', '', origin));
    if (actions.length) {
        const row = el('div', 'figure_actions');
        row.append(...actions);
        card.append(row);
    }
    return card;
}

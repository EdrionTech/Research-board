// Literature review editor: the project's review, stored as Markdown.
// Opened as review.html?id=<projectId>. The review is one item of type 'lit_review'.
//
// Citations use each source's key (assignCitekeys in sources/sources.js):
//   [@key]  [@key, p. 4]  [@a; @b, 12:34]   in-text, in brackets         -> (Vaswani et al., 2017, p. 4)
//   @key                                     the authors in your sentence -> Vaswani et al. (2017)
// The preview and exports turn these into citations in the project's style (sources/cite.js)
// and add a reference list of everything cited.
//
// Two ways to write, switchable at any time:
//   Markdown - the source text (the textarea; it is always what gets saved)
//   Visual   - the formatted text, edited directly; citations show as finished chips.
//              Changes are turned back into Markdown with Turndown.

const project = Store.getProject(new URLSearchParams(location.search).get('id'));
const editor = $('#review_text');    // Markdown (always kept up to date)
const visual = $('#visual_editor');  // Visual mode
const KEY = '[\\w:.\\-]*\\w';
const MODE_KEY = 'research_board_review_mode';
const TEMPLATE = '# Literature review\n\n## Introduction\n\n\n## Themes\n\n### Theme 1\n\n\n## Gaps and open questions\n\n\n## Conclusion\n';

let sources = [];
let byKey = new Map();
let notesBySource = new Map();
let doc = null;          // the saved review item (null until you first type)
let mode = 'markdown';
let saveTimer = null;
let previewTimer = null;
let syncTimer = null;    // Visual -> Markdown, shortly after you stop typing
let savedRange = null;   // where the caret was in the Visual editor
let suggestions = [];

const styleOf = () => project.citeStyle || 'apa';
const fileName = () => (project.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'project') + '_literature_review';
const escapeHtml = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function init() {
    document.title = project.title + ' · Literature review';
    const back = $('#back_link');
    back.href = 'project_dashboard.html?id=' + encodeURIComponent(project.id) + '#literature';
    back.textContent = '← ' + project.title;

    for (const [value, label] of Object.entries(Cite.INLINE_STYLES)) $('#cite_style').append(new Option(label, value));
    $('#cite_style').value = styleOf();

    loadSources();
    doc = Store.getItems(project.id).find(i => i.type === 'lit_review') || null;
    editor.value = doc?.body ?? TEMPLATE;
    $('#save_state').textContent = doc ? 'Saved' : '';
    MdImages.enable(editor);
    document.execCommand('defaultParagraphSeparator', false, 'p');

    if (!turndown) {
        const btn = $('#mode_toggle [data-mode="visual"]');
        btn.disabled = true;
        btn.title = "Visual mode needs the Turndown library, which didn't load (offline?)";
    }
    let saved = 'visual';
    try { saved = localStorage.getItem(MODE_KEY) || 'visual'; } catch { }
    setMode(turndown ? saved : 'markdown');
    renderSources();
    renderFigures();
    renderPreview();
}

// sources and their notes (re-read when you come back from another tab)
function loadSources() {
    const all = Store.getItems(project.id);
    sources = all.filter(i => i.type === 'source').sort((a, b) => a.title.localeCompare(b.title));
    assignCitekeys(sources);
    byKey = new Map(sources.map(s => [s.citekey, s]));
    notesBySource = new Map(sources.map(s => [s.id, []]));
    for (const note of all.filter(i => i.type === 'source_note').sort((a, b) => a.createdAt - b.createdAt)) {
        notesBySource.get(note.sourceId)?.push(note);
    }
}

// ---- citations -> text ----

// "@a; @b, p. 4" -> [{ key: 'a', locator: '' }, { key: 'b', locator: 'p. 4' }], or null if it isn't a citation
function parseGroup(group) {
    const parts = group.split(';').map(part => part.trim().match(new RegExp(`^@(${KEY})\\s*,?\\s*(.*)$`)));
    return parts.some(m => !m) ? null : parts.map(([, key, locator]) => ({ key, locator: locator.trim() }));
}

function groupText(items, number, style) {
    const unknown = items.filter(i => !byKey.has(i.key));
    if (unknown.length) return `[?${unknown.map(i => i.key).join('; ')}]`;
    return Cite.parenthetical(items.map(i => ({ source: byKey.get(i.key), locator: i.locator, n: number.get(i.key) })), style);
}

function creditText({ key, locator }, number, style, adapted) {
    if (!byKey.has(key)) return `[?${key}]`;
    return Cite.credit(byKey.get(key), style, { locator, adapted, n: number.get(key) });
}

// the text a citation shows (chips in Visual mode): [@a; @b], [credit: @a, p. 3], or @key
function citationText(raw, number, style) {
    const bracket = raw.match(/^\[(?:(credit|adapted):\s*)?(@[^[\]]+)\]$/);
    if (!bracket) return narrativeText(raw.slice(1), number, style);
    const items = parseGroup(bracket[2]);
    if (!items) return raw;
    return bracket[1] ? creditText(items[0], number, style, bracket[1] === 'adapted') : groupText(items, number, style);
}

function narrativeText(key, number, style) {
    return byKey.has(key) ? Cite.narrative({ source: byKey.get(key), locator: '', n: number.get(key) }, style) : `[?${key}]`;
}

// Replaces [@…] groups and @key with citations. `wrap(raw, text)` decides how each one is written
// (plain text for the preview, a chip for the Visual editor). Returns the text, the sources cited
// (in order), their numbers (for IEEE) and unknown keys.
function resolve(text, style, wrap = (raw, out) => out) {
    const cited = [];
    const number = new Map();
    const missing = new Set();
    const use = key => {
        if (!byKey.has(key)) missing.add(key);
        else if (!number.has(key)) {
            number.set(key, cited.length + 1);
            cited.push(byKey.get(key));
        }
    };
    // [@a; @b, p. 4], the credit under a reused figure / table ([credit: @a, p. 3], [adapted: …]), or @key
    const pattern = new RegExp(`\\[(?:(credit|adapted):\\s*)?(@[^\\[\\]]+)\\]|(^|[^\\w@\\[\\]])@(${KEY})`, 'gm');
    const out = text.replace(pattern, (match, creditMode, group, before, key) => {
        if (group) {
            const items = parseGroup(group);
            if (!items || (creditMode && items.length !== 1)) return match;
            items.forEach(item => use(item.key));
            return wrap(match, creditMode ? creditText(items[0], number, style, creditMode === 'adapted') : groupText(items, number, style));
        }
        if (!byKey.has(key)) return match;
        use(key);
        return before + wrap('@' + key, narrativeText(key, number, style));
    });
    return { text: out, cited, number, missing: [...missing] };
}

// the whole review with citations resolved and the reference list added
function fullMarkdown() {
    flushVisual();
    const style = styleOf();
    const { text, cited, missing } = resolve(editor.value, style, (raw, out) => out.startsWith('[?') ? `**${out}**` : out);
    const references = cited.length ? `\n\n## References\n\n${Cite.referenceList(cited, style).join('\n\n')}\n` : '';
    return { markdown: numberFigures(text.trimEnd()) + references, cited, missing };
}

// ---- preview and counts ----

function renderPreview() {
    const { markdown, cited, missing } = fullMarkdown();
    renderMarkdown($('#preview'), markdown, 'Start writing on the left.');
    markReferences($('#preview'));
    const words = (editor.value.replace(/\[@[^\]]*\]|@[\w:.-]+/g, ' ').match(/[\p{L}\p{N}'’-]+/gu) || []).length;
    $('#counts').textContent = `${words.toLocaleString()} words · ${cited.length} source${cited.length === 1 ? '' : 's'} cited`;
    $('#cite_warning').hidden = !missing.length;
    $('#cite_warning').textContent = missing.length
        ? `Unknown citation key${missing.length > 1 ? 's' : ''}: ${missing.map(k => '@' + k).join(', ')}. Pick sources from the Sources tab.`
        : '';
}

// reference entries get a hanging indent
function markReferences(container) {
    const heading = [...container.querySelectorAll('h2')].reverse().find(h => h.textContent.trim() === 'References');
    for (let node = heading?.nextElementSibling; node; node = node.nextElementSibling) node.classList.add('reference');
}

// ---- saving (as you type) ----

function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const id = Store.saveItem({ id: doc?.id, projectId: project.id, type: 'lit_review', title: 'Literature review', body: editor.value });
    doc = Store.getItem(id);
    $('#save_state').textContent = 'Saved';
}

// the Markdown changed (typed, or synced from Visual): save and refresh the preview soon
function changed() {
    $('#save_state').textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 500);
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 250);
}

// ---- switching modes ----

function setMode(next) {
    if (next === 'visual' && !turndown) return;
    if (mode === 'visual') flushVisual();
    mode = next;
    try { localStorage.setItem(MODE_KEY, mode); } catch { }
    for (const btn of $$('#mode_toggle button')) btn.setAttribute('aria-pressed', btn.dataset.mode === mode);
    editor.hidden = mode !== 'markdown';
    visual.hidden = mode !== 'visual';
    for (const hint of $$('.writer .hint')) hint.hidden = hint.dataset.for !== mode;
    hideSuggestions();
    if (mode === 'visual') renderVisual();
}

// ---- Visual mode ----

const turndown = window.TurndownService ? new TurndownService({
    headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '_', strongDelimiter: '**', codeBlockStyle: 'fenced',
}) : null;

if (turndown) {
    // citation chips go back to what you'd type: [@key, p. 4] / @key
    turndown.addRule('citation', {
        filter: node => node.nodeName === 'SPAN' && node.classList.contains('cite'),
        replacement: (content, node) => node.dataset.cite,
    });
    // your stored images go back to ![name](asset:ID)
    turndown.addRule('assetImage', {
        filter: node => node.nodeName === 'IMG' && !!node.dataset.asset,
        replacement: (content, node) => `![${node.alt || ''}](asset:${node.dataset.asset})`,
    });
    // "- item" rather than Turndown's "-   item"
    // tables (from a saved table feature) stay real tables in the Markdown
    turndown.keep(['table']);
    turndown.addRule('listItem', {
        filter: 'li',
        replacement(content, node, options) {
            content = content.replace(/^\n+/, '').replace(/\n+$/, '\n').replace(/\n/gm, '\n  ');
            const list = node.parentNode;
            let prefix = options.bulletListMarker + ' ';
            if (list.nodeName === 'OL') prefix = (Number(list.getAttribute('start') || 1) + [...list.children].indexOf(node)) + '. ';
            return prefix + content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '');
        },
    });
}

// (the "//" of a web address is written as entities so Markdown doesn't turn it into a link inside the chip)
const citeChip = (raw, text) =>
    `<span class="cite${text.startsWith('[?') ? ' missing' : ''}" data-cite="${escapeHtml(raw)}" contenteditable="false">${escapeHtml(text).replace(/:\/\//g, ':&#47;&#47;')}</span>`;

// Markdown -> HTML for the Visual editor, citations as chips (block: whole paragraphs; else inline)
function visualHtml(markdown, block = true) {
    const { text } = resolve(markdown, styleOf(), citeChip);
    const prepared = text.replace(/\]\(asset:([a-z0-9]+)\)/gi, '](#asset-$1)');
    return DOMPurify.sanitize(block ? marked.parse(prepared) : marked.parseInline(prepared));
}

function renderVisual() {
    visual.innerHTML = editor.value.trim() ? visualHtml(editor.value) : '<p><br></p>';
    loadAssetImages(visual);   // stored images (writing/markdown.js)
    lockChips();
    savedRange = null;
}

// DOMPurify drops contenteditable, so set it again: chips are edited as a whole
function lockChips() {
    for (const chip of visual.querySelectorAll('.cite')) chip.contentEditable = 'false';
}

// citation numbers / texts can change as you edit (IEEE order, a new locator): refresh the chips
function refreshChips() {
    const style = styleOf();
    const { number } = resolve(editor.value, style);
    for (const chip of visual.querySelectorAll('.cite')) {
        const text = citationText(chip.dataset.cite, number, style);
        if (chip.textContent !== text) chip.textContent = text;
        chip.classList.toggle('missing', text.startsWith('[?'));
    }
}

// Visual -> Markdown now
function syncFromVisual() {
    clearTimeout(syncTimer);
    syncTimer = null;
    editor.value = turndown.turndown(visual).replace(/\n{3,}/g, '\n\n').trim() + '\n';
    refreshChips();
    changed();
}

function flushVisual() {
    if (syncTimer) syncFromVisual();
}

function onVisualInput() {
    lockChips();
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncFromVisual, 300);
    $('#save_state').textContent = 'Saving…';
    suggestCitations();
}

// put the caret back where it was in the Visual editor (or at the end)
function restoreVisualCaret() {
    visual.focus();
    const selection = getSelection();
    let range = savedRange && visual.contains(savedRange.startContainer) ? savedRange : null;
    if (!range) {
        range = document.createRange();
        range.selectNodeContents(visual);
        range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
}

// Inserts at the caret through the DOM: the browser's insertHTML command would strip the citation chips.
function visualInsertHtml(html) {
    restoreVisualCaret();
    const selection = getSelection();
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const template = document.createElement('template');
    template.innerHTML = html;
    const last = template.content.lastChild;
    range.insertNode(template.content);
    if (last) placeCaretAfter(last);
    loadAssetImages(visual); // inserted figures / images show straight away
    onVisualInput();
}

// Inserts paragraphs after the paragraph (heading, list…) the caret is in.
function visualInsertBlock(html) {
    restoreVisualCaret();
    const { startContainer } = getSelection().getRangeAt(0);
    let block = startContainer.nodeType === Node.ELEMENT_NODE ? startContainer : startContainer.parentElement;
    while (block && block.parentElement !== visual) block = block.parentElement;
    const template = document.createElement('template');
    template.innerHTML = html;
    const last = template.content.lastChild;
    if (block && block !== visual) block.after(template.content);
    else visual.append(template.content);
    if (last) placeCaretAfter(last);
    loadAssetImages(visual); // inserted figures / images show straight away
    onVisualInput();
}

function placeCaretAfter(node) {
    const range = document.createRange();
    if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('cite') && node.nodeName !== 'IMG') {
        range.selectNodeContents(node);
        range.collapse(false);
    } else {
        range.setStartAfter(node);
        range.collapse(true);
    }
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    savedRange = range.cloneRange();
}

// the character / element just before the caret in the Visual editor
function visualBefore() {
    restoreVisualCaret();
    const { startContainer: node, startOffset: offset } = getSelection().getRangeAt(0);
    if (node.nodeType === Node.TEXT_NODE && offset > 0) return { char: node.data[offset - 1] };
    let previous = node.nodeType === Node.TEXT_NODE ? node.previousSibling : node.childNodes[offset - 1];
    while (previous?.nodeType === Node.TEXT_NODE && !previous.data) previous = previous.previousSibling;
    if (previous?.nodeType === Node.TEXT_NODE) return { char: previous.data.at(-1) };
    return { element: previous || null, char: previous ? 'x' : '' };
}

async function addVisualImages(files) {
    for (const file of [...files].filter(f => f.type.startsWith('image/'))) {
        try {
            const id = await Store.putAsset(file);
            visualInsertHtml(`<img data-asset="${id}" alt="${escapeHtml((file.name || 'image').replace(/[[\]]/g, ''))}" src="${URL.createObjectURL(file)}">`);
        } catch {
            alert("Couldn't save the image in this browser (private window or storage full?).");
            return;
        }
    }
}

// ---- inserting (both modes) ----

function insertText(text) {
    editor.focus();
    editor.setRangeText(text, editor.selectionStart, editor.selectionEnd, 'end');
    changed();
}

// within a sentence: with a space before it if needed
function insertInline(text) {
    if (mode === 'visual') {
        const { char } = visualBefore();
        visualInsertHtml((char && !/[\s(]/.test(char) ? ' ' : '') + visualHtml(text, false));
        return;
    }
    const before = editor.value.slice(0, editor.selectionStart);
    insertText((before && !/[\s(]$/.test(before) ? ' ' : '') + text);
}

// as its own paragraph
function insertBlock(text) {
    if (mode === 'visual') {
        visualInsertBlock(visualHtml(text));
        return;
    }
    const before = editor.value.slice(0, editor.selectionStart);
    const lead = !before || /\n\n$/.test(before) ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    insertText(lead + text + '\n\n');
}

// [@key], or added to the citation just before the caret: [@a] -> [@a; @key]
function insertCitation(key, locator = '') {
    const cite = '@' + key + (locator ? ', ' + locator : '');
    if (mode === 'visual') {
        const { element } = visualBefore();
        if (element?.classList?.contains('cite') && element.dataset.cite.startsWith('[')) {
            element.dataset.cite = element.dataset.cite.slice(0, -1) + '; ' + cite + ']';
            syncFromVisual();
            return;
        }
        insertInline(`[${cite}]`);
        return;
    }
    const before = editor.value.slice(0, editor.selectionStart);
    if (/\[@[^[\]]*\]$/.test(before)) {
        const at = editor.selectionStart - 1;
        editor.focus();
        editor.setRangeText('; ' + cite, at, at, 'end');
        editor.selectionStart = editor.selectionEnd = at + cite.length + 3;
        changed();
        return;
    }
    insertInline(`[${cite}]`);
}

// "p. 4", "§3 ¶2", "12:34" from where a note is attached
const locatorOf = note => (note.page ? 'p. ' + note.page : note.where || '').replace(/\s*·\s*(area|image)$/, '');

// ---- toolbar ----

// Markdown mode: the shared edits (writing/mdbar.js); they can be undone, and fire `input` (which saves)
const wrapSelection = mark => MdBar.wrap(editor, mark);
const prefixLines = prefix => MdBar.prefix(editor, prefix);

// Visual mode: the browser's own formatting commands
function visualCommand(command, value) {
    restoreVisualCaret();
    document.execCommand(command, false, value);
    onVisualInput();
}

function visualBlock(tag) {
    restoreVisualCaret();
    const current = document.queryCommandValue('formatBlock').toLowerCase();
    document.execCommand('formatBlock', false, current === tag ? 'p' : tag);
    onVisualInput();
}

function pickImages() {
    if (mode === 'markdown') return MdImages.pick(editor);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => addVisualImages(input.files);
    input.click();
}

const ACTIONS = {
    h2: () => (mode === 'visual' ? visualBlock('h2') : prefixLines('## ')),
    h3: () => (mode === 'visual' ? visualBlock('h3') : prefixLines('### ')),
    bold: () => (mode === 'visual' ? visualCommand('bold') : wrapSelection('**')),
    italic: () => (mode === 'visual' ? visualCommand('italic') : wrapSelection('_')),
    list: () => (mode === 'visual' ? visualCommand('insertUnorderedList') : prefixLines('- ')),
    numbered: () => (mode === 'visual' ? visualCommand('insertOrderedList') : prefixLines('1. ')),
    quote: () => (mode === 'visual' ? visualBlock('blockquote') : prefixLines('> ')),
    link: () => {
        if (mode === 'markdown') return MdBar.link(editor);
        restoreVisualCaret();
        const url = prompt('Link address', 'https://');
        if (url && url !== 'https://') visualCommand('createLink', url);
    },
    // phones and tablets have no Ctrl + Z
    undo: () => (mode === 'visual' ? visualCommand('undo') : (editor.focus(), document.execCommand('undo'))),
    redo: () => (mode === 'visual' ? visualCommand('redo') : (editor.focus(), document.execCommand('redo'))),
    cite: () => {
        showTab('sources');
        $('#source_search').focus();
    },
    image: pickImages,
};

// ---- @ suggestions while typing (both modes) ----

// text just before the caret
function textBeforeCaret() {
    if (mode === 'markdown') return editor.value.slice(0, editor.selectionStart);
    const selection = getSelection();
    if (!selection.rangeCount || !visual.contains(selection.anchorNode)) return '';
    const { startContainer: node, startOffset: offset, collapsed } = selection.getRangeAt(0);
    return collapsed && node.nodeType === Node.TEXT_NODE ? node.data.slice(0, offset) : '';
}

function hideSuggestions() {
    $('#cite_suggest').hidden = true;
    suggestions = [];
}

function suggestCitations() {
    const typed = textBeforeCaret().match(/(?:^|[\s([; ])@([\w:.-]*)$/)?.[1];
    if (typed === undefined) return hideSuggestions();
    const query = typed.toLowerCase();
    suggestions = sources.filter(s => [s.citekey, s.title, shortCitation(s)].join(' ').toLowerCase().includes(query)).slice(0, 6);
    const box = $('#cite_suggest');
    box.hidden = !suggestions.length;
    box.replaceChildren(el('small', '', 'Cite:'), ...suggestions.map((s, i) => {
        const btn = el('button', i === 0 ? 'first' : '', '');
        btn.type = 'button';
        btn.dataset.key = s.citekey;
        btn.append(el('strong', '', '@' + s.citekey), el('span', '', ' ' + (shortCitation(s) || s.title)));
        return btn;
    }), el('small', 'kbd', 'Enter or Tab to pick the first'));
}

function completeCitation(key) {
    if (mode === 'visual') {
        // replace the typed "@…" (and "[" before it) with a finished citation chip
        const selection = getSelection();
        const { startContainer: node, startOffset: offset } = selection.getRangeAt(0);
        const typed = node.data.slice(0, offset).match(/(\[?)@([\w:.-]*)$/);
        const range = document.createRange();
        range.setStart(node, offset - typed[0].length);
        range.setEnd(node, offset + (typed[1] && node.data[offset] === ']' ? 1 : 0));
        selection.removeAllRanges();
        selection.addRange(range);
        savedRange = range;
        const raw = typed[1] ? `[@${key}]` : `@${key}`;
        hideSuggestions();
        visualInsertHtml(visualHtml(raw, false));
        syncFromVisual();
        return;
    }
    const before = editor.value.slice(0, editor.selectionStart);
    const typed = before.match(/@([\w:.-]*)$/)[1];
    const start = editor.selectionStart - typed.length;
    // after "[@" close the bracket too, unless it's already there
    const close = /\[@[\w:.-]*$/.test(before) && editor.value[editor.selectionStart] !== ']' ? ']' : '';
    editor.focus();
    editor.setRangeText(key + close, start, editor.selectionStart, 'end');
    hideSuggestions();
    changed();
}

// shared keys while writing: complete a suggestion, close suggestions
function writingKeys(e) {
    if (suggestions.length && (e.key === 'Enter' || e.key === 'Tab')) {
        e.preventDefault();
        completeCitation(suggestions[0].citekey);
    } else if (e.key === 'Escape') {
        hideSuggestions();
    }
}

// ---- sources tab ----

function renderSources() {
    const query = $('#source_search').value.trim().toLowerCase();
    const matches = s => [s.title, s.citekey, shortCitation(s), tagsOf(s).join(' '), summaryOf(s),
        ...(notesBySource.get(s.id) || []).map(n => `${n.quote || ''} ${n.body || ''}`)].join(' ').toLowerCase().includes(query);
    const shown = sources.filter(matches);
    $('#source_cards').replaceChildren(...(shown.length ? shown.map(sourceCard)
        : [el('p', 'placeholder', sources.length ? 'No sources match.' : 'No sources in this project yet.')]));
}

function button(label, title, onClick) {
    const btn = el('button', 'btn small', label);
    btn.type = 'button';
    btn.title = title;
    btn.onclick = onClick;
    return btn;
}

function sourceCard(source) {
    const card = el('details', 'source_card');
    const head = el('summary');
    head.append(el('strong', '', source.title), el('small', '', `@${source.citekey} · ${shortCitation(source) || 'no authors'}`));
    card.append(head);

    const actions = el('div', 'card_actions');
    actions.append(
        button('Cite', 'Insert an in-text citation (Author, year)', () => insertCitation(source.citekey)),
        button('Cite by name', 'Insert the authors as part of your sentence: Author (year)', () => insertInline(`@${source.citekey}`)),
    );
    const summary = summaryOf(source);
    if (summary) actions.append(button('Insert summary', 'Insert your summary of this source, cited', () => insertBlock(`${summary} [@${source.citekey}]`)));
    card.append(actions);

    if (tagsOf(source).length) {
        const tags = el('ul', 'tags');
        tags.append(...tagsOf(source).map(tag => el('li', 'tag', tag)));
        card.append(tags);
    }
    if (summary) {
        const text = el('div', 'md card_summary');
        renderMarkdown(text, summary);
        card.append(text);
    }

    const notes = notesBySource.get(source.id) || [];
    if (notes.length) {
        const list = el('ul', 'card_notes');
        for (const note of notes) {
            const li = el('li');
            const locator = locatorOf(note);
            if (locator) li.append(el('small', 'where', locator));
            if (note.quote) li.append(el('blockquote', '', note.quote));
            if (note.body) li.append(el('p', '', note.body));
            const row = el('div', 'card_actions');
            if (note.quote) {
                row.append(button('Quote', 'Insert the quoted words with a citation', () =>
                    insertInline(`“${note.quote.replace(/…$/, '')}” [@${source.citekey}${locator ? ', ' + locator : ''}]`)));
            }
            if (note.body) {
                row.append(button('Insert note', 'Insert your note as a paragraph, cited', () =>
                    insertBlock(`${note.body} [@${source.citekey}${locator ? ', ' + locator : ''}]`)));
            }
            li.append(row);
            list.append(li);
        }
        card.append(list);
    }
    return card;
}

function showTab(tab) {
    for (const btn of $$('#tabs button')) btn.setAttribute('aria-selected', btn.dataset.tab === tab);
    $('#preview').hidden = tab !== 'preview';
    $('#sources_tab').hidden = tab !== 'sources';
    $('#figures_tab').hidden = tab !== 'figures';
}

// ---- figures tab (sources/figures.js) ----

function renderFigures() {
    const all = Store.getItems(project.id);
    const figures = figureItems(all);
    $('#review_figures').replaceChildren(...(figures.length ? figures.map(figure => {
        const source = sources.find(s => s.id === figure.sourceId);
        return figureCard(figure, source, [
            button('Insert', 'Insert the image with a numbered caption and a citation', () => insertBlock(figureMarkdown(figure, source))),
        ]);
    }) : [el('li', 'none', 'No figures yet: capture them with 📷 on a source\'s page, or upload images on the Literature tab.')]));
}

// ---- exports ----

// your images are stored in this browser only: name them in Markdown, embed them in HTML
const forMarkdownExport = markdown => markdown.replace(/!\[([^\]]*)\]\(asset:[a-z0-9]+\)/gi, '[image: $1]');
const toDataUrl = blob => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
});

async function toHtml(markdown) {
    const box = document.createElement('div');
    box.innerHTML = DOMPurify.sanitize(marked.parse(markdown.replace(/\]\(asset:([a-z0-9]+)\)/gi, '](#asset-$1)')));
    for (const img of box.querySelectorAll('img[src^="#asset-"]')) {
        const blob = await Store.getAsset(img.getAttribute('src').slice('#asset-'.length)).catch(() => null);
        if (blob) img.src = await toDataUrl(blob);
        else img.remove();
    }
    markReferences(box);
    for (const p of box.querySelectorAll('.reference')) p.style.cssText = 'padding-left: 2em; text-indent: -2em;';
    return box.innerHTML;
}

function standaloneHtml(body) {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(project.title)} · Literature review</title>
<style>
body { font-family: "Times New Roman", Georgia, serif; font-size: 12pt; line-height: 1.6; max-width: 760px; margin: 40px auto; padding: 0 16px; color: #111; }
img { max-width: 100%; }
blockquote { margin-left: 0; padding-left: 1em; border-left: 3px solid #ccc; color: #444; }
</style></head><body>
${body}
</body></html>`;
}

function flash(btn, text) {
    const label = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = label; }, 1600);
}

// ---- events ----

// Markdown mode
editor.addEventListener('input', () => {
    changed();
    suggestCitations();
});
editor.addEventListener('click', suggestCitations);
editor.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) {
        e.preventDefault();
        ACTIONS[e.key === 'b' ? 'bold' : 'italic']();
    } else {
        writingKeys(e);
    }
});

// Visual mode
visual.addEventListener('input', onVisualInput);
visual.addEventListener('keydown', writingKeys);
visual.addEventListener('keyup', e => { if (!['Enter', 'Tab', 'Escape'].includes(e.key)) suggestCitations(); });
document.addEventListener('selectionchange', () => {
    const selection = getSelection();
    if (selection.rangeCount && visual.contains(selection.anchorNode)) savedRange = selection.getRangeAt(0).cloneRange();
});
visual.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.files || [])];
    if (!files.some(f => f.type.startsWith('image/'))) return;
    e.preventDefault();
    addVisualImages(files);
});
visual.addEventListener('drop', e => {
    if (![...e.dataTransfer.files].some(f => f.type.startsWith('image/'))) return;
    e.preventDefault();
    addVisualImages(e.dataTransfer.files);
});
// double-click a citation to add or change its page / time, or cite more sources in it
visual.addEventListener('dblclick', e => {
    const chip = e.target.closest('.cite');
    if (!chip) return;
    const raw = prompt('Edit this citation (e.g. [@key, p. 4], [@a; @b], or for a figure credit [credit: @key, p. 3] / [adapted: @key, p. 3]). Leave empty to remove it.', chip.dataset.cite);
    if (raw === null) return;
    if (raw.trim()) chip.dataset.cite = raw.trim();
    else chip.remove();
    syncFromVisual();
});

$('#mode_toggle').addEventListener('click', e => {
    const btn = e.target.closest('button[data-mode]');
    if (btn && !btn.disabled) setMode(btn.dataset.mode);
});

$('#cite_suggest').addEventListener('mousedown', e => e.preventDefault()); // keep the caret where it is
$('#cite_suggest').addEventListener('click', e => {
    const btn = e.target.closest('button[data-key]');
    if (btn) completeCitation(btn.dataset.key);
});

$('#toolbar').addEventListener('mousedown', e => { if (e.target.closest('button[data-action]')) e.preventDefault(); });
$('#toolbar').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (btn) ACTIONS[btn.dataset.action]();
});
$('#tabs').addEventListener('click', e => {
    const btn = e.target.closest('button[data-tab]');
    if (btn) showTab(btn.dataset.tab);
});
$('#source_search').oninput = renderSources;

$('#cite_style').onchange = e => {
    project.citeStyle = e.target.value;
    Store.saveProject({ id: project.id, citeStyle: e.target.value });
    if (mode === 'visual') refreshChips();
    renderPreview();
};

$('#download_md').onclick = () => {
    flushVisual();
    if (saveTimer) saveNow();
    downloadText(fileName() + '.md', forMarkdownExport(fullMarkdown().markdown), 'text/markdown');
};
$('#download_html').onclick = async () => {
    flushVisual();
    if (saveTimer) saveNow();
    downloadText(fileName() + '.html', standaloneHtml(await toHtml(fullMarkdown().markdown)), 'text/html');
};
$('#copy_rich').onclick = async e => {
    const btn = e.currentTarget;
    const { markdown } = fullMarkdown();
    try {
        const html = await toHtml(markdown);
        await navigator.clipboard.write([new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([forMarkdownExport(markdown)], { type: 'text/plain' }),
        })]);
        flash(btn, 'Copied ✓');
    } catch {
        flash(btn, (await copyText(forMarkdownExport(markdown))) ? 'Copied as text ✓' : 'Copy failed');
    }
};

// sources or notes may have changed in another tab
window.addEventListener('focus', () => {
    loadSources();
    renderSources();
    renderFigures();
    if (mode === 'visual') refreshChips();
    renderPreview();
});
window.addEventListener('beforeunload', () => {
    flushVisual();
    if (saveTimer) saveNow();
});

if (!project) location.replace('../index.html');
else init();

// ---- phones: the export menu, and a text box that grows instead of scrolling inside itself ----
// (with the keyboard open there's little room: one scroll for the page keeps the sticky toolbar in reach)

$('#export_toggle').onclick = e => {
    e.stopPropagation();
    const open = $('#export_menu').classList.toggle('open');
    $('#export_toggle').setAttribute('aria-expanded', open);
};
document.addEventListener('click', e => {
    if (!e.target.closest('#export_toggle')) {
        $('#export_menu').classList.remove('open');
        $('#export_toggle').setAttribute('aria-expanded', 'false');
    }
});

function fitEditor() {
    if (!smallScreen.matches) {
        editor.style.height = '';
        return;
    }
    editor.style.height = 'auto';
    editor.style.height = editor.scrollHeight + 2 + 'px';
}
editor.addEventListener('input', fitEditor);
smallScreen.addEventListener('change', fitEditor);
$('#mode_toggle').addEventListener('click', () => requestAnimationFrame(fitEditor));
fitEditor();

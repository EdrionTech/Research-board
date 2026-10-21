// Material page: one source with its reader, notes, summary and review.
// Opened as material.html?id=<sourceId>.
//
// The reader shows the material in up to three views (reader.js prepares them):
//   html - arXiv's HTML version; notes attach to a paragraph or figure (anchor + where)
//   pdf  - the PDF's pages as printed, with clickable lines; notes attach to page + line
//   text - pasted text as numbered lines; notes attach to a line
// In sentence, phrase and word mode a note also keeps the exact words: start/end offsets
// inside that paragraph, PDF page or text (see textrange.js) plus the quote.
// In image mode a note keeps an area (region: x, y, w, h as fractions) of an image in the
// HTML version (imageId) or of a PDF page.

const sourceId = new URLSearchParams(location.search).get('id');
const noteForm = $('#note_form');
const VIEWS = ['video', 'html', 'pdf', 'text'];
const MODE_KEY = 'research_board_attach_mode';
const SIDE_KEY = 'research_board_side_collapsed';
const FLOAT_KEY = 'research_board_floating_notes';
const MODE_HINTS = {
    block: 'Click a paragraph, figure or line to attach a note to it.',
    sentence: 'Click anywhere in a sentence to attach a note to it.',
    phrase: 'Select some words with your mouse to attach a note to them.',
    word: 'Click a word to attach a note to it.',
    image: 'Drag a box over part of an image or a PDF page. Click an image to attach the whole image.',
};

let source = Store.getItem(sourceId);
const project = source && Store.getProject(source.projectId); // the library's own settings for library-only materials
let notes = [];
let editingNoteId = null;
let attachMode = 'block';
let floatingNotes = true;                                   // open the note box next to what you click
let lastPointer = { x: innerWidth / 2, y: innerHeight / 3 }; // where the last click in the reader was

let available = [];      // views this material has, best first
let currentView = null;
let viewLoads = {};      // view -> promise, started the first time the view is shown
let statusByView = {};
let loadCount = 0;       // a newer setup stops older loads from updating the page
let pdfDoc = null;
let pdfObjectUrl = '';
let htmlUrl = '';
let player = null;        // video player (video.js) while the video view is loaded
let videoObjectUrl = '';
let timeTicker = null;
let videoDuration = 0;
let rangeStart = null;    // seconds, while a range is being marked
let stopAt = null;        // seconds, while a range is being played
let pageObserver = null;
let pageResizer = null;

const lineId = (page, line) => `L${page || 0}-${line}`;
const num = v => (v === '' || v == null || isNaN(v)) ? Infinity : Number(v);
const byPosition = (a, b) => num(a.time) - num(b.time) || num(a.page) - num(b.page) || num(a.line) - num(b.line)
    || num(a.start) - num(b.start) || a.createdAt - b.createdAt;
const pct = v => (v * 100).toFixed(3) + '%';
const mb = bytes => (bytes / 1048576).toFixed(1) + ' MB';
const hasRange = note => note.start !== undefined && note.start !== '' && note.end !== undefined && note.end !== '';
const hasRegion = note => !!note.region && typeof note.region === 'object';
// Video notes attach to segments: moments { start } and ranges { start, end } in seconds, any mix.
// (Older notes have a single `time`.) `time` stays the first start, for sorting.
function segmentsOf(note) {
    if (Array.isArray(note.segments) && note.segments.length) return note.segments;
    return note.time !== undefined && note.time !== null && note.time !== '' ? [{ start: Number(note.time) }] : [];
}
const hasTime = note => segmentsOf(note).length > 0;
const isRange = segment => segment.end !== undefined && segment.end !== null;
const formatSegment = segment => isRange(segment) ? `${formatTime(segment.start)}–${formatTime(segment.end)}` : formatTime(segment.start);
const timedTarget = segments => segments.length
    ? { segments, time: segments[0].start, where: segments.map(formatSegment).join(', ') }
    : {};
const clamp = v => Math.min(1, Math.max(0, v));
const snippet = text => {
    text = text.replace(/\s+/g, ' ').trim();
    return text.length > 220 ? text.slice(0, 220) + '…' : text;
};

function init() {
    // back to where you came from (the library, the project, another paper…)
    if (project.library) Nav.backLink($('#back_link'), 'library.html', 'Library');
    else Nav.backLink($('#back_link'), 'project_dashboard.html?id=' + encodeURIComponent(project.id) + '#literature', project.title);
    renderAddToProject();

    for (const [value, label] of Object.entries(Cite.STYLES)) $('#cite_style').append(new Option(label, value));
    $('#cite_style').value = project.citeStyle || 'apa'; // the project's default (set on the Literature tab)
    try { setAttachMode(localStorage.getItem(MODE_KEY) || 'block'); } catch { setAttachMode('block'); }
    try {
        floatingNotes = localStorage.getItem(FLOAT_KEY) !== '0';
        initialSide();
    } catch { }
    $('#float_toggle').checked = floatingNotes;

    render();
    Toc.setup(); // the table of contents (material_toc.js)
    setupReader();
    Places.setup(); // continue where you left off, bookmarks, the summary pad (material_places.js)
}

// the project's papers, with their citation keys: what notes can cite (type @: citepicker.js)
function projectSources() {
    const sources = Store.getItems(project.id).filter(i => i.type === 'source');
    assignCitekeys(sources);
    return sources;
}

// re-read the source after it was saved
function refresh() {
    source = Store.getItem(sourceId);
    render();
}

let citeSources = []; // the project's papers, for showing citations in notes as links

function render() {
    citeSources = projectSources();
    notes = Store.getItems(project.id)
        .filter(i => i.type === 'source_note' && i.sourceId === source.id)
        .sort(byPosition);
    renderInNotes();
    renderHead();
    renderNotes();
    markNoted();
    renderTimeline();
    for (const field of $$('.md_field')) {
        renderMarkdown($('.md', field), PaperLinks.withLinks(fieldValue(field.dataset.field), citeSources, project.citeStyle || 'apa'), 'Nothing written yet.');
        setMdEditing(field, false);
    }
}

// ---- header ----

function renderHead() {
    document.title = source.title + ' · Research Board';
    $('#bar_title').textContent = shortCitation(source) || 'Material';
    $('#source_meta').textContent = [KIND_LABELS[source.kind] || 'Source', source.published || 'n.d.', source.venue]
        .filter(Boolean).join(' · ');
    $('#source_title').textContent = source.title;
    $('#source_authors').textContent = authorsLine(source) || 'No authors added';

    const links = $('#source_links');
    links.replaceChildren();
    if (source.url) links.append(externalLink(source.url, 'Open link'));
    if (source.doi) links.append(externalLink('https://doi.org/' + source.doi, 'DOI: ' + source.doi));
    if (source.pdfUrl) links.append(externalLink(source.pdfUrl, 'PDF'));
    links.hidden = !links.children.length;

    // added from another paper's references: which one(s)
    const citers = (source.citedIn || []).map(id => Store.getItem(id)).filter(s => s?.type === 'source');
    $('#cited_in').hidden = !citers.length;
    $('#cited_in').replaceChildren(...(citers.length ? ['From the references of ', ...citers.flatMap((s, i) => {
        const a = el('a', '', shortCitation(s) || s.title);
        a.href = 'material.html?id=' + encodeURIComponent(s.id);
        a.title = s.title;
        return i ? [', ', a] : [a];
    })] : []));
    if (source.unverified) $('#cited_in').append(el('span', 'badge check', 'Details from the reference: check them'));

    $('#keywords').replaceChildren(...(source.keywords || []).map(k => el('li', '', k)));
    renderTags();
    $('#status_select').value = source.status || 'to_read';
    $('#copy_cite').title = Cite.format(source, $('#cite_style').value);

    $('#abstract').hidden = !source.abstract;
    renderMarkdown($('#abstract .md'), source.abstract);
}

// your tags, each removable, plus suggestions from the other sources in the project
function renderTags() {
    $('#tags').replaceChildren(...tagsOf(source).map(tag => {
        const chip = el('li', 'tag', tag);
        const remove = el('button', 'tag_remove', '×');
        remove.type = 'button';
        remove.dataset.tag = tag;
        remove.title = `Remove tag "${tag}"`;
        chip.append(remove);
        return chip;
    }));
    const used = new Set(Store.getItems(project.id).filter(i => i.type === 'source').flatMap(tagsOf));
    $('#tag_suggestions').replaceChildren(...[...used].filter(tag => !hasTag(source, tag)).sort().map(tag => new Option(tag)));
}

function addTag(text) {
    const tag = text.replace(/,/g, ' ').trim();
    if (!tag || hasTag(source, tag)) return;
    Store.saveItem({ id: source.id, tags: [...tagsOf(source), tag] });
    refresh();
}

// older sources kept their summary in `body`
function fieldValue(field) {
    return field === 'summary' ? (source.summary ?? source.body ?? '') : (source[field] ?? '');
}

// ---- reader: choosing and switching views ----

function setupReader() {
    loadCount++;
    viewLoads = {};
    Toc.reset();
    statusByView = {};
    pageObserver?.disconnect();
    pageResizer?.disconnect();
    pdfDoc?.destroy();
    pdfDoc = null;
    if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
    pdfObjectUrl = '';
    htmlUrl = '';
    player?.destroy();
    player = null;
    clearInterval(timeTicker);
    videoDuration = 0;
    rangeStart = stopAt = null;
    if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
    videoObjectUrl = '';
    $('#video_frame').replaceChildren();
    $('#reader_html').srcdoc = '';
    $('#reader_pdf').replaceChildren();
    $('#reader_text').replaceChildren();

    available = [];
    if (videoInfo(source)) available.push('video');
    if (arxivIdOf(source)) available.push('html');
    if (pdfFile(source) || source.pdfUrl) available.push('pdf');
    if (source.text) available.push('text');
    $('#abstract').open = !available.length;
    updateToggle();

    hideGetPaper();
    if (!available.length) {
        currentView = null;
        for (const view of VIEWS) $('#reader_' + view).hidden = true;
        updateReaderBar();
        findReadableCopy(); // a paper from IEEE, ACM…: an arXiv version or an open-access PDF, if there is one
        return;
    }
    showView(available.includes(currentView) ? currentView : available[0]);
}

function updateToggle() {
    for (const btn of $$('.view_toggle button')) btn.hidden = !available.includes(btn.dataset.view);
    $('.view_toggle').hidden = available.length < 2;
    // only your own uploads and pasted text can be removed; the web copy follows the PDF link
    $('#remove_material').hidden = !(source.text || (source.file && !source.file.fromUrl));
}

// Shows a view, loading it the first time. Resolves once the view is loaded.
function showView(view) {
    currentView = view;
    for (const btn of $$('.view_toggle button')) btn.setAttribute('aria-pressed', btn.dataset.view === view);
    for (const v of VIEWS) $('#reader_' + v).hidden = v !== view;
    $('.attach_row').hidden = view === 'video'; // video notes attach to a moment instead
    viewLoads[view] ??= loadView(view, loadCount);
    Toc.show(view);
    requestAnimationFrame(paintRegions); // image areas need the view laid out
    renderStatus();
    updateReaderBar();
    updateZoomControl();
    return viewLoads[view];
}

async function loadView(view, load) {
    try {
        if (view === 'video') await loadVideo(load);
        else if (view === 'html') await loadHtml(load);
        else if (view === 'pdf') await loadPdf(load);
        else loadText();
    } catch (err) {
        if (load !== loadCount) return;
        if (view === 'html') {
            // no HTML version for this paper: fall back to the next view
            available = available.filter(v => v !== 'html');
            updateToggle();
            if (currentView !== 'html') return;
            if (available.length) return showView(available[0]);
            return setStatus('html', 'arXiv has no HTML version of this paper. Upload the PDF to read it here.');
        }
        setStatus(view, err.message);
    }
}

function updateReaderBar() {
    const video = videoInfo(source);
    const labels = {
        video: { youtube: 'YouTube video', vimeo: 'Vimeo video', file: 'Uploaded video · ' + source.file?.name, url: 'Video file' }[video?.provider],
        html: 'arXiv HTML version',
        pdf: source.file?.fromUrl ? 'Saved copy of the web PDF'
            : pdfFile(source) ? 'Uploaded PDF · ' + source.file.name : 'PDF from the web',
        text: currentView === 'text' && video ? 'Pasted text (transcript)' : 'Pasted text',
    };
    $('#reader_source').textContent = labels[currentView] || '';
    const open = currentView === 'html' ? htmlUrl
        : currentView === 'pdf' ? (pdfObjectUrl || source.pdfUrl)
        : currentView === 'video' ? (video?.provider === 'file' ? videoObjectUrl : source.url) : '';
    $('#open_original').hidden = !open;
    $('#open_original').href = open || '#';
}

// Each view keeps its own status; the progress bar shows when `total` is given (0 = busy).
function setStatus(view, text, loaded, total) {
    statusByView[view] = { text, loaded, total };
    if (view === currentView) renderStatus();
}

function renderStatus() {
    const { text = '', loaded, total } = statusByView[currentView] || {};
    $('#reader_status').textContent = text;
    $('#reader_status').hidden = !text;
    // while loading (a progress bar is shown) it floats in a corner: when it goes away, nothing jumps
    $('#reader_state').classList.toggle('busy', total !== undefined && !!text);
    const bar = $('#reader_progress');
    bar.hidden = total === undefined;
    if (total) {
        bar.max = total;
        bar.value = loaded;
    } else {
        bar.removeAttribute('value');
    }
}

// ---- reader: arXiv HTML ----

async function loadHtml(load) {
    setStatus('html', 'Loading the HTML version…', 0, 0);
    const paper = await Reader.arxivHtml(arxivIdOf(source));
    if (load !== loadCount) return;
    htmlUrl = paper.url;
    updateReaderBar();

    const frame = $('#reader_html');
    await new Promise(resolve => {
        frame.onload = resolve;
        frame.srcdoc = paper.srcdoc;
    });
    const doc = frame.contentDocument;
    doc.body.dataset.mode = attachMode;
    for (const block of doc.querySelectorAll('.ltx_para[id], figure[id], .ltx_abstract[id]')) {
        block.dataset.anchor = block.id;
    }
    doc.addEventListener('click', onPaperClick);
    doc.addEventListener('mouseup', () => handleSelection(doc));
    watchSelection(doc);
    doc.addEventListener('pointerdown', e => startArea(e, doc));
    doc.addEventListener('pointerup', e => {
        const r = frame.getBoundingClientRect();
        lastPointer = { x: r.left + e.clientX, y: r.top + e.clientY };
    });
    doc.addEventListener('dragstart', e => e.preventDefault());
    // image areas are drawn in page pixels, so redraw when images load or the frame resizes
    for (const img of doc.querySelectorAll('img.ltx_graphics')) img.addEventListener('load', paintRegions);
    doc.defaultView.addEventListener('resize', paintRegions);
    doc.documentElement.style.fontSize = zoomOf.html === 1 ? '' : zoomOf.html * 100 + '%';
    NoteColors.applyCss(doc, project); // the project's highlight colours inside the paper
    ReaderZoom.gestures(doc, {
        onPreview: (scale, x, y) => previewZoom('html', scale, x, y),
        onCommit: (scale, x, y) => setZoom('html', zoomOf.html * scale, x, y),
    });
    setupHtmlImageButton(doc);
    ReferencesPanel.fromHtml(doc);
    Toc.fromHtml(doc);
    Toc.watchFrame(doc);
    markNoted();
    highlightFormTarget();
    Places.markBookmarks();
    // B bookmarks here too (keys pressed inside the paper stay in its frame)
    doc.addEventListener('keydown', e => {
        if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey && !e.altKey) document.dispatchEvent(new KeyboardEvent('keydown', { key: e.key }));
    });
    setStatus('html', '');
}

const paperDoc = () => $('#reader_html').contentDocument;

function onPaperClick(e) {
    const link = e.target.closest('a[href]');
    if (link) {
        // in-paper links (citations, sections) scroll; others open in a new tab
        const href = link.getAttribute('href');
        if (href.startsWith('#')) {
            e.preventDefault();
            link.ownerDocument.getElementById(decodeURIComponent(href.slice(1)))
                ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        return;
    }
    handleClick(e, e.target.ownerDocument);
}

// "§3.1 ¶2", "Figure 2", "Table 1", "Abstract"
function anchorLabel(block) {
    if (block.matches('.ltx_abstract')) return 'Abstract';
    // (arXiv writes "Table&nbsp;I": plain spaces, so labels read and search normally)
    if (block.matches('figure')) {
        const tag = block.querySelector('figcaption .ltx_tag')?.textContent || 'Figure';
        return tag.replace(/\s+/g, ' ').replace(/[:.]\s*$/, '').trim();
    }
    const section = block.closest('section')?.querySelector(':scope > .ltx_title .ltx_tag')?.textContent.replace(/\s+/g, ' ').trim();
    const paragraph = block.id.match(/p(\d+)$/)?.[1];
    return [section ? '§' + section.replace(/\.$/, '') : '', paragraph ? '¶' + paragraph : '']
        .filter(Boolean).join(' ') || block.id;
}

// ---- reader: video ----

async function loadVideo(load) {
    setStatus('video', 'Loading video…', 0, 0);
    const info = { ...videoInfo(source) };
    if (info.provider === 'file') {
        const blob = await Store.getAsset(source.file.assetId);
        if (!blob) throw new Error('The saved video is missing. Upload it again.');
        info.src = videoObjectUrl = URL.createObjectURL(blob);
    }
    if (load !== loadCount) return;
    const mounted = await VideoPlayer.mount($('#video_frame'), info);
    if (load !== loadCount) return mounted.destroy();
    player = mounted;
    updateReaderBar();
    // YouTube refuses to play inside pages opened straight from a file (its "Error 153")
    setStatus('video', info.provider === 'youtube' && location.protocol === 'file:'
        ? 'YouTube only plays inside the app when it is opened from a web address, not as a file. ' +
          'In VS Code, right-click index.html and choose "Open with Live Server". Until then, use Open in new tab.'
        : '');

    // keep the buttons' times current, stop at the end of a range being played;
    // the timeline needs the length, known once the video loads
    clearInterval(timeTicker);
    timeTicker = setInterval(async () => {
        if (!player || currentView !== 'video') return;
        const time = await player.getTime().catch(() => 0);
        updateVideoButtons(time);
        if (stopAt !== null && time >= stopAt) {
            player.pause();
            stopAt = null;
        }
        if (!videoDuration) renderTimeline();
    }, 400);
    updateVideoButtons(0);
    renderTimeline();
}

// The two video buttons: a moment, and a range (press to start, press again to end).
// While a timed note is being written they add to it, so one note can hold several moments and ranges.
function updateVideoButtons(time) {
    const adding = hasTime(formTarget());
    $('#note_at_time').textContent = adding ? `+ Add moment ${formatTime(time)}` : `✎ Note at ${formatTime(time)}`;
    $('#range_btn').textContent = rangeStart === null
        ? `⟦ Start range at ${formatTime(time)}`
        : `End range ${formatTime(rangeStart)}–${formatTime(Math.max(time, rangeStart))} ⟧`;
    $('#range_btn').classList.toggle('recording', rangeStart !== null);
    $('#video_hint').textContent = rangeStart !== null ? 'Range started: press again where it ends.'
        : adding ? 'Adding to this note: more moments or ranges. Detach in the note box to start a new note.'
        : 'Note a moment, or a range from start to end. Paste a transcript with Paste text to note its sentences too.';
}

// adds a moment or range to the note being written (or starts one)
function addSegment(segment) {
    player?.pause();
    const segments = [...segmentsOf(formTarget()), segment].sort((a, b) => a.start - b.start);
    attachTo(timedTarget(segments));
    openComposer($('#video_frame').getBoundingClientRect()); // over the paused video, not the buttons
}

// plays from a segment's start; a range stops at its end
function playSegment(segment) {
    if (!player) return;
    player.seek(segment.start);
    if (isRange(segment)) {
        stopAt = segment.end;
        player.play();
    } else {
        stopAt = null;
    }
}

// your timed notes along the video: dots for moments, bars for ranges
async function renderTimeline() {
    const bar = $('#timeline');
    const timed = notes.filter(hasTime);
    if (!player || !timed.length) {
        bar.hidden = true;
        return;
    }
    videoDuration = await player.getDuration().catch(() => 0);
    if (!videoDuration) return;
    bar.hidden = false;
    bar.replaceChildren(...timed.flatMap(note => segmentsOf(note).map(segment => {
        const mark = el('button', isRange(segment) ? 'span' : 'marker');
        mark.type = 'button';
        mark.dataset.start = segment.start;
        if (isRange(segment)) {
            mark.dataset.end = segment.end;
            mark.style.width = pct(Math.max(0.004, (segment.end - segment.start) / videoDuration));
        }
        mark.style.left = pct(Math.min(1, segment.start / videoDuration));
        mark.title = `${formatSegment(segment)} · ${(note.body || '').slice(0, 80)}`;
        return mark;
    })));
}

const segmentFrom = data => ({ start: Number(data.start), ...(data.end !== undefined && data.end !== '' ? { end: Number(data.end) } : {}) });

// ---- reader: PDF pages ----

async function loadPdf(load) {
    const current = () => load === loadCount;
    let blob;
    if (pdfFile(source)) {
        setStatus('pdf', 'Opening PDF…', 0, 0);
        blob = await Store.getAsset(source.file.assetId);
        if (!blob) throw new Error('The saved PDF is missing. Upload it again.');
    } else {
        try {
            blob = await downloadAndKeep(current);
        } catch {
            if (!current()) return;
            if (await tryNextCopy()) return; // an arXiv version or another open copy: the reader starts again with it
            showGetPaper('blocked');
            throw new Error("Couldn't download this PDF here: the publisher doesn't allow it, it needs your library login, or you're offline.");
        }
    }
    if (!current()) return;
    pdfObjectUrl = URL.createObjectURL(blob);
    updateReaderBar();

    setStatus('pdf', 'Reading PDF…', 0, 0);
    try {
        pdfDoc = await Reader.openPdf(await blob.arrayBuffer());
    } catch (err) {
        throw new Error(`Couldn't read this PDF (${err.message}).`);
    }
    // pages are drawn only when they scroll near the screen; the text layer follows the page size
    pageObserver = new IntersectionObserver(drawVisiblePages, { rootMargin: '800px 0px' });
    pageResizer = new ResizeObserver(entries => {
        for (const { target, contentRect } of entries) {
            if (!contentRect.width) continue;
            target.style.setProperty('--scale-factor', contentRect.width / target.dataset.width);
            // much wider than when drawn (e.g. notes side hidden): draw it again so it stays sharp
            if (target.dataset.drawn && contentRect.width > Number(target.dataset.drawnWidth) * 1.15) {
                delete target.dataset.drawn;
                pageObserver.unobserve(target);
                pageObserver.observe(target);
            }
        }
    });
    const pageTexts = [];
    const pageLines = [];
    for (let n = 1; n <= pdfDoc.numPages; n++) {
        if (!current()) return;
        const page = await Reader.pageLines(await pdfDoc.getPage(n));
        pageTexts.push(page.lines.map(line => line.text));
        pageLines.push(page.lines);
        appendPdfPage(n, page);
        setStatus('pdf', `Reading page ${Math.min(n + 1, pdfDoc.numPages)} of ${pdfDoc.numPages}…`, n, pdfDoc.numPages);
    }
    setStatus('pdf', '');
    Places.markBookmarks();
    Toc.fromPdf(pdfDoc, pageLines);
    ReferencesPanel.fromPdf(pageTexts); // its References section, if the HTML version didn't give the list
}

// ---- papers from publishers (IEEE, ACM, Springer…): find a copy the app can read, or help bring one ----
// Publishers rarely let another site download their PDFs, and many are behind a paywall. So: an arXiv version
// (read like any arXiv paper; the citation stays the published one) or an open-access PDF (sources.js:
// findCopies), checked once per source. Failing that, "Get the paper": where to get it, and a drop zone.

let lookingForCopy = false;

async function copiesOf(force) {
    if (source.copies?.checked && !force) return source.copies;
    let copies;
    try {
        copies = await findCopies(source);
    } catch {
        copies = { arxiv: '', pdfs: [], pages: [] };
    }
    return { ...copies, failed: source.copies?.failed || [], checked: Date.now() };
}

// the copy to read: arXiv first, then open PDFs that haven't failed before
function pickCopy(copies) {
    const update = { copies };
    if (copies.arxiv && !arxivIdOf(source)) update.arxiv = copies.arxiv;
    if (!pdfFile(source)) {
        const pdf = [copies.arxiv && `https://arxiv.org/pdf/${copies.arxiv}`, ...copies.pdfs.map(p => p.url)]
            .find(url => url && !copies.failed.includes(url) && url !== source.pdfUrl);
        if (pdf) update.pdfUrl = pdf;
    }
    return update;
}

async function findReadableCopy(force = false) {
    if (lookingForCopy) return;
    if (!source.doi && !source.url && !source.title) return showGetPaper('empty');
    if (source.copies?.checked && !force) return showGetPaper('closed');
    lookingForCopy = true;
    hideGetPaper();
    setStatus(null, 'Looking for a copy to read here (an arXiv version, open-access repositories)…', 0, 0);
    const update = pickCopy(await copiesOf(force));
    lookingForCopy = false;
    setStatus(null, '');
    Store.saveItem({ id: source.id, ...update });
    refresh();
    if (update.arxiv || update.pdfUrl) setupReader();
    else showGetPaper('closed');
}

// the PDF link failed: remember it, and move on to the next copy if there is one
async function tryNextCopy() {
    const copies = await copiesOf(false);
    const failed = [...new Set([...copies.failed, source.pdfUrl])];
    // keep the publisher's PDF link among the places to open by hand
    const pages = copies.pages.some(p => p.url === source.pdfUrl) ? copies.pages : [...copies.pages, { url: source.pdfUrl, label: 'The PDF link (opens in a new tab)' }];
    const update = pickCopy({ ...copies, failed, pages });
    Store.saveItem({ id: source.id, ...update });
    refresh();
    if (!update.arxiv && !update.pdfUrl) return false;
    if (update.arxiv) currentView = 'html';
    setTimeout(setupReader); // after this load has unwound
    return true;
}

function showGetPaper(reason) {
    const copies = source.copies || { pages: [], pdfs: [] };
    $('#get_paper').hidden = false;
    $('#get_paper_why').textContent = {
        empty: 'No material attached yet. Upload the PDF or paste the text to read and annotate it here.',
        closed: 'No free copy found: no arXiv version or open-access PDF. Get it where you have access, then bring the PDF here.',
        blocked: "This PDF couldn't be downloaded here: the publisher doesn't allow other sites to, or it needs your library login.",
    }[reason];
    if (!currentView) setStatus(null, '');
    const links = [...copies.pages, ...copies.pdfs.map(p => ({ ...p, label: p.label + ' (PDF)' }))];
    if (source.url && !links.some(l => l.url === source.url)) links.unshift({ url: source.url, label: 'Its link' });
    if (source.title) links.push({ url: 'https://scholar.google.com/scholar?q=' + encodeURIComponent(source.title), label: 'Google Scholar (finds author copies)' });
    $('#get_paper_open').hidden = !links.length;
    $('#get_paper_links').replaceChildren(...links.flatMap((l, i) => [...(i ? [' · '] : []), externalLink(l.url, l.label + ' ↗')]));
    $('#find_copy').hidden = reason === 'empty';
}

function hideGetPaper() {
    $('#get_paper').hidden = true;
}

// Downloads the web PDF once, with progress, and keeps a copy so it opens instantly next time.
async function downloadAndKeep(current) {
    setStatus('pdf', 'Downloading PDF…', 0, 0);
    const blob = await Reader.download(source.pdfUrl, (loaded, total) => {
        if (current()) setStatus('pdf', `Downloading PDF… ${mb(loaded)}${total ? ' of ' + mb(total) : ''}`, loaded, total);
    });
    try {
        const assetId = await Store.putAsset(blob);
        Store.saveItem({ id: source.id, file: { assetId, name: 'Web copy.pdf', size: blob.size, fromUrl: source.pdfUrl } });
        source = Store.getItem(sourceId);
    } catch { /* couldn't store it; it downloads again next time */ }
    return blob;
}

// One page: the drawn page underneath, a selectable text layer, and a clickable box per line.
function appendPdfPage(n, { width, height, lines, content, viewport }) {
    const pageEl = el('section', 'pdf_page');
    pageEl.dataset.page = n;
    pageEl.dataset.width = width;
    pageEl.style.aspectRatio = `${width} / ${height}`;
    const textLayer = el('div', 'textLayer');
    pageEl.append(el('canvas'), textLayer);
    lines.forEach((line, i) => {
        const box = el('div', 'line');
        box.id = lineId(n, i + 1);
        box.dataset.page = n;
        box.dataset.line = i + 1;
        box.dataset.text = line.text;
        box.title = `p. ${n} · l. ${i + 1}`;
        Object.assign(box.style, { left: pct(line.box.x), top: pct(line.box.y), width: pct(line.box.w), height: pct(line.box.h) });
        box.append(el('span', 'num', i + 1));
        pageEl.append(box);
    });
    $('#reader_pdf').append(pageEl);
    pageObserver.observe(pageEl);
    pageResizer.observe(pageEl);
    Reader.renderTextLayer(content, viewport, textLayer).then(paintHighlights).catch(() => { });
    markNoted();
    highlightFormTarget();
}

function drawVisiblePages(entries) {
    for (const { target: pageEl, isIntersecting } of entries) {
        // zoomed in, pages are big pictures: let go of the ones far off screen (drawn again when back)
        if (!isIntersecting && pageEl.dataset.drawn && zoomOf.pdf > 1.5) {
            const canvas = $('canvas', pageEl);
            canvas.width = canvas.height = 0;
            delete pageEl.dataset.drawn;
            continue;
        }
        if (!isIntersecting || pageEl.dataset.drawn) continue;
        pageEl.dataset.drawn = '1';
        pageEl.dataset.drawnWidth = pageEl.clientWidth;
        pdfDoc.getPage(Number(pageEl.dataset.page))
            .then(async page => {
                await Reader.renderPage(page, $('canvas', pageEl), pageEl.clientWidth);
                // find the pictures once, for the "Note this image" button and image-mode clicks
                if (!pageImageBoxes.has(pageEl)) pageImageBoxes.set(pageEl, await Reader.pageImages(page));
            })
            .catch(() => delete pageEl.dataset.drawn);
    }
}

// the PDF line under a range of text, for the "p. 3 · l. 12" label
function lineAtRange(pageEl, range) {
    const rect = range?.getClientRects()[0];
    if (!rect) return '';
    const y = rect.top + rect.height / 2;
    const x = rect.left + 1;
    const line = $$('.line', pageEl).find(l => {
        const r = l.getBoundingClientRect();
        return y >= r.top && y <= r.bottom && x >= r.left - 3 && x <= r.right + 3;
    });
    return line?.dataset.line || '';
}

// ---- reader: pasted text ----

function loadText() {
    const list = el('ol', 'lines');
    Reader.textLines(source.text).forEach((line, i) => {
        const li = el('li', 'line');
        li.id = lineId('', i + 1);
        li.dataset.page = '';
        li.dataset.line = i + 1;
        li.dataset.text = line.text;
        li.append(el('span', 'num', i + 1), el('span', 'txt', line.text));
        list.append(li);
    });
    $('#reader_text').replaceChildren(list);
    markNoted();
    highlightFormTarget();
    Places.markBookmarks();
    Toc.fromText(Reader.textLines(source.text));
}

// ---- reader zoom (zoom.js): − / + buttons, pinch, Ctrl + wheel ----
// PDF pages get wider than the reader (scroll sideways); the HTML paper and pasted text get bigger text that
// re-flows. What was under your fingers (or the middle of the view) stays in place.

const zoomOf = { pdf: ReaderZoom.saved('pdf'), html: ReaderZoom.saved('html'), text: ReaderZoom.saved('text') };
const zoomable = view => view === 'pdf' || view === 'html' || view === 'text';

// what a gesture scales while the fingers move
function zoomTarget(view) {
    return view === 'html' ? paperDoc()?.body : $('#reader_' + view);
}

function previewZoom(view, scale, x, y) {
    const el = zoomTarget(view);
    if (!el) return;
    const s = ReaderZoom.clamp(view, zoomOf[view] * scale) / zoomOf[view];
    if (scale === 1 || s === 1) {
        el.style.transform = '';
        return;
    }
    const r = el.getBoundingClientRect();
    el.style.transformOrigin = `${x - r.left}px ${y - r.top}px`;
    el.style.transform = `scale(${s})`;
}

// x, y: the point to keep in place (screen coordinates; inside the frame for the HTML paper)
function setZoom(view, z, x, y) {
    z = ReaderZoom.clamp(view, z);
    const el = zoomTarget(view);
    if (el) el.style.transform = '';
    zoomOf[view] = z;
    ReaderZoom.remember(view, z);
    if (view === 'pdf') zoomPdf(z, x, y);
    else if (view === 'html') zoomFlow(paperDoc(), z, x, y);
    else zoomFlow(document, z, x, y);
    updateZoomControl();
}

function zoomPdf(z, x, y) {
    const box = $('#reader_pdf');
    const r = box.getBoundingClientRect();
    x ??= r.left + box.clientWidth / 2;
    y ??= Math.min(Math.max(innerHeight / 2, r.top), r.bottom);
    const fx = (x - r.left + box.scrollLeft) / (box.scrollWidth || 1);
    const fy = (y - r.top) / (r.height || 1);
    box.style.setProperty('--zoom', z);
    box.classList.toggle('zoomed', z > 1);
    const after = box.getBoundingClientRect();
    scrollBy(0, after.top + fy * after.height - y);
    box.scrollLeft = fx * box.scrollWidth - (x - after.left);
}

// Bigger text that re-flows: the HTML paper (in its frame) or the pasted text
function zoomFlow(doc, z, x, y) {
    if (!doc) return;
    const win = doc.defaultView;
    const anchor = ReaderZoom.anchorAt(doc, x ?? win.innerWidth / 2, y ?? win.innerHeight / 2);
    if (doc === document) $('#reader_text').style.setProperty('--zoom', z);
    else doc.documentElement.style.fontSize = z === 1 ? '' : z * 100 + '%';
    ReaderZoom.restoreAnchor(anchor, win);
    paintRegions();
}

function updateZoomControl() {
    const ctl = $('#zoom_ctl');
    ctl.hidden = !zoomable(currentView);
    if (ctl.hidden) return;
    const z = zoomOf[currentView];
    const [min, max] = ReaderZoom.LIMITS[currentView];
    $('#zoom_level').textContent = Math.round(z * 100) + '%';
    $('#zoom_level').title = z === 1 ? 'Fits the width' : 'Back to fit the width';
    $('[data-zoom="out"]', ctl).disabled = z <= min;
    $('[data-zoom="in"]', ctl).disabled = z >= max;
}

$('#zoom_ctl').addEventListener('click', e => {
    const act = e.target.closest('button[data-zoom]')?.dataset.zoom;
    if (!act || !zoomable(currentView)) return;
    const z = zoomOf[currentView];
    setZoom(currentView, act === 'fit' ? 1 : ReaderZoom.step(currentView, z, act === 'in' ? 1 : -1));
});
for (const view of ['pdf', 'text']) {
    ReaderZoom.gestures($('#reader_' + view), {
        onPreview: (scale, x, y) => previewZoom(view, scale, x, y),
        onCommit: (scale, x, y) => setZoom(view, zoomOf[view] * scale, x, y),
    });
}
$('#reader_pdf').style.setProperty('--zoom', zoomOf.pdf);
$('#reader_pdf').classList.toggle('zoomed', zoomOf.pdf > 1);
$('#reader_text').style.setProperty('--zoom', zoomOf.text);

// ---- attach modes: picking what a note is about ----

function setAttachMode(mode) {
    attachMode = MODE_HINTS[mode] ? mode : 'block';
    try { localStorage.setItem(MODE_KEY, attachMode); } catch { }
    for (const btn of $$('#attach_mode button')) btn.setAttribute('aria-pressed', btn.dataset.mode === attachMode);
    $('#attach_hint').textContent = MODE_HINTS[attachMode];
    document.body.dataset.mode = attachMode;
    const doc = paperDoc();
    if (doc?.body) doc.body.dataset.mode = attachMode;
}

// the element whose text a sentence/phrase/word is counted in
function rangeContainerOf(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return element?.closest('[data-anchor], .textLayer, #reader_text');
}

// Paragraph, sentence and word modes act on a click.
function handleClick(e, doc) {
    if (attachMode === 'phrase' || attachMode === 'image' || !doc.getSelection().isCollapsed) return;
    if (attachMode === 'block') {
        const block = e.target.closest('[data-anchor]');
        if (block) return selectBlock(block);
        const line = e.target.closest('.line');
        if (line) selectLine(line);
        return;
    }
    const caret = TextRange.caretAt(doc, e.clientX, e.clientY);
    const container = caret && rangeContainerOf(caret.node);
    if (!container) return;
    const m = TextRange.map(container);
    const span = TextRange.segmentAt(m.text, TextRange.offsetOf(m, caret.node, caret.offset), attachMode);
    if (span) selectRange(container, m, span);
}

// Phrase mode acts on what you select with the mouse.
function handleSelection(doc) {
    if (attachMode !== 'phrase') return;
    const selection = doc.getSelection();
    if (selection.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const container = rangeContainerOf(range.startContainer);
    if (!container) return;
    const m = TextRange.map(container);
    const start = TextRange.offsetOf(m, range.startContainer, range.startOffset);
    // a selection running past the paragraph/page stops at its end
    const end = container.contains(range.endContainer)
        ? TextRange.offsetOf(m, range.endContainer, range.endOffset) : m.text.length;
    const span = TextRange.trim(m.text, start, end);
    if (!span) return;
    selection.removeAllRanges();
    selectRange(container, m, span);
}

function selectRange(container, m, { start, end }) {
    const target = { start, end, quote: m.text.slice(start, end).slice(0, 2000) };
    if (container.matches('[data-anchor]')) {
        Object.assign(target, { anchor: container.dataset.anchor, where: anchorLabel(container) });
    } else if (container.matches('.textLayer')) {
        const pageEl = container.closest('.pdf_page');
        Object.assign(target, { page: pageEl.dataset.page, line: lineAtRange(pageEl, TextRange.rangeOf(m, start, end)) });
    } else {
        const startNode = TextRange.rangeOf(m, start, end)?.startContainer;
        target.line = startNode?.parentElement?.closest('.line')?.dataset.line || '';
    }
    attachTo(target);
    openComposer();
}

// ---- image mode: an area of an image (HTML) or of a PDF page ----

// Image mode: press and drag a box.
// - PDF: anywhere on a page (figures are part of the drawn page).
// - arXiv HTML: anywhere in the paper with a mouse; with a finger, on a figure (elsewhere the finger
//   still scrolls). When you let go, the note goes to the picture the box covers most.
function startArea(e, doc) {
    if (attachMode !== 'image' || e.button !== 0 || e.target.closest('.img_note_btn')) return;
    const page = e.target.closest('.pdf_page');
    const inPaper = doc !== document;
    const onFigure = e.target.closest('img.ltx_graphics, figure');
    if (!page && !(inPaper && (e.pointerType !== 'touch' || onFigure))) return;
    e.preventDefault();

    const start = { x: e.clientX, y: e.clientY };
    const boxTo = to => new DOMRect(Math.min(start.x, to.x), Math.min(start.y, to.y), Math.abs(to.x - start.x), Math.abs(to.y - start.y));
    const box = doc.createElement('div');
    box.className = 'region drawing';
    // the rubber band: in % inside a PDF page, in page pixels in the paper
    const draw = rect => {
        if (page) return placeRegion(box, page, regionIn(page.getBoundingClientRect(), rect));
        const { scrollX, scrollY } = doc.defaultView;
        if (box.parentNode !== doc.body) doc.body.append(box);
        Object.assign(box.style, {
            left: `${rect.left + scrollX}px`, top: `${rect.top + scrollY}px`,
            width: `${rect.width}px`, height: `${rect.height}px`,
        });
    };

    // The paper is in an iframe: if the mouse is let go outside it, the main page gets the
    // events instead, so listen on both (main page coordinates shifted by the frame position).
    const frame = inPaper ? $('#reader_html').getBoundingClientRect() : null;
    const listeners = [[doc, 0, 0], ...(frame ? [[document, frame.left, frame.top]] : [])];
    let done = false;
    const stops = listeners.map(([target, dx, dy]) => {
        const point = ev => ({ x: ev.clientX - dx, y: ev.clientY - dy });
        const move = ev => draw(boxTo(point(ev)));
        const up = ev => finish(point(ev));
        const cancel = () => finish(null);
        // a second finger: it's a pinch to zoom (this listener also sees the first finger's own press: skip it)
        const second = ev => { if (ev.pointerId !== e.pointerId) finish(null); };
        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', up);
        target.addEventListener('pointercancel', cancel);
        target.addEventListener('pointerdown', second);
        return () => {
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', up);
            target.removeEventListener('pointercancel', cancel);
            target.removeEventListener('pointerdown', second);
        };
    });
    const finish = to => {
        if (done) return;
        done = true;
        stops.forEach(stop => stop());
        box.remove();
        if (to) finishBox(doc, page, boxTo(to), start);
    };
}

// What a finished box (screen coordinates) attaches to.
function finishBox(doc, page, rect, start) {
    if (page) {
        const r = page.getBoundingClientRect();
        return finishArea(page, regionIn(r, rect), { x: (start.x - r.left) / r.width, y: (start.y - r.top) / r.height });
    }
    // the arXiv paper: the picture you clicked, or the one the box covers most
    const click = rect.width < 6 && rect.height < 6;
    let best = null;
    let bestArea = 0;
    for (const img of doc.querySelectorAll('img.ltx_graphics')) {
        const r = img.getBoundingClientRect();
        const area = click
            ? (inside(r, start.x, start.y) ? 1 : 0)
            : Math.max(0, Math.min(r.right, rect.right) - Math.max(r.left, rect.left))
              * Math.max(0, Math.min(r.bottom, rect.bottom) - Math.max(r.top, rect.top));
        if (area > bestArea) {
            best = img;
            bestArea = area;
        }
    }
    if (!best) {
        if (!click) toast('Drag over a picture in the paper. For text, tables or equations, use 📷 Capture.');
        return;
    }
    finishArea(best, click ? { x: 0, y: 0, w: 1, h: 1 } : regionIn(best.getBoundingClientRect(), rect));
}

// a short message at the bottom of the screen, with a button if there's something to do about it
function toast(text, { action, onAction } = {}) {
    let note = $('#toast');
    if (!note) {
        note = el('div', 'toast');
        note.id = 'toast';
        note.setAttribute('role', 'status');
        document.body.append(note);
    }
    note.replaceChildren(text);
    if (action) {
        const btn = el('button', 'toast_action', action);
        btn.type = 'button';
        btn.onclick = () => {
            note.hidden = true;
            onAction();
        };
        note.append(' ', btn);
    }
    note.hidden = false;
    clearTimeout(note.timer);
    note.timer = setTimeout(() => { note.hidden = true; }, action ? 7000 : 3200);
}

// pictures found on a PDF page (see drawVisiblePages), as boxes in fractions of the page
const pageImageBoxes = new WeakMap();

function imageBoxAt(pageEl, point) {
    return (pageImageBoxes.get(pageEl) || []).find(b =>
        point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h);
}

// `from` is where the drag started; a click (no drag) on a PDF picture takes the whole picture
function finishArea(surface, region, from) {
    const tiny = region.w < 0.02 || region.h < 0.02;
    if (surface.classList.contains('pdf_page')) {
        const page = surface.dataset.page;
        let where = `p. ${page} · area`;
        if (tiny) {
            region = from && imageBoxAt(surface, from);
            if (!region) return;
            where = `p. ${page} · image`;
        }
        attachTo({ page, region, where, thumb: cropCanvas($('canvas', surface), region) });
    } else {
        // a click without dragging takes the whole image
        if (tiny) region = { x: 0, y: 0, w: 1, h: 1 };
        const figure = surface.closest('figure[id], .ltx_para[id]') || surface.closest('[id]');
        const whole = region.w === 1 && region.h === 1;
        attachTo({
            anchor: figure?.id || '',
            imageId: surface.id,
            region,
            where: (figure ? anchorLabel(figure) : 'Image') + (whole ? '' : ' · area'),
            imageSrc: surface.src,
            aspect: (surface.naturalWidth * region.w) / (surface.naturalHeight * region.h) || 1.5,
        });
    }
    openComposer();
}

// Positions an area box: in % inside a PDF page, or in page pixels over an HTML image.
function placeRegion(box, surface, r) {
    if (surface.classList.contains('pdf_page')) {
        if (box.parentNode !== surface) surface.append(box);
        Object.assign(box.style, { left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) });
        return;
    }
    const doc = surface.ownerDocument;
    const rect = surface.getBoundingClientRect();
    const { scrollX, scrollY } = doc.defaultView;
    if (box.parentNode !== doc.body) doc.body.append(box);
    Object.assign(box.style, {
        left: `${rect.left + scrollX + r.x * rect.width}px`,
        top: `${rect.top + scrollY + r.y * rect.height}px`,
        width: `${r.w * rect.width}px`,
        height: `${r.h * rect.height}px`,
    });
}

// A small JPEG of the chosen part of a drawn PDF page, kept with the note.
function cropCanvas(canvas, r) {
    if (!canvas?.width) return '';
    const sw = r.w * canvas.width;
    const sh = r.h * canvas.height;
    const scale = Math.min(1, 320 / sw);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(sw * scale));
    out.height = Math.max(1, Math.round(sh * scale));
    out.getContext('2d').drawImage(canvas, r.x * canvas.width, r.y * canvas.height, sw, sh, 0, 0, out.width, out.height);
    try { return out.toDataURL('image/jpeg', 0.8); } catch { return ''; }
}

// ---- "Note this image" button on hover, in any mode ----

// HTML version: one button inside the paper, moved to whichever image you hover.
// two buttons: ✎ Note (attach a note) and ★ Save as figure / table (a project feature)
function imageBar(doc) {
    const bar = doc.createElement('div');
    bar.className = 'img_note_bar';
    bar.hidden = true;
    bar.innerHTML = '<button type="button" class="img_note_btn" data-act="note">✎ Note</button>'
        + '<button type="button" class="img_note_btn" data-act="save">★ Save as figure</button>';
    return bar;
}

// HTML version: the bar inside the paper, moved to whichever picture or table you hover.
function setupHtmlImageButton(doc) {
    const bar = imageBar(doc);
    doc.body.append(bar);
    let target = null; // an img.ltx_graphics, or a table's figure
    doc.addEventListener('mousemove', e => {
        if (e.target.closest('.img_note_bar')) return;
        const img = e.target.closest('img.ltx_graphics');
        const table = !img && e.target.closest('figure.ltx_table');
        const hit = img || (table?.querySelector('table') ? table : null);
        if (!hit) {
            bar.hidden = true;
            return;
        }
        target = hit;
        const isTable = !!table || !!img?.closest('figure.ltx_table');
        $('[data-act="save"]', bar).textContent = isTable ? '★ Save as table' : '★ Save as figure';
        bar.hidden = false;
        const rect = hit.getBoundingClientRect();
        const { scrollX, scrollY } = doc.defaultView;
        bar.style.left = `${Math.max(scrollX + 4, rect.right + scrollX - bar.offsetWidth - 8)}px`;
        bar.style.top = `${rect.top + scrollY + 8}px`;
    });
    bar.addEventListener('click', e => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (!act || !target) return;
        e.stopPropagation();
        bar.hidden = true;
        if (act === 'save') return saveFeature(target);
        if (target.matches('img')) finishArea(target, { x: 0, y: 0, w: 1, h: 1 });
        else selectBlock(target);
    });
}

// PDF view: the same bar over pictures found on the page.
const pdfImageBtn = imageBar(document);

function showPdfImageButton(e) {
    if (e.target.closest('.img_note_bar')) return;
    const pageEl = e.target.closest('.pdf_page');
    const rect = pageEl?.getBoundingClientRect();
    const box = pageEl && imageBoxAt(pageEl, {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
    });
    if (!box) {
        pdfImageBtn.hidden = true;
        return;
    }
    if (pdfImageBtn.parentNode !== pageEl) pageEl.append(pdfImageBtn);
    pdfImageBtn.hidden = false;
    pdfImageBtn.style.left = pct(box.x + box.w);
    pdfImageBtn.style.top = pct(box.y);
    pdfImageBtn.target = { pageEl, box };
}

// the image or PDF page an area note belongs to
function regionSurface(note) {
    if (note.imageId) return paperDoc()?.getElementById(note.imageId);
    if (note.page) return $(`.pdf_page[data-page="${note.page}"]`);
    return null;
}

// Redraws the boxes of area notes (yellow) and of the area being attached (blue).
function paintRegions() {
    const doc = paperDoc();
    for (const box of [...$$('.region:not(.drawing)'), ...(doc ? $$('.region:not(.drawing)', doc) : [])]) box.remove();
    const target = formTarget();
    const shown = [...notes.filter(hasRegion).map(note => [note, 'noted']), ...(hasRegion(target) ? [[target, 'selected']] : [])];
    for (const [note, kind] of shown) {
        const surface = regionSurface(note);
        if (!surface || !surface.getBoundingClientRect().width) continue;
        const box = surface.ownerDocument.createElement('div');
        box.className = 'region ' + kind;
        if (note.id) box.dataset.note = note.id;
        if (kind === 'noted') box.style.setProperty('--note-color', NoteColors.hexOf(project, note.color));
        placeRegion(box, surface, note.region);
    }
}

// thumbnail of an area note: the saved crop (PDF) or the image cropped with CSS (HTML)
function regionThumb(note) {
    if (!hasRegion(note)) return null;
    const thumb = el('div', 'thumb');
    if (note.thumb) {
        const img = el('img');
        img.src = note.thumb;
        img.alt = 'Noted area';
        thumb.append(img);
        return thumb;
    }
    if (!/^https?:\/\//.test(note.imageSrc || '')) return null;
    const { x, y, w, h } = note.region;
    const aspect = note.aspect || 1.5;
    thumb.classList.add('crop');
    Object.assign(thumb.style, {
        backgroundImage: `url("${note.imageSrc.replace(/"/g, '%22')}")`,
        backgroundSize: `${100 / w}% ${100 / h}%`,
        backgroundPosition: `${w < 1 ? (x / (1 - w)) * 100 : 0}% ${h < 1 ? (y / (1 - h)) * 100 : 0}%`,
        aspectRatio: String(aspect),
        width: `min(100%, ${Math.round(200 * aspect)}px)`,
    });
    return thumb;
}

function selectBlock(block) {
    attachTo({ anchor: block.dataset.anchor, where: anchorLabel(block), quote: snippet(block.innerText) });
    openComposer();
}

function selectLine(lineEl) {
    attachTo({ page: lineEl.dataset.page, line: lineEl.dataset.line, quote: lineEl.dataset.text });
    openComposer();
}

// ---- 📷 capture: an image of part of the material, kept as a note and/or a project figure ----
// (reader/capture.js takes the image; this part works out what is under the box and where it came from)

let pendingCapture = null; // { blob, url, position, locator, caption } while the Save image popup is open

const inside = (rect, x, y) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

// a box (screen coordinates) as fractions of another rectangle, clipped to it
function regionIn(target, box) {
    const x0 = clamp((box.left - target.left) / target.width);
    const y0 = clamp((box.top - target.top) / target.height);
    const x1 = clamp((box.right - target.left) / target.width);
    const y1 = clamp((box.bottom - target.top) / target.height);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const videoContext = time => ({
    position: { segments: [{ start: time }], time, where: formatTime(time) },
    locator: formatTime(time),
    caption: `${source.title} at ${formatTime(time)}`,
});

// 📷 Capture: drag a box over the reader
async function captureArea() {
    closeComposer();
    const reader = $('.reader');
    const box = await Capture.dragBox(reader);
    if (!box) return;
    // for screenshots: the same box, measured again from the reader (the page may shift when sharing starts)
    const start = reader.getBoundingClientRect();
    const boxNow = () => {
        const r = reader.getBoundingClientRect();
        return new DOMRect(box.left - start.left + r.left, box.top - start.top + r.top, box.width, box.height);
    };
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    try {
        if (currentView === 'pdf') {
            const pageEl = $$('.pdf_page').find(p => inside(p.getBoundingClientRect(), cx, cy));
            if (pageEl) return await capturePdf(pageEl, box);
        }
        if (currentView === 'html') return await captureHtml(box, boxNow);
        if (currentView === 'video') {
            const video = $('#video_frame video');
            if (video) return await captureVideo(video, box);
            if (player) {
                player.pause();
                return await captureScreen(boxNow, videoContext(Math.floor(await player.getTime())));
            }
        }
        const line = document.elementFromPoint(cx, cy)?.closest('.line');
        await captureScreen(boxNow, {
            position: line ? { page: line.dataset.page, line: line.dataset.line, where: positionLabel(line.dataset) } : { where: 'Screenshot' },
            locator: line?.dataset.page ? 'p. ' + line.dataset.page : '',
            caption: source.title,
        });
    } catch (err) {
        alert("Couldn't capture that: " + err.message);
    }
}

// PDF: drawn again at high resolution, so the image is sharp
async function capturePdf(pageEl, box) {
    const n = Number(pageEl.dataset.page);
    const region = regionIn(pageEl.getBoundingClientRect(), box);
    const blob = await Capture.pdfRegion(await pdfDoc.getPage(n), region);
    openCapture(blob, { position: { page: String(n), region, where: `p. ${n} · image` }, locator: `p. ${n}`, caption: `${source.title}, p. ${n}` });
}

// arXiv HTML: figures are fetched straight from arXiv; text, equations and tables are screenshots
// the paper's caption for a figure / table, without its "Fig. 2:" (that goes in the credit instead)
function paperCaption(figure) {
    const text = figure?.querySelector('figcaption')?.textContent
        .replace(/\s+/g, ' ').replace(/^\s*(fig(ure)?\.?|table)\s*[\w.-]+\s*[:.]\s*/i, '').trim();
    if (!text) return '';
    return text.length > 160 ? text.slice(0, 160).replace(/\s\S*$/, '…') : text;
}

// a table from the paper as plain, safe HTML (no ids, classes or inline styles; maths kept)
function cleanTable(table) {
    const copy = table.cloneNode(true);
    // links in the table point into the arXiv page (e.g. its reference list): keep just their text
    for (const link of copy.querySelectorAll('a')) link.replaceWith(...link.childNodes);
    for (const node of copy.querySelectorAll('*')) {
        if (node.closest('math')) continue;
        for (const name of ['id', 'class', 'style']) node.removeAttribute(name);
    }
    copy.removeAttribute('id');
    copy.removeAttribute('class');
    copy.removeAttribute('style');
    const html = window.DOMPurify ? DOMPurify.sanitize(copy.outerHTML) : copy.outerHTML;
    return html.replace(/\n\s*\n/g, '\n');
}

// a table in the paper, kept as a real table (you can still read, copy and edit its text)
function tableContext(figure) {
    const label = anchorLabel(figure);
    return {
        position: { anchor: figure.id, where: label },
        locator: label,
        caption: paperCaption(figure) || `${source.title}, ${label}`,
        kind: 'table',
        table: cleanTable(figure.querySelector('table')),
    };
}

async function captureHtml(box, boxNow) {
    const frame = $('#reader_html').getBoundingClientRect();
    const doc = paperDoc();
    const local = new DOMRect(box.left - frame.left, box.top - frame.top, box.width, box.height);
    const cx = local.left + local.width / 2;
    const cy = local.top + local.height / 2;
    const img = [...doc.querySelectorAll('img.ltx_graphics')].find(i => inside(i.getBoundingClientRect(), cx, cy));
    if (img) {
        const region = regionIn(img.getBoundingClientRect(), local);
        // (by tag, not data-anchor: that is only set once every image in the paper has loaded)
        const figure = img.closest('figure[id], .ltx_para[id]') || img.closest('[id]');
        const label = figure ? anchorLabel(figure) : 'Image';
        try {
            const blob = await Capture.imageRegion(img.src, region);
            return openCapture(blob, {
                position: {
                    anchor: figure?.id || '', imageId: img.id, region, where: label + ' · image', imageSrc: img.src,
                    aspect: (img.naturalWidth * region.w) / (img.naturalHeight * region.h) || 1.5,
                },
                locator: label,
                caption: paperCaption(figure) || `${source.title}, ${label}`,
                kind: figure?.matches('.ltx_table') ? 'table' : 'figure',
                credit: region.w < 0.98 || region.h < 0.98 ? 'adapted' : 'from', // only part of it: adapted
            });
        } catch { /* not allowed by the site: take a screenshot instead */ }
    }
    // a table: keep the real table rather than a picture of it
    const tableFigure = doc.elementFromPoint(cx, cy)?.closest('figure.ltx_table');
    if (tableFigure?.querySelector('table')) return openCapture(null, tableContext(tableFigure));

    const block = doc.elementFromPoint(cx, cy)?.closest('[data-anchor]');
    const label = block ? anchorLabel(block) : '';
    await captureScreen(boxNow, {
        position: block ? { anchor: block.id, where: label } : { where: 'Screenshot' },
        locator: label,
        caption: label ? `${source.title}, ${label}` : source.title,
    });
}

// uploaded / linked video: the frame itself (the box may cover part of it)
async function captureVideo(video, box) {
    player?.pause();
    const region = box ? regionIn(Capture.videoContentRect(video), box) : undefined;
    const blob = await Capture.videoFrame(video, region);
    openCapture(blob, videoContext(Math.floor(video.currentTime)));
}

// 📷 Capture frame (video bar): the whole current frame
async function captureFrame() {
    if (!player) return;
    try {
        const video = $('#video_frame video');
        if (video) return await captureVideo(video);
        player.pause();
        // YouTube / Vimeo don't let pages read their frames: take a screenshot of the player
        await captureScreen(() => $('#video_frame').getBoundingClientRect(), videoContext(Math.floor(await player.getTime())));
    } catch (err) {
        alert("Couldn't capture the frame: " + err.message);
    }
}

async function captureScreen(getRect, context) {
    let blob;
    try {
        blob = await Capture.screenRect(getRect);
    } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'AbortError') return; // you said no to sharing
        throw err;
    }
    openCapture(blob, context);
}

// The Save popup. blob: a picture; or context.table: a real table (HTML).
// context: { position, locator, caption, kind?: 'figure' | 'table', credit?: 'from' | 'adapted', table? }
function openCapture(blob, context) {
    if (pendingCapture?.url) URL.revokeObjectURL(pendingCapture.url);
    pendingCapture = { kind: 'figure', credit: 'from', ...context, blob, url: blob ? URL.createObjectURL(blob) : '' };
    const form = $('#capture_form');
    $('#capture_title').textContent = context.table ? 'Save table' : 'Save image';
    $('#capture_preview').hidden = !blob;
    if (blob) $('#capture_preview').src = pendingCapture.url;
    $('#capture_table').hidden = !context.table;
    $('#capture_table').innerHTML = context.table || '';
    $('#capture_where').textContent = context.position.where || '';
    form.elements.caption.value = context.caption || source.title;
    form.elements.kind.value = pendingCapture.kind;
    form.elements.credit.value = pendingCapture.credit;
    // project figures need a project: a material on its own in the library keeps images as notes
    form.elements.asFigure.disabled = !!project.library;
    if (project.library) form.elements.asFigure.checked = false;
    form.elements.note.value = '';
    openModal(form);
    form.elements.caption.select();
}

async function saveCapture(form) {
    const f = form.elements;
    if (!f.asNote.checked && !f.asFigure.checked) return alert('Choose at least one: a note or a project figure.');
    const caption = f.caption.value.trim() || source.title;
    const { blob, table, position, locator } = pendingCapture;
    try {
        if (f.asNote.checked) {
            const note = f.note.value.trim();
            const content = table || `![${caption.replace(/[[\]]/g, '')}](asset:${await Store.putAsset(blob)})`;
            Store.saveItem({
                projectId: project.id, type: 'source_note', sourceId: source.id, kind: 'text',
                ...Object.fromEntries(POSITION_FIELDS.map(name => [name, ''])), ...position,
                body: content + (note ? '\n\n' + note : ''),
                answer: '',
                captured: true, // the picture / table in the body is this note's capture
            });
        }
        if (f.asFigure.checked) {
            const feature = {
                projectId: project.id, type: 'figure', sourceId: source.id,
                kind: f.kind.value, credit: f.credit.value, caption, locator,
            };
            if (table) feature.table = table;
            else {
                // its own copy of the picture, so deleting the note never removes the figure
                const name = caption.replace(/[^\w\- ]+/g, '').trim().slice(0, 40) || 'figure';
                feature.file = { assetId: await Store.putAsset(blob), mime: 'image/png', name: name + '.png' };
            }
            Store.saveItem(feature);
        }
    } catch {
        return alert("Couldn't save it in this browser (private window or storage full?).");
    }
    closeModals();
    if (pendingCapture.url) URL.revokeObjectURL(pendingCapture.url);
    pendingCapture = null;
    render();
    toast(f.asFigure.checked
        ? `Saved to the project's figures as a ${f.kind.value}: insert it from the literature review's Figures tab.`
        : 'Saved as a note.');
}

// ★ Save as figure / table: the whole picture or table, straight to the Save popup
async function saveFeature(target) {
    const figure = target.closest('figure[id]');
    const label = figure ? anchorLabel(figure) : 'Image';
    if (!target.matches('img') && figure?.querySelector('table')) return openCapture(null, tableContext(figure));
    try {
        const blob = await Capture.imageRegion(target.src, { x: 0, y: 0, w: 1, h: 1 });
        openCapture(blob, {
            position: { anchor: figure?.id || '', imageId: target.id, where: label },
            locator: label,
            caption: paperCaption(figure) || `${source.title}, ${label}`,
            kind: figure?.matches('.ltx_table') ? 'table' : 'figure',
        });
    } catch {
        toast("Couldn't get that picture from the site: use 📷 Capture instead.");
    }
}

// ---- floating note box and the collapsible side ----

// After you pick something in the paper: open the note box next to it (or focus the side form).
// `over`: a rectangle to place it in the top-right corner of instead (keeps the video buttons free).
function openComposer(over) {
    const body = noteForm.elements.body;
    // on touch screens, focusing would pop up the keyboard over the page (and scroll it): tap to type
    const focus = () => { if (!matchMedia('(pointer: coarse)').matches) body.focus({ preventScroll: true }); };
    if (!floatingNotes && !document.body.classList.contains('side_collapsed')) {
        focus();
        return;
    }
    const composer = $('#composer');
    if (composer.hidden) {
        $('#composer_slot').append(noteForm);
        composer.hidden = false;
        if (over) placeComposer(over.right - composer.getBoundingClientRect().width - 12, over.top + 12, false);
        else placeComposer(lastPointer.x + 16, lastPointer.y + 16, true);
    }
    focus();
}

// puts the note form back in the side panel
function closeComposer() {
    if ($('#composer').hidden) return;
    $('#note_slot').append(noteForm);
    $('#composer').hidden = true;
}

// Keeps the box on screen; `flip` moves it to the other side of the click if it would overflow.
function placeComposer(x, y, flip) {
    const box = $('#composer');
    const { width, height } = box.getBoundingClientRect();
    if (flip && x + width > innerWidth - 8) x -= width + 32;
    if (flip && y + height > innerHeight - 8) y = innerHeight - height - 8;
    box.style.left = Math.min(Math.max(8, x), innerWidth - width - 8) + 'px';
    box.style.top = Math.min(Math.max(8, y), innerHeight - 40) + 'px';
}

// On phones and tablets (smallScreen, core/ui.js) the side is a bottom sheet over the reader:
// "collapsed" means the sheet is closed. Only the desktop choice is remembered.
function setSideCollapsed(collapsed) {
    document.body.classList.toggle('side_collapsed', collapsed);
    $('#show_side').hidden = !collapsed;
    $('#hide_side').textContent = smallScreen.matches ? 'Close ✕' : 'Hide notes ⟩';
    if (!smallScreen.matches) {
        try { localStorage.setItem(SIDE_KEY, collapsed ? '1' : ''); } catch { }
    }
    if (!collapsed && !floatingNotes && !smallScreen.matches) closeComposer();
    requestAnimationFrame(paintRegions);
}

// the side to start with: closed sheet on small screens, your choice on a desktop
function initialSide() {
    let collapsed = smallScreen.matches;
    if (!collapsed) {
        try { collapsed = localStorage.getItem(SIDE_KEY) === '1'; } catch { }
    }
    setSideCollapsed(collapsed);
}
smallScreen.addEventListener('change', initialSide); // e.g. a tablet turned sideways

// ---- Phrase mode on touch screens: a button to attach the selected words ----
// (with a mouse, letting go of the button does it; on touch, there's no such moment after you drag the handles)

const selectionBtn = el('button', 'selection_btn', '✎ Note on selection');
selectionBtn.type = 'button';
selectionBtn.hidden = true;
document.body.append(selectionBtn);
let selectionDoc = document;
let selectionTimer = null;

function watchSelection(doc) {
    doc.addEventListener('selectionchange', () => {
        clearTimeout(selectionTimer);
        selectionTimer = setTimeout(() => {
            const selection = doc.getSelection();
            const inReader = selection && !selection.isCollapsed && selection.anchorNode && rangeContainerOf(selection.anchorNode);
            if (attachMode === 'phrase' && inReader) {
                selectionDoc = doc;
                selectionBtn.hidden = false;
            } else if (selectionDoc === doc) {
                selectionBtn.hidden = true;
            }
        }, 250);
    });
}

selectionBtn.addEventListener('pointerdown', e => e.preventDefault()); // keep the selection
selectionBtn.addEventListener('click', () => {
    selectionBtn.hidden = true;
    handleSelection(selectionDoc);
});

// ---- notes in the reader ----

// the paragraph/figure or line a note is attached to, if it's on screen
function noteTarget({ anchor, page, line }) {
    if (anchor) return paperDoc()?.getElementById(anchor);
    if (line) return document.getElementById(lineId(page, line));
    return null;
}

// the element a note's start/end offsets count in
function noteContainer(note) {
    if (note.anchor) return paperDoc()?.getElementById(note.anchor);
    if (note.page) return $(`.pdf_page[data-page="${note.page}"] .textLayer`);
    return $('#reader_text');
}

// the exact words of a sentence/phrase/word note, as a DOM Range
function noteRange(note) {
    const container = noteContainer(note);
    if (!container) return null;
    const m = TextRange.map(container);
    const span = TextRange.locate(m, Number(note.start), Number(note.end), note.quote);
    return span && TextRange.rangeOf(m, span.start, span.end);
}

// Paragraph/line notes mark their element; word-level notes are painted with
// the CSS Highlight API (::highlight(noted) / ::highlight(selected)).
function markNoted() {
    const doc = paperDoc();
    for (const node of [...$$('.line.noted'), ...(doc ? $$('[data-anchor].noted', doc) : [])]) {
        node.classList.remove('noted');
        node.style.removeProperty('--note-color');
    }
    for (const note of notes) {
        if (hasRange(note) || hasRegion(note)) continue;
        const node = noteTarget(note);
        if (!node) continue;
        node.classList.add('noted');
        node.style.setProperty('--note-color', NoteColors.hexOf(project, note.color));
    }
    paintHighlights();
}

// keep whatever the note form points at outlined or highlighted
function highlightFormTarget() {
    const doc = paperDoc();
    for (const node of [...$$('.line.selected'), ...(doc ? $$('[data-anchor].selected', doc) : [])]) {
        node.classList.remove('selected');
    }
    const target = formTarget();
    if (!hasRange(target) && !hasRegion(target)) noteTarget(target)?.classList.add('selected');
    paintHighlights();
}

function paintHighlights() {
    const docs = [document, paperDoc()].filter(doc => doc?.defaultView?.CSS?.highlights && doc.defaultView.Highlight);
    // ::highlight(noted) for notes without a colour, ::highlight(noted-<colour id>) for the others
    const names = ['noted', 'selected', ...NoteColors.of(project).map(c => 'noted-' + c.id)];
    const byDoc = new Map(docs.map(doc => [doc, Object.fromEntries(names.map(name => [name, []]))]));
    const add = (range, name) => range && byDoc.get(range.startContainer.ownerDocument)?.[name]?.push(range);

    for (const note of notes) {
        if (hasRange(note)) add(noteRange(note), NoteColors.find(project, note.color) ? 'noted-' + note.color : 'noted');
    }
    const target = formTarget();
    if (hasRange(target)) add(noteRange(target), 'selected');

    for (const [doc, ranges] of byDoc) {
        const { CSS, Highlight } = doc.defaultView;
        for (const name of names) CSS.highlights.set(name, new Highlight(...ranges[name]));
        for (const name of [...CSS.highlights.keys()]) if (!names.includes(name)) CSS.highlights.delete(name); // a removed colour
    }
    paintRegions();
}

async function jumpTo(note) {
    if (smallScreen.matches) setSideCollapsed(true); // close the notes sheet so you can see the place
    if (hasTime(note)) {
        // a timed note: play from its first moment or range (or the one you clicked)
        await playNoteSegment(segmentsOf(note)[0]);
        return;
    }
    const view = note.anchor ? 'html' : note.page ? 'pdf' : 'text';
    if (!available.includes(view)) return;
    await showView(view);
    const target = hasRegion(note)
        ? $(`.region[data-note="${note.id}"]`) || regionSurface(note)
        : noteTarget(note) || noteRange(note)?.startContainer.parentElement;
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.classList.remove('flash');
    void target.offsetWidth; // restart the animation
    target.classList.add('flash');
}

async function playNoteSegment(segment) {
    if (!available.includes('video')) return;
    if (smallScreen.matches) setSideCollapsed(true);
    await showView('video');
    playSegment(segment);
    $('#reader_video').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ---- add this material to (another) project ----
// On its own in the library: it moves into the project you pick, with your notes. Already in a project:
// the other project gets its own copy.

function renderAddToProject() {
    const book = Library.bookOf(source);
    const others = Store.getProjects().filter(p => !book || !Library.inProject(book, p.id));
    $('#add_project').hidden = !others.length;
    $('#add_project_label').textContent = project.library ? 'Add to a project' : 'Also add to';
    $('#add_project_select').replaceChildren(new Option(project.library ? 'Add to a project…' : 'Also add to…', ''), ...others.map(p => new Option(p.title, p.id)));
    $('#in_library').hidden = !project.library;
}

$('#add_project_select').onchange = async e => {
    const projectId = e.target.value;
    if (!projectId) return;
    const target = Store.getProject(projectId);
    const id = await Library.addToProject(source, projectId);
    if (id === source.id) {
        // moved out of the library: this page now belongs to the project
        location.replace('material.html?id=' + encodeURIComponent(id));
        return;
    }
    $('#add_project_state').replaceChildren(`Added to ${target.title} ✓ `, Object.assign(el('a', '', 'Open it there'), { href: 'material.html?id=' + encodeURIComponent(id) }));
    renderAddToProject();
};

// ---- your general notes about this paper (dashboard notes that link or cite it) ----

function renderInNotes() {
    const all = Store.getItems(project.id);
    const sources = all.filter(i => i.type === 'source');
    assignCitekeys(sources);
    const style = project.citeStyle || 'apa';
    const me = sources.find(s => s.id === source.id) || source;
    const about = PaperLinks.notesAbout(me, all).sort((a, b) => b.updatedAt - a.updatedAt);
    // notes on other papers, and their summaries and reviews, that cite this one
    const mentions = PaperLinks.mentionsOf(me, all).sort((a, b) => b.item.updatedAt - a.item.updatedAt);
    const count = about.length + mentions.length;
    $('#in_notes').hidden = !count;
    $('#in_notes_count').textContent = count ? `(${count})` : '';
    $('#in_notes_list').replaceChildren(...about.map(note => {
        const li = el('li');
        const a = el('a', 'in_note');
        a.href = `project_dashboard.html?id=${encodeURIComponent(project.id)}&item=${encodeURIComponent(note.id)}`;
        a.append(el('strong', '', note.title || PaperLinks.preview((note.body || '').split('\n')[0], sources, style)));
        if (note.title && note.body) a.append(el('span', '', PaperLinks.preview(note.body, sources, style).slice(0, 160)));
        li.append(a);
        return li;
    }), ...mentions.map(({ item, on, kind, text }) => {
        const li = el('li');
        const a = el('a', 'in_note');
        a.href = 'material.html?id=' + encodeURIComponent(on?.id || item.sourceId) + (kind === 'note' ? '#note=' + encodeURIComponent(item.id) : '');
        a.append(el('strong', '', { note: 'A note on ', summary: 'The summary of ', review: 'The review of ' }[kind] + (on?.title || 'another paper')),
            el('span', '', PaperLinks.preview(text, sources, style).slice(0, 160)));
        li.append(a);
        return li;
    }));
}

// ---- notes list ----

let noteFilter = ''; // a colour id: show only its notes

function renderNotes() {
    $('#notes_heading').textContent = `Notes (${notes.length})`;
    $('#show_side').textContent = `⟨ Notes (${notes.length})`;
    renderNoteFilter();
    const shown = noteFilter ? notes.filter(n => n.color === noteFilter) : notes;
    $('#source_notes').replaceChildren(...shown.map(noteRow));
}

// "All · ● Quotable 3 · ● Question 1": only colours that some note here uses
function renderNoteFilter() {
    const used = NoteColors.of(project).map(c => ({ ...c, count: notes.filter(n => n.color === c.id).length })).filter(c => c.count);
    if (noteFilter && !used.some(c => c.id === noteFilter)) noteFilter = '';
    const box = $('#note_filter');
    box.hidden = used.length === 0;
    const chip = (id, label, count, hex) => {
        const btn = el('button', 'color_chip');
        btn.type = 'button';
        btn.dataset.color = id;
        btn.setAttribute('aria-pressed', noteFilter === id);
        if (hex) btn.append(NoteColors.dot(hex));
        btn.append(`${label} ${count}`);
        return btn;
    };
    box.replaceChildren(chip('', 'All', notes.length), ...used.map(c => chip(c.id, c.label, c.count, c.hex)));
}

// ---- note colour picker (colours and their meanings: sources/colors.js, set per project) ----

let lastColor = ''; // the next note keeps the colour you used last

function renderColorPick() {
    const current = noteForm.elements.color.value;
    const chip = (id, label, hex) => {
        const btn = el('button', 'color_chip');
        btn.type = 'button';
        btn.dataset.color = id;
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', current === id);
        btn.append(hex ? NoteColors.dot(hex) : NoteColors.dot('transparent'), label);
        return btn;
    };
    const edit = el('button', 'link color_edit', 'Edit colours');
    edit.type = 'button';
    edit.title = 'Choose the colours and what they mean, for every paper in this project';
    $('#color_pick').replaceChildren(chip('', 'None', ''), ...NoteColors.of(project).map(c => chip(c.id, c.label, c.hex)), edit);
}

function setNoteColor(id) {
    noteForm.elements.color.value = id;
    renderColorPick();
}

function positionLabel({ where, page, line }) {
    return where || [page ? 'p. ' + page : '', line ? 'l. ' + line : ''].filter(Boolean).join(' · ');
}

function noteRow(note) {
    const kind = note.kind || 'text';
    const li = el('li', 'source_note ' + kind + (note.anchor || note.line || note.page || hasRange(note) || hasTime(note) ? ' jumpable' : ''));
    li.dataset.id = note.id;
    const color = NoteColors.find(project, note.color);
    if (color) {
        li.classList.add('colored');
        li.style.setProperty('--note-color', color.hex);
    }

    const segments = segmentsOf(note);
    const meta = [
        color?.label || '',
        kind === 'question' ? 'Question' : '',
        segments.length ? '' : positionLabel(note), // timed notes show their moments as buttons below
        new Date(note.createdAt).toLocaleDateString(),
    ].filter(Boolean).join(' · ');

    const head = el('div', 'note_head');
    const label = el('small', '', meta);
    if (color) label.prepend(NoteColors.dot(color.hex), ' ');
    head.append(label, el('button', 'link edit_note', 'Edit'), el('button', 'link delete_note', 'Delete'));
    for (const btn of $$('button', head)) btn.type = 'button';
    li.append(head);

    if (segments.length) {
        const chips = el('div', 'seg_chips');
        chips.append(...segments.map(segment => {
            const chip = el('button', 'seg_chip', '▶ ' + formatSegment(segment));
            chip.type = 'button';
            chip.dataset.start = segment.start;
            if (isRange(segment)) chip.dataset.end = segment.end;
            chip.title = isRange(segment) ? 'Play this range' : 'Play from here';
            return chip;
        }));
        li.append(chips);
    }

    if (note.quote) li.append(el('blockquote', 'quote', note.quote));
    // a captured image is in the note itself; no need for the area thumbnail too
    const thumb = note.captured ? null : regionThumb(note);
    if (thumb) li.append(thumb);

    const style = project.citeStyle || 'apa';
    const body = el('div', 'md');
    renderMarkdown(body, PaperLinks.withLinks(note.body, citeSources, style));
    li.append(body);

    if (kind === 'question') {
        const answer = el('div', 'answer md');
        renderMarkdown(answer, PaperLinks.withLinks(note.answer, citeSources, style), 'No answer yet.');
        li.append(answer);
    }
    return li;
}

// ---- note form ----

// Everything that says where a note is attached. Page and line live in the form's inputs
// (you can type them); the rest is kept in `attached`.
const POSITION_FIELDS = ['anchor', 'where', 'page', 'line', 'start', 'end', 'quote', 'region', 'imageId', 'imageSrc', 'aspect', 'thumb', 'time', 'segments'];
let attached = {};

function formTarget() {
    const f = noteForm.elements;
    return { ...attached, page: f.page.value.trim(), line: f.line.value.trim() };
}

// points the note form at a paragraph, line, range of words or image area ({} detaches it)
function attachTo(target) {
    attached = {};
    for (const name of POSITION_FIELDS) {
        if (name !== 'page' && name !== 'line' && target[name] !== undefined && target[name] !== '') attached[name] = target[name];
    }
    noteForm.elements.page.value = target.page ?? '';
    noteForm.elements.line.value = target.line ?? '';
    renderQuotePreview();
    highlightFormTarget();
}

// typing a page/line points the note at that line instead
function syncFromPosition() {
    const f = noteForm.elements;
    const page = f.page.value.trim();
    const line = f.line.value.trim();
    attachTo({ page, line, quote: (line && document.getElementById(lineId(page, line))?.dataset.text) || '' });
}

function renderQuotePreview() {
    const target = formTarget();
    const segments = segmentsOf(target);
    $('#quote_preview').hidden = !target.quote && !hasRegion(target) && !segments.length;
    $('#quote_where').textContent = segments.length
        ? (segments.length > 1 ? `${segments.length} parts of the video` : isRange(segments[0]) ? 'Range' : 'Moment')
        : positionLabel(target);
    // each moment / range, removable
    $('#quote_segments').replaceChildren(...segments.map((segment, i) => {
        const chip = el('button', 'seg_chip removable', formatSegment(segment) + ' ×');
        chip.type = 'button';
        chip.dataset.index = i;
        chip.title = 'Remove from this note';
        return chip;
    }));
    if (player) player.getTime().then(updateVideoButtons).catch(() => { });
    $('#quote_preview blockquote').textContent = target.quote || '';
    $('#quote_preview blockquote').hidden = !target.quote;
    $('#quote_thumb').replaceChildren(...[regionThumb(target)].filter(Boolean));
}

// small previews of the images written into the note text
function renderBodyImages() {
    const ids = [...noteForm.elements.body.value.matchAll(/asset:([a-z0-9]+)/gi)].map(m => m[1]);
    const strip = $('#note_images');
    strip.replaceChildren(...ids.map(id => {
        const img = el('img');
        img.setAttribute('src', '#asset-' + id);
        img.alt = 'Image in this note';
        return img;
    }));
    loadAssetImages(strip);
}

function updateAnswerField() {
    noteForm.elements.answer.hidden = noteForm.elements.kind.value !== 'question';
}

function startNoteEdit(note) {
    closeComposer(); // notes are edited in the side panel, next to the list
    editingNoteId = note.id;
    const f = noteForm.elements;
    f.kind.value = note.kind || 'text';
    setNoteColor(note.color || '');
    f.body.value = note.body || '';
    f.answer.value = note.answer || '';
    attachTo(note);
    $('#cancel_note').hidden = false;
    $('#save_note').textContent = 'Save note';
    updateAnswerField();
    renderBodyImages();
    noteForm.scrollIntoView({ block: 'nearest' });
    f.body.focus();
}

function cancelNoteEdit() {
    editingNoteId = null;
    noteForm.reset();
    setNoteColor(lastColor);
    $('#cancel_note').hidden = true;
    $('#save_note').textContent = 'Add note';
    updateAnswerField();
    renderBodyImages();
    attachTo({});
}

// ---- summary / review: view <-> edit in place ----

function setMdEditing(field, editing) {
    $('.md', field).hidden = editing;
    $('.md_edit', field).hidden = !editing;
    $('.edit_md', field).hidden = editing;
    if (editing) {
        const textarea = $('textarea', field);
        textarea.value = fieldValue(field.dataset.field);
        textarea.focus();
    }
}

// ---- events ----

$('.view_toggle').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn) showView(btn.dataset.view);
});

$('#attach_mode').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn) setAttachMode(btn.dataset.mode);
});

for (const id of ['#reader_pdf', '#reader_text']) {
    $(id).addEventListener('click', e => handleClick(e, document));
    $(id).addEventListener('mouseup', () => handleSelection(document));
}
watchSelection(document);
$('#reader_pdf').addEventListener('pointerdown', e => startArea(e, document));
$('#reader_pdf').addEventListener('mousemove', showPdfImageButton);
$('#reader_pdf').addEventListener('mouseleave', () => { pdfImageBtn.hidden = true; });
pdfImageBtn.addEventListener('click', async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    e.stopPropagation();
    pdfImageBtn.hidden = true;
    const { pageEl, box } = pdfImageBtn.target;
    const page = pageEl.dataset.page;
    if (act === 'note') {
        attachTo({ page, region: box, where: `p. ${page} · image`, thumb: cropCanvas($('canvas', pageEl), box) });
        return openComposer();
    }
    // ★ Save as figure: the picture, drawn again at high resolution
    const blob = await Capture.pdfRegion(await pdfDoc.getPage(Number(page)), box);
    openCapture(blob, { position: { page, region: box, where: `p. ${page} · image` }, locator: `p. ${page}`, caption: `${source.title}, p. ${page}` });
});
window.addEventListener('resize', paintRegions);

// your own images in notes, summary and review: paste, drop, or "Add image"
for (const textarea of [noteForm.elements.body, noteForm.elements.answer, ...$$('.md_edit textarea')]) {
    MdImages.enable(textarea);
}
$('#add_image').onclick = () => MdImages.pick(noteForm.elements.body);
$('#color_pick').addEventListener('click', e => {
    const btn = e.target.closest('button[data-color]');
    if (btn) setNoteColor(btn.dataset.color);
    if (e.target.closest('.color_edit')) {
        colorEditor.render();
        openModal($('#colors_form')); // over the paper: you stay where you were
    }
});
// the colours popup: changes show at once in the paper, the note box and the notes
const colorEditor = project && NoteColors.editor({
    list: $('#color_rows'),
    add: $('#add_color'),
    project,
    count: id => Store.getItems(project.id).filter(i => i.type === 'source_note' && i.color === id).length,
    onChange: () => {
        NoteColors.applyCss(document, project);
        NoteColors.applyCss(paperDoc(), project);
        renderColorPick();
        renderNotes();
        markNoted();
    },
});
$('#note_filter').addEventListener('click', e => {
    const btn = e.target.closest('button[data-color]');
    if (!btn) return;
    noteFilter = btn.dataset.color;
    renderNotes();
});
if (project) {
    NoteColors.applyCss(document, project);
    renderColorPick();
}
// colours renamed or added in another tab (the Literature tab)
window.addEventListener('storage', e => {
    if (e.key !== 'research_board_projects') return;
    Object.assign(project, Store.getProject(project.id));
    NoteColors.applyCss(document, project);
    NoteColors.applyCss(paperDoc(), project);
    renderColorPick();
    renderNotes();
    markNoted();
});

// ⛶ full screen: just the paper (and the note box when you attach a note). Uses the browser's full screen
// where it can (not on iPhone): the app's own bars and the source details are hidden either way.
let sideBeforeFull = false;
function setFullScreen(on) {
    if (on === document.body.classList.contains('reading_full')) return;
    document.body.classList.toggle('reading_full', on);
    $('#full_btn').setAttribute('aria-pressed', on);
    $('#full_btn').textContent = on ? '✕ Exit full screen' : '⛶ Full screen';
    if (on) {
        sideBeforeFull = document.body.classList.contains('side_collapsed');
        setSideCollapsed(true);
        document.documentElement.requestFullscreen?.().catch(() => { });
    } else {
        setSideCollapsed(sideBeforeFull);
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => { });
    }
    measureTopBar();
    requestAnimationFrame(paintRegions);
}
$('#full_btn').onclick = () => setFullScreen(!document.body.classList.contains('reading_full'));
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) setFullScreen(false); }); // Esc
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('reading_full') && !document.fullscreenElement && $('#modals').hidden) setFullScreen(false);
});

// bold, lists, links… as buttons (phones and tablets have no Ctrl + B); @ cites a paper
for (const textarea of [noteForm.elements.body, noteForm.elements.answer, ...$$('.md_edit textarea')]) {
    MdBar.attach(textarea);
    CitePicker.attach(textarea, projectSources);
}

// phones: tags, status and the citation fold away so the reading starts on the first screen
$('#head_more').onclick = () => {
    const open = $('.material_head').classList.toggle('head_open');
    $('#head_more').setAttribute('aria-expanded', open);
    $('#head_more').textContent = open ? 'Less ▴' : 'Tags, status, citation ▾';
};
noteForm.elements.body.addEventListener('input', renderBodyImages);

$('#cite_style').onchange = e => {
    $('#copy_cite').title = Cite.format(source, e.target.value);
};

$('#copy_cite').onclick = async () => {
    const btn = $('#copy_cite');
    const ok = await copyText(Cite.format(source, $('#cite_style').value));
    btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
    setTimeout(() => { btn.textContent = 'Copy citation'; }, 1600);
};

// 📷 capture
$('#capture_btn').onclick = captureArea;
$('#capture_frame').onclick = captureFrame;
$('#capture_form').addEventListener('submit', e => {
    e.preventDefault();
    saveCapture(e.target);
});

// video: a moment, a range (start, then end), several of either in one note; play from the timeline
$('#note_at_time').onclick = async () => {
    if (!player) return;
    addSegment({ start: Math.floor(await player.getTime()) });
};
$('#range_btn').onclick = async () => {
    if (!player) return;
    const time = Math.floor(await player.getTime());
    if (rangeStart === null) {
        rangeStart = time; // keep watching, press again where it ends
        updateVideoButtons(time);
        return;
    }
    const [start, end] = [rangeStart, time].sort((a, b) => a - b);
    rangeStart = null;
    addSegment(end > start ? { start, end } : { start });
};
$('#timeline').addEventListener('click', e => {
    const mark = e.target.closest('[data-start]');
    if (mark) playSegment(segmentFrom(mark.dataset));
});
$('#quote_segments').addEventListener('click', e => {
    const chip = e.target.closest('[data-index]');
    if (!chip) return;
    attachTo(timedTarget(segmentsOf(formTarget()).filter((_, i) => i !== Number(chip.dataset.index))));
});

$('#upload_pdf').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    attachFile(file);
});
$('#get_paper_file').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    attachFile(file);
});
$('#find_copy').onclick = () => findReadableCopy(true);
// drop a downloaded PDF anywhere on the reader
const isFileDrag = e => [...(e.dataTransfer?.types || [])].includes('Files');
$('.reader').addEventListener('dragover', e => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    $('.reader').classList.add('file_over');
});
$('.reader').addEventListener('dragleave', e => {
    if (!e.currentTarget.contains(e.relatedTarget)) $('.reader').classList.remove('file_over');
});
$('.reader').addEventListener('drop', e => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    $('.reader').classList.remove('file_over');
    attachFile([...e.dataTransfer.files].find(f => f.type === 'application/pdf' || f.type.startsWith('video/')) || e.dataTransfer.files[0]);
});

async function attachFile(file) {
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    if (file.type !== 'application/pdf' && !isVideo) return alert('Please choose a PDF or a video file.');
    try {
        const assetId = await Store.putAsset(file);
        if (source.file?.assetId) Store.deleteAsset(source.file.assetId);
        Store.saveItem({
            id: source.id,
            file: { assetId, name: file.name, size: file.size, mime: file.type },
            // a PDF replaces pasted text; a video keeps it (it may be the transcript)
            ...(isVideo ? { kind: 'video' } : { text: '' }),
        });
    } catch {
        return alert("Couldn't save the file in this browser (private window or storage full?).");
    }
    refresh();
    currentView = isVideo ? 'video' : 'pdf';
    setupReader();
    if (!isVideo) fillBlanksFromPdf(file);
}

// A PDF brought in by hand (a paywalled paper, say): what the source is missing, read from the PDF itself.
// Only empty fields are filled; nothing you entered is replaced.
async function fillBlanksFromPdf(file) {
    let pdf;
    try {
        pdf = await pdfDetails(file);
    } catch {
        return;
    }
    const update = {};
    if (!source.abstract && pdf.abstract) update.abstract = pdf.abstract;
    if (!source.authors?.length && pdf.authors.length) update.authors = pdf.authors;
    if (!source.keywords?.length && pdf.keywords.length) update.keywords = pdf.keywords;
    if (!source.venue && pdf.venue) update.venue = pdf.venue;
    if (!source.published && pdf.published) update.published = pdf.published;
    if (!source.doi && pdf.doi) update.doi = pdf.doi;
    if (!Object.keys(update).length) return;
    Store.saveItem({ id: source.id, ...update });
    refresh();
    toast(`Filled in from the PDF: ${Object.keys(update).join(', ')}.`);
}

$('#paste_text').onclick = () => {
    const form = $('#text_form');
    form.elements.text.value = source.text || '';
    openModal(form);
    form.elements.text.focus();
};

$('#text_form').addEventListener('submit', e => {
    e.preventDefault();
    // pasted text replaces your uploaded PDF, but keeps a video (the text may be its transcript)
    // and the saved copy of a web PDF
    const replacesFile = pdfFile(source) && !source.file.fromUrl;
    if (replacesFile) Store.deleteAsset(source.file.assetId);
    Store.saveItem({
        id: source.id,
        text: e.target.elements.text.value.trim(),
        file: replacesFile ? null : source.file || null,
    });
    closeModals();
    refresh();
    currentView = 'text';
    setupReader();
});

$('#remove_material').onclick = () => {
    if (!confirm('Remove your uploaded file and pasted text? Your notes stay.')) return;
    const ownFile = source.file && !source.file.fromUrl;
    if (ownFile) Store.deleteAsset(source.file.assetId);
    Store.saveItem({ id: source.id, file: ownFile ? null : source.file, text: '' });
    refresh();
    setupReader();
};

$('#edit_source').onclick = () => SourceForm.open(source, {
    projectId: project.id,
    onSaved: () => {
        const before = [source.url, source.pdfUrl, source.doi].join('|');
        const oldPdf = source.pdfUrl;
        refresh();
        if ([source.url, source.pdfUrl, source.doi].join('|') === before) return;
        // the saved web copy belongs to the old PDF link
        if (source.pdfUrl !== oldPdf && source.file?.fromUrl) {
            Store.deleteAsset(source.file.assetId);
            Store.saveItem({ id: source.id, file: null });
            source = Store.getItem(sourceId);
        }
        setupReader();
    },
});

$('#delete_source').onclick = () => {
    if (!confirm(`Delete "${source.title}"${notes.length ? ` and its ${notes.length} notes` : ''}?`)) return;
    // its notes and bookmarks go with it
    Store.getItems(project.id).filter(i => i.sourceId === source.id).forEach(i => Store.deleteItem(i.id));
    Store.deleteItem(source.id);
    location.href = Nav.backHref(project.library ? 'library.html' : 'project_dashboard.html?id=' + encodeURIComponent(project.id) + '#literature');
};

$('#tag_input').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    addTag(e.target.value);
    e.target.value = '';
});
// picking a suggestion from the list adds it straight away
$('#tag_input').addEventListener('input', e => {
    if (e.inputType === 'insertReplacementText' || !e.inputType) {
        addTag(e.target.value);
        e.target.value = '';
    }
});
$('#tags').addEventListener('click', e => {
    const remove = e.target.closest('.tag_remove');
    if (!remove) return;
    Store.saveItem({ id: source.id, tags: tagsOf(source).filter(tag => tag !== remove.dataset.tag) });
    refresh();
});

$('#status_select').onchange = e => {
    Store.saveItem({ id: source.id, status: e.target.value });
    refresh();
};

for (const field of $$('.md_field')) {
    field.addEventListener('click', e => {
        if (e.target.closest('.edit_md')) setMdEditing(field, true);
        else if (e.target.closest('.cancel_md')) setMdEditing(field, false);
        else if (e.target.closest('.save_md')) {
            Store.saveItem({ id: source.id, [field.dataset.field]: $('textarea', field).value.trim() });
            refresh();
        }
    });
}

$('#source_notes').addEventListener('click', e => {
    const row = e.target.closest('.source_note');
    if (!row || e.target.closest('a')) return;
    const note = notes.find(n => n.id === row.dataset.id);
    const chip = e.target.closest('.seg_chip');
    if (chip) playNoteSegment(segmentFrom(chip.dataset));
    else if (e.target.closest('.edit_note')) startNoteEdit(note);
    else if (e.target.closest('.delete_note')) {
        if (!confirm('Delete this note?')) return;
        if (editingNoteId === note.id) cancelNoteEdit();
        Store.deleteItem(note.id);
        render();
    } else if (row.classList.contains('jumpable')) jumpTo(note);
});

noteForm.elements.kind.onchange = updateAnswerField;
noteForm.elements.page.oninput = syncFromPosition;
noteForm.elements.line.oninput = syncFromPosition;
$('#cancel_note').onclick = () => {
    cancelNoteEdit();
    closeComposer();
};

// floating note box: track clicks, drag by the header, Esc closes, Ctrl/Cmd+Enter saves
document.addEventListener('pointerup', e => { lastPointer = { x: e.clientX, y: e.clientY }; });
$('#composer_close').onclick = closeComposer;
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#composer').hidden) closeComposer();
});
noteForm.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        noteForm.requestSubmit();
    }
});
$('#composer_head').addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const head = e.currentTarget;
    const rect = $('#composer').getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    head.setPointerCapture(e.pointerId);
    const move = ev => placeComposer(ev.clientX - dx, ev.clientY - dy, false);
    const up = () => {
        head.removeEventListener('pointermove', move);
        head.removeEventListener('pointerup', up);
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
});

$('#float_toggle').onchange = e => {
    floatingNotes = e.target.checked;
    try { localStorage.setItem(FLOAT_KEY, floatingNotes ? '1' : '0'); } catch { }
    if (!floatingNotes) closeComposer();
};
$('#hide_side').onclick = () => setSideCollapsed(true);
$('#show_side').onclick = () => setSideCollapsed(false);
$('#clear_quote').onclick = () => {
    rangeStart = null;
    attachTo({});
};

noteForm.addEventListener('submit', e => {
    e.preventDefault();
    const f = noteForm.elements;
    const kind = f.kind.value;
    const target = formTarget();
    // every position field is written, so an edited note drops what it no longer uses
    const position = Object.fromEntries(POSITION_FIELDS.map(name => [name, target[name] ?? '']));
    Store.saveItem({
        id: editingNoteId,
        projectId: project.id,
        type: 'source_note',
        sourceId: source.id,
        kind,
        ...position,
        start: position.start === '' ? '' : Number(position.start),
        end: position.end === '' ? '' : Number(position.end),
        body: f.body.value.trim(),
        answer: kind === 'question' ? f.answer.value.trim() : '',
        color: f.color.value,
    });
    lastColor = f.color.value;
    cancelNoteEdit();
    closeComposer();
    render();
});

if (!source || source.type !== 'source' || !project) location.replace('../index.html');
else {
    init();
    const linked = location.hash.match(/^#note=([\w-]+)$/)?.[1];
    const note = linked && notes.find(n => n.id === linked);
    if (note) setTimeout(() => jumpTo(note), 600); // after the reader has laid out
}

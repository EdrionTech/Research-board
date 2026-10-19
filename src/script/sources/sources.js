// Literature sources, shared by the dashboard and material pages:
// helpers, the link lookup and the add/edit source form.
// Sources follow model/literature material.json.

const KIND_LABELS = {
    article: 'Article', book: 'Book', chapter: 'Chapter', report: 'Report',
    thesis: 'Thesis', web: 'Web page', video: 'Video', other: 'Other',
};
const STATUS_LABELS = { to_read: 'To read', reading: 'Reading', done: 'Done' };

// ---- helpers ----

const authorName = a => [a.firstName, a.lastName].filter(Boolean).join(' ');

// "Doe & Smith · 2024", "Doe et al. · 2024"
function shortCitation(source) {
    const names = (source.authors || []).map(a => a.lastName || a.firstName);
    const who = names.length > 2 ? names[0] + ' et al.' : names.join(' & ');
    return [who, (source.published || '').slice(0, 4)].filter(Boolean).join(' · ');
}

// "John Doe (Example University), Jane Smith"
function authorsLine(source) {
    return (source.authors || [])
        .map(a => authorName(a) + (a.affiliation ? ` (${a.affiliation})` : '')).join(', ');
}

function splitName(name) {
    const words = name.trim().split(/\s+/);
    const lastName = words.pop() || '';
    return { firstName: words.join(' '), lastName };
}

// One author per line: "First Last, Affiliation"
function parseAuthors(text) {
    return text.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const [name, ...affiliation] = line.split(',');
        return { ...splitName(name), affiliation: affiliation.join(',').trim() };
    });
}

function formatAuthors(authors = []) {
    return authors.map(a => authorName(a) + (a.affiliation ? ', ' + a.affiliation : '')).join('\n');
}

// your own tags on a source (keywords are the paper's own)
const tagsOf = source => source.tags || [];
const hasTag = (source, tag) => tagsOf(source).some(t => t.toLowerCase() === tag.toLowerCase());

// older sources kept their summary in `body`
const summaryOf = source => source.summary ?? source.body ?? '';

// Readable keys for citing sources in your writing, e.g. [@vaswani2017attention].
// A source gets its key once and keeps it, so citations don't break if you edit its details.
function assignCitekeys(sources) {
    const ascii = text => (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const taken = new Set(sources.map(s => s.citekey).filter(Boolean));
    for (const source of sources) {
        if (source.citekey) continue;
        const base = (ascii(source.authors?.[0]?.lastName).match(/[a-z0-9]+/g) || ['source']).join('').slice(0, 20)
            + ((source.published || '').match(/\d{4}/)?.[0] || '')
            + ((ascii(source.title).match(/[a-z0-9]+/g) || []).find(word => word.length > 3) || '');
        let key = base;
        for (let i = 0; taken.has(key); i++) key = base + String.fromCharCode(97 + i); // …a, …b
        taken.add(key);
        source.citekey = key;
        Store.saveItem({ id: source.id, citekey: key }, { touch: false });
    }
}

const hasMaterial = source => !!(source.file || source.text || source.pdfUrl || arxivIdOf(source) || videoInfo(source));

// the uploaded file, if it is a PDF (older uploads have no mime and are PDFs)
const pdfFile = source => (source.file?.assetId && !source.file.mime?.startsWith('video/') ? source.file : null);

// ---- videos ----

function youtubeId(url) {
    return url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/)?.[1];
}

// How to play a video source: { provider: 'youtube' | 'vimeo' | 'file' | 'url', id?, src? }, or null.
function videoInfo(source) {
    if (source.file?.mime?.startsWith('video/')) return { provider: 'file' };
    const url = source.url || '';
    const youtube = youtubeId(url);
    if (youtube) return { provider: 'youtube', id: youtube };
    const vimeo = url.match(/vimeo\.com\/(?:video\/|channels\/[\w-]+\/)?(\d+)/)?.[1];
    if (vimeo) return { provider: 'vimeo', id: vimeo };
    if (/\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i.test(url)) return { provider: 'url', src: url };
    return null;
}

// Title and channel from the site's oEmbed service (YouTube, Vimeo), or just the kind for a video file link.
async function lookupVideo(link) {
    const youtube = youtubeId(link);
    const vimeo = /vimeo\.com\//i.test(link);
    if (!youtube && !vimeo) return /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i.test(link) ? { kind: 'video' } : null;
    const page = youtube ? 'https://www.youtube.com/watch?v=' + youtube : link;
    const api = youtube ? 'https://www.youtube.com/oembed?format=json&url=' : 'https://vimeo.com/api/oembed.json?url=';
    const res = await fetch(api + encodeURIComponent(page));
    if (!res.ok) return { kind: 'video', url: page };
    const data = await res.json();
    return {
        kind: 'video',
        url: page,
        title: data.title || '',
        venue: data.provider_name || (youtube ? 'YouTube' : 'Vimeo'),
        // the channel is the "author" of a video
        authors: data.author_name ? [{ firstName: '', lastName: data.author_name, affiliation: '' }] : [],
        published: data.upload_date ? data.upload_date.slice(0, 10) : undefined,
        abstract: data.description || undefined,
    };
}

// arXiv id from the source's link, PDF link or arXiv DOI
function arxivIdOf(source) {
    return source.arxiv || findArxivId(source.url || '') || findArxivId(source.pdfUrl || '')
        || (source.doi || '').match(/^10\.48550\/arxiv\.(\d{4}\.\d{4,5})/i)?.[1];
}

// ---- look up a paper from a link, DOI or arXiv id ----
// OpenAlex (free, no key) gives details plus any open-access PDF; Crossref and DataCite are
// fallbacks. arXiv papers go straight to DataCite (it registers arXiv DOIs) and the arXiv PDF.

const OPENALEX_KINDS = {
    article: 'article', preprint: 'article', review: 'article', letter: 'article',
    book: 'book', 'book-chapter': 'chapter', dissertation: 'thesis', report: 'report',
};
const CROSSREF_KINDS = {
    'journal-article': 'article', 'proceedings-article': 'article', 'posted-content': 'article',
    book: 'book', monograph: 'book', 'book-chapter': 'chapter', dissertation: 'thesis', report: 'report',
};

function findArxivId(link) {
    return link.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/i)?.[1]
        ?? link.match(/^(?:arxiv:)?(\d{4}\.\d{4,5})(v\d+)?$/i)?.[1];
}

function findDoi(link) {
    const arxiv = findArxivId(link);
    if (arxiv) return '10.48550/arXiv.' + arxiv;
    let doi = link.match(/10\.\d{4,9}\/[^\s?#]+/)?.[0];
    if (!doi) return null;
    try { doi = decodeURIComponent(doi); } catch { }
    return doi.replace(/\/(full|abstract|epdf|pdf)$/i, '').replace(/\.pdf$/i, '').replace(/[.,;]+$/, '');
}

// Returns the fields it found (same names as the source form), or null.
async function lookupMaterial(link) {
    const video = await lookupVideo(link);
    if (video) return video;

    const doi = findDoi(link);
    const arxiv = findArxivId(link);
    let found = null;
    if (arxiv) {
        found = await fromDataCite(doi) ?? {};
        found.pdfUrl = `https://arxiv.org/pdf/${arxiv}`;
    } else if (doi) {
        found = await fromOpenAlex(doi) ?? await fromCrossref(doi) ?? await fromDataCite(doi);
    } else if (!/^https?:\/\//i.test(link) && link.length >= 12) {
        // a title or a reference: find its DOI first
        const titleDoi = await findDoiByTitle(link);
        if (titleDoi) found = await fromOpenAlex(titleDoi) ?? await fromCrossref(titleDoi);
        if (found) found.url = 'https://doi.org/' + titleDoi;
        return found;
    }
    if (!found && /\.pdf(\?|$)/i.test(link)) found = { pdfUrl: link };

    // a bare DOI or arXiv id still deserves a clickable link
    if (found && !/^https?:\/\//i.test(link)) {
        found.url = arxiv ? `https://arxiv.org/abs/${arxiv}` : doi ? 'https://doi.org/' + doi : '';
    }
    return found;
}

async function fromOpenAlex(doi) {
    const res = await fetch('https://api.openalex.org/works/https://doi.org/' + encodeURI(doi));
    if (!res.ok) return null;
    const work = await res.json();
    return {
        title: work.title || work.display_name || '',
        kind: OPENALEX_KINDS[work.type] || 'other',
        published: work.publication_date || String(work.publication_year || ''),
        venue: work.primary_location?.source?.display_name || '',
        authors: (work.authorships || []).map(a => ({
            ...splitName(a.author?.display_name || a.raw_author_name || ''),
            affiliation: a.institutions?.[0]?.display_name || '',
        })),
        doi: (work.doi || '').replace(/^https?:\/\/doi\.org\//i, '') || doi,
        pdfUrl: work.best_oa_location?.pdf_url || work.locations?.find(l => l.pdf_url)?.pdf_url || '',
        keywords: (work.keywords || []).map(k => k.display_name).slice(0, 8),
        abstract: abstractFromIndex(work.abstract_inverted_index),
    };
}

async function fromCrossref(doi) {
    const res = await fetch('https://api.crossref.org/works/' + encodeURIComponent(doi));
    if (!res.ok) return null;
    const work = (await res.json()).message;
    return {
        title: work.title?.[0] || '',
        kind: CROSSREF_KINDS[work.type] || 'other',
        published: (work.issued?.['date-parts']?.[0] || []).map(n => String(n).padStart(2, '0')).join('-'),
        venue: work['container-title']?.[0] || work.publisher || '',
        authors: (work.author || []).map(a => ({
            firstName: a.given || '',
            lastName: a.family || a.name || '',
            affiliation: a.affiliation?.[0]?.name || '',
        })),
        doi: work.DOI || doi,
        keywords: (work.subject || []).slice(0, 8),
        abstract: (work.abstract || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    };
}

async function fromDataCite(doi) {
    const res = await fetch('https://api.datacite.org/dois/' + encodeURIComponent(doi));
    if (!res.ok) return null;
    const work = (await res.json()).data.attributes;
    const firstVersion = work.dates?.find(d => d.dateType === 'Submitted')?.date;
    const type = (work.types?.resourceTypeGeneral || '').toLowerCase();
    return {
        title: work.titles?.[0]?.title || '',
        kind: { preprint: 'article', journalarticle: 'article', book: 'book', bookchapter: 'chapter', dissertation: 'thesis', report: 'report' }[type] || 'other',
        published: firstVersion ? firstVersion.slice(0, 10) : String(work.publicationYear || ''),
        venue: typeof work.publisher === 'string' ? work.publisher : work.publisher?.name || '',
        authors: (work.creators || []).map(c => ({
            firstName: c.givenName || '',
            lastName: c.familyName || c.name || '',
            affiliation: c.affiliation?.[0]?.name ?? c.affiliation?.[0] ?? '',
        })),
        doi: work.doi || doi,
        keywords: (work.subjects || []).filter(s => !/^FOS:/.test(s.subject)).map(s => s.subject).slice(0, 8),
        abstract: work.descriptions?.find(d => d.descriptionType === 'Abstract')?.description
            || work.descriptions?.[0]?.description || '',
    };
}

// OpenAlex stores abstracts as { word: [positions] }
function abstractFromIndex(index) {
    if (!index) return '';
    const words = [];
    for (const [word, positions] of Object.entries(index)) {
        for (const p of positions) words[p] = word;
    }
    return words.filter(Boolean).join(' ');
}

// ---- add / edit source form (lives in the page's #modals) ----

const SourceForm = (() => {
    const form = el('form', 'source_form modal');
    form.hidden = true;
    form.innerHTML = `
        <h2></h2>
        <label>Link, DOI, arXiv id or title
            <span class="lookup_row">
                <input name="url" placeholder="Paste a link, DOI, title or reference">
                <button type="button" class="btn lookup">Look up</button>
            </span>
        </label>
        <!-- or the file itself: a PDF is read for its DOI or title (to fill the details) and kept to read here;
             a Word, text or Markdown document becomes its readable text -->
        <div class="upload_row">
            <span>or</span>
            <label class="btn small upload_btn">Upload a PDF or document
                <input type="file" name="upload" hidden
                    accept="application/pdf,.pdf,.docx,.txt,.md,.markdown,text/plain,text/markdown">
            </label>
            <small class="upload_name"></small>
        </div>
        <p class="lookup_status" aria-live="polite"></p>
        <label>Title <input name="title" required></label>
        <div class="form_row">
            <label>Type <select name="kind"></select></label>
            <label>Published <input name="published" placeholder="2024 or 2024-06-05"></label>
        </div>
        <label>Journal / publisher <input name="venue"></label>
        <label>Authors <textarea name="authors" rows="3" placeholder="One per line: First Last, Affiliation"></textarea></label>
        <div class="form_row">
            <label>DOI <input name="doi" placeholder="10.1234/abcd"></label>
            <label>PDF link <input name="pdfUrl" type="url" placeholder="Open-access PDF, if any"></label>
        </div>
        <div class="form_row">
            <label>Keywords <input name="keywords" placeholder="comma, separated"></label>
            <label>Your tags <input name="tags" placeholder="e.g. method, to cite, chapter 2"></label>
        </div>
        <label>Abstract <textarea name="abstract" rows="4"></textarea></label>
        <label>Status <select name="status"></select></label>
        ${Images.fieldHtml('Thumbnail', 'Image link, or leave blank for its first page')}
        <div class="actions">
            <button type="button" class="btn" data-close>Cancel</button>
            <button type="submit" class="btn primary">Save</button>
        </div>`;
    $('#modals').append(form);

    const f = form.elements;
    const status = $('.lookup_status', form);
    for (const [value, label] of Object.entries(KIND_LABELS)) f.kind.append(new Option(label, value));
    for (const [value, label] of Object.entries(STATUS_LABELS)) f.status.append(new Option(label, value));

    let editingId = null;
    let projectId = null;
    let onSaved = null;
    let upload = null; // { file } for a PDF, { text, name } for a document, until saved
    // its own thumbnail (a link or an uploaded image); without one it shows its first page (bookshelf.js)
    const thumbnail = Images.field($('.image_field', form));
    $('[data-close]', form).addEventListener('click', () => thumbnail.discard());

    // options: { projectId, onSaved(id) }
    function open(source, options) {
        ({ projectId, onSaved } = options);
        editingId = source?.id ?? null;
        form.reset();
        upload = null;
        $('.upload_name', form).textContent = '';
        status.textContent = '';
        $('h2', form).textContent = source ? 'Edit source' : 'New source';
        if (source) {
            fill(source);
            f.status.value = source.status || 'to_read';
        }
        thumbnail.set(source?.thumbnail || '');
        openModal(form);
        (source ? f.title : f.url).focus();
    }

    function fill(data) {
        for (const key of ['url', 'title', 'kind', 'published', 'venue', 'doi', 'pdfUrl', 'abstract']) {
            if (data[key] !== undefined) f[key].value = data[key] || '';
        }
        if (data.authors) f.authors.value = formatAuthors(data.authors);
        if (data.keywords) f.keywords.value = data.keywords.join(', ');
        if (data.tags) f.tags.value = data.tags.join(', ');
    }

    async function lookup() {
        const link = f.url.value.trim();
        if (!link) return f.url.focus();
        status.textContent = 'Looking up…';
        try {
            const found = await lookupMaterial(link);
            if (!found) {
                status.textContent = /ieeexplore\.ieee\.org/i.test(link)
                    ? "IEEE Xplore links don't include the paper's DOI: paste its DOI (shown on the page) or its title instead."
                    : "Couldn't find details for this. Try its DOI or exact title, or fill them in below.";
            } else if (!found.title) {
                fill(found);
                status.textContent = found.kind === 'video'
                    ? 'A video: give it a title below. You can watch it and take notes on its page.'
                    : 'No details found, but the PDF link was saved so you can read it in the app.';
            } else if (found.kind === 'video') {
                fill(found);
                status.textContent = 'Video details filled in. You can watch it and take timed notes on its page.';
            } else {
                fill(found);
                if (!/^https?:\/\//i.test(link) && found.url) f.url.value = found.url; // a title becomes its DOI link
                status.textContent = found.pdfUrl
                    ? 'Details filled in. A free PDF was found, so you can read it in the app.'
                    : 'Details filled in. Its page will look for a free copy (arXiv, open access), or help you bring the PDF.';
            }
        } catch {
            status.textContent = "Couldn't reach the lookup service. Check your connection, or fill the details in yourself.";
        }
    }

    // ---- an uploaded file ----

    async function readUpload(file) {
        upload = null;
        $('.upload_name', form).textContent = file.name;
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        if (!isPdf && !Documents.accepts(file)) {
            status.textContent = 'Choose a PDF, a Word document (.docx), or a text or Markdown file.';
            return;
        }
        status.textContent = 'Reading the file…';
        try {
            if (!isPdf) {
                const text = await Documents.text(file);
                upload = { text, name: file.name };
                if (!f.title.value.trim()) f.title.value = (text.split('\n').find(l => l.trim()) || file.name).replace(/^#+\s*/, '').slice(0, 200);
                status.textContent = `Its text (${text.split(/\s+/).filter(Boolean).length.toLocaleString()} words) will be readable on its page. Check the details below.`;
                return;
            }
            upload = { file };
            const pdf = await pdfDetails(file);
            // a DOI or arXiv id in the paper: the full details; else its title
            const found = (pdf.doi || pdf.arxiv) ? await lookupMaterial(pdf.arxiv ? 'arXiv:' + pdf.arxiv : pdf.doi).catch(() => null)
                : pdf.title ? await lookupMaterial(pdf.title).catch(() => null) : null;
            if (found?.title) {
                // the catalogue's details; what it lacks (often the abstract or keywords) from the PDF
                fill({
                    ...found,
                    pdfUrl: found.pdfUrl || '',
                    abstract: found.abstract || pdf.abstract,
                    keywords: found.keywords?.length ? found.keywords : pdf.keywords,
                    venue: found.venue || pdf.venue,
                });
                status.textContent = 'Details found from the PDF. It\'s kept here, so you can read and annotate it.';
            } else {
                fill(pdf);
                if (pdf.doi) f.doi.value = pdf.doi;
                const got = ['title', 'authors', 'abstract', 'keywords', 'published', 'venue'].filter(k => (Array.isArray(pdf[k]) ? pdf[k].length : pdf[k]));
                status.textContent = got.length > 1
                    ? `Not found online, so the details were read from the PDF itself (${got.join(', ')}): check them below.`
                    : 'The PDF is kept to read here. Its details weren\'t found online: check them below.';
            }
        } catch (err) {
            status.textContent = `Couldn't read this file (${err.message}).`;
        }
    }

    f.upload.addEventListener('change', () => {
        const file = f.upload.files[0];
        if (file) readUpload(file);
    });

    $('.lookup', form).onclick = lookup;
    f.url.addEventListener('change', () => { if (!f.title.value.trim()) lookup(); });
    f.url.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); lookup(); }
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        // the uploaded file: a PDF is kept (replacing an earlier one), a document's text becomes the text
        const extra = {};
        if (upload?.file) {
            try {
                const assetId = await Store.putAsset(upload.file);
                const old = editingId && Store.getItem(editingId)?.file?.assetId;
                if (old) Store.deleteAsset(old);
                extra.file = { assetId, name: upload.file.name, size: upload.file.size, mime: upload.file.type || 'application/pdf' };
                extra.text = '';
            } catch {
                return alert("Couldn't keep the file in this browser (private window or storage full?).");
            }
        } else if (upload?.text) {
            extra.text = upload.text;
        }
        const id = Store.saveItem({
            ...extra,
            id: editingId,
            projectId,
            type: 'source',
            url: f.url.value.trim(),
            title: f.title.value.trim(),
            kind: f.kind.value,
            published: f.published.value.trim(),
            venue: f.venue.value.trim(),
            authors: parseAuthors(f.authors.value),
            doi: f.doi.value.trim(),
            pdfUrl: f.pdfUrl.value.trim(),
            keywords: f.keywords.value.split(',').map(k => k.trim()).filter(Boolean),
            tags: [...new Set(f.tags.value.split(',').map(t => t.trim()).filter(Boolean))],
            abstract: f.abstract.value.trim(),
            status: f.status.value,
            thumbnail: thumbnail.value,
        });
        thumbnail.commit();
        closeModals();
        onSaved?.(id);
    });

    return { open };
})();

// ---- a title → its DOI (OpenAlex search, checked word by word so a near miss isn't taken) ----

const titleWords = text => (text || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(w => w.length > 2);

// the share of a's words that are in b
function wordOverlap(a, b) {
    const words = titleWords(a);
    const other = new Set(titleWords(b));
    return words.length ? words.filter(w => other.has(w)).length / words.length : 0;
}

async function findDoiByTitle(text) {
    const res = await fetch('https://api.openalex.org/works?per-page=5&search=' + encodeURIComponent(text.slice(0, 300)));
    if (!res.ok) return null;
    // the found title's words must all be in what you typed (a reference has more words than its title)
    const hit = ((await res.json()).results || []).find(w => w.doi && wordOverlap(w.title, text) >= 0.9 && wordOverlap(text, w.title) >= (text.length > 200 ? 0.2 : 0.75));
    return hit?.doi.replace(/^https?:\/\/doi\.org\//i, '') || null;
}

// ---- readable copies of a paper published elsewhere (IEEE, ACM, Springer…) ----
// Publishers rarely let another site download their PDFs (or they're behind a paywall), so look for:
// - an arXiv version (OpenAlex locations, Semantic Scholar): read in the app like any arXiv paper
// - open-access PDFs (university repositories, author copies) — downloadable here only if the site allows it
// - pages to open in a new tab: the publisher (where a library login may give access) and repositories
// Resolves to { arxiv, pdfs: [{ url, label }], pages: [{ url, label }] }.
async function findCopies(source) {
    const copies = { arxiv: '', pdfs: [], pages: [] };
    let doi = source.doi || findDoi(source.url || '') || '';
    if (/^10\.48550\/arxiv/i.test(doi)) doi = '';
    const addPdf = (url, label) => { if (url && !copies.pdfs.some(p => p.url === url)) copies.pdfs.push({ url, label }); };
    const addPage = (url, label) => { if (url && !copies.pages.some(p => p.url === url)) copies.pages.push({ url, label }); };

    if (!doi && source.title) doi = await findDoiByTitle(source.title).catch(() => null) || '';
    if (doi) {
        const [openalex, s2] = await Promise.all([
            fetch('https://api.openalex.org/works/https://doi.org/' + encodeURI(doi)).then(r => (r.ok ? r.json() : null)).catch(() => null),
            fetch(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=externalIds,openAccessPdf`)
                .then(r => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        const publisher = openalex?.primary_location?.source?.host_organization_name || openalex?.primary_location?.source?.display_name || 'the publisher';
        addPage('https://doi.org/' + doi, `Publisher's page (${publisher})`);
        for (const loc of openalex?.locations || []) {
            const name = loc.source?.display_name || new URL(loc.landing_page_url || loc.pdf_url || 'https://x').hostname;
            const arxiv = findArxivId(loc.landing_page_url || '') || findArxivId(loc.pdf_url || '');
            if (arxiv) { copies.arxiv ||= arxiv; continue; }
            if (loc.is_oa && loc.pdf_url) addPdf(loc.pdf_url, `${name}${loc.version === 'publishedVersion' ? '' : ' (author\'s version)'}`);
            if (loc.landing_page_url && !/doi\.org\//.test(loc.landing_page_url)) addPage(loc.landing_page_url, name);
        }
        if (s2?.externalIds?.ArXiv) copies.arxiv ||= s2.externalIds.ArXiv;
        const s2Pdf = s2?.openAccessPdf?.url;
        if (s2Pdf) (/\.pdf($|\?)/i.test(s2Pdf) ? addPdf : addPage)(s2Pdf, 'Open-access copy (Semantic Scholar)');
    }
    // the preprint is often its own record in OpenAlex: search arXiv's records for the same title
    // (also covers Semantic Scholar refusing pages opened as a file)
    if (!copies.arxiv && source.title) copies.arxiv = await findArxivByTitle(source.title).catch(() => '') || '';
    return copies;
}

const OPENALEX_ARXIV = 'S4306400194'; // arXiv's id in OpenAlex

async function findArxivByTitle(title) {
    const res = await fetch(`https://api.openalex.org/works?per-page=5&filter=locations.source.id:${OPENALEX_ARXIV}&search=` + encodeURIComponent(title.slice(0, 300)));
    if (!res.ok) return '';
    const hit = ((await res.json()).results || []).find(w => wordOverlap(w.title, title) >= 0.9 && wordOverlap(title, w.title) >= 0.9);
    const urls = [hit?.doi, ...(hit?.locations || []).flatMap(l => [l.landing_page_url, l.pdf_url])].filter(Boolean);
    return urls.map(u => findArxivId(u) || u.match(/10\.48550\/arxiv\.(\d{4}\.\d{4,5})/i)?.[1]).find(Boolean) || '';
}

// PDF.js, loaded the first time a page needs it (most pages that add sources don't otherwise)
const PDFJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfJsLoad = null;
function ensurePdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    pdfJsLoad ??= new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PDFJS_BASE + 'pdf.min.js';
        script.onload = () => {
            pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
            resolve(pdfjsLib);
        };
        script.onerror = () => {
            pdfJsLoad = null;
            reject(new Error('the PDF reader did not load (offline?)'));
        };
        document.head.append(script);
    });
    return pdfJsLoad;
}

// ---- what a PDF says about itself ----
// For when a paper isn't found online (or to fill what the catalogue lacks): the PDF's own properties and its
// first page. Title: the biggest text near the top (or the PDF's title property when it's a real one).
// Authors: the lines under the title, before affiliations, e-mails and the abstract. Abstract: from "Abstract"
// (or IEEE's "Abstract—") to the keywords or the introduction. Keywords: "Keywords:" / "Index Terms—".
// Year and venue: a conference or journal line in the header or footer, a © line, or the file's date.
// Resolves to { title, authors: [{ firstName, lastName }], abstract, keywords: [], published, venue, doi, arxiv }.
async function pdfDetails(blob) {
    const pdfjs = await ensurePdfJs();
    const pdf = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
    try {
        const info = (await pdf.getMetadata().catch(() => null))?.info || {};
        const pages = [];
        let rawText = '';
        for (let n = 1; n <= Math.min(2, pdf.numPages); n++) {
            const page = await pdf.getPage(n);
            const { height } = page.getViewport({ scale: 1 });
            const { items } = await page.getTextContent();
            rawText += ' ' + items.map(i => i.str).join(' ');
            pages.push(pdfLinesOf(items, height));
        }
        const first = pages[0] || [];
        const text = pages.flat().map(l => l.text).join('\n');
        const body = first.filter(l => !l.margin);

        // title: the biggest text in the top part of page 1 (several lines if it wraps)
        const top = body.filter(l => l.top < 0.45 && l.text.length > 3 && !/^(arxiv|preprint|accepted|published|proceedings|journal)/i.test(l.text));
        const biggest = Math.max(0, ...top.map(l => l.size));
        const titleLines = top.filter(l => l.size >= biggest * 0.92);
        const ownTitle = (info.Title || '').trim();
        const flat = t => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const goodOwn = ownTitle.length > 8 && flat(text).includes(flat(ownTitle)); // not a file name or a template's placeholder
        const title = (goodOwn ? ownTitle : titleLines.map(l => l.text).join(' ')).replace(/\s+/g, ' ').trim().slice(0, 300);

        // authors: the lines between the title and the abstract (names, affiliations, places, e-mails, in rows
        // or side-by-side columns); the names are picked out of them (authorsFromLines)
        const afterTitle = body.slice(body.indexOf(titleLines.at(-1)) + 1);
        const authorLines = [];
        for (const line of afterTitle) {
            if (/^(abstract|a\s*b\s*s\s*t\s*r\s*a\s*c\s*t|keywords|index terms)\b/i.test(line.text)) break;
            if (/^((\d+|[IVX]+)\.?\s+)?introduction\b/i.test(line.text)) break;
            if (line.text.length > 160 && /[.!?]$/.test(line.text)) break; // running text: the paper has begun
            authorLines.push(line.cells);
            if (authorLines.length >= 14) break;
        }
        let authors = authorsFromLines(authorLines);
        // the PDF's own author list (LaTeX papers often have one) when the page gave fewer names
        const listed = info.Author ? authorsFromLines([info.Author.replace(/\s+and\s+|;/g, ',')]) : [];
        if (listed.length > authors.length) authors = listed;

        // abstract: from its heading to the keywords or the introduction
        const lines = pages.flat().filter(l => !l.margin).map(l => l.text);
        const at = lines.findIndex(t => /^(abstract|a\s*b\s*s\s*t\s*r\s*a\s*c\s*t)\b/i.test(t));
        let abstract = '';
        if (at >= 0) {
            const parts = [lines[at].replace(/^(abstract|a\s*b\s*s\s*t\s*r\s*a\s*c\s*t)\s*[—–:.\-]?\s*/i, '')];
            for (const t of lines.slice(at + 1)) {
                if (/^((\d+|[IVX]+)\.?\s+)?(introduction|background|related work)\b|^(keywords|key words|index terms|ccs concepts|acm reference)\b/i.test(t)) break;
                parts.push(t);
                if (parts.join(' ').length > 3000) break;
            }
            abstract = parts.join(' ').replace(/(\w)-\s+(\w)/g, '$1$2').replace(/\s+/g, ' ').trim();
        } else if (info.Subject && info.Subject.length > 120) {
            abstract = info.Subject.trim();
        }

        // keywords
        const kwAt = lines.findIndex(t => /^(keywords|key words|index terms)\b/i.test(t));
        let kwLine = info.Keywords || '';
        if (kwAt >= 0) {
            kwLine = lines[kwAt].replace(/^(keywords|key words|index terms)\s*[—–:.\-]?\s*/i, '');
            for (const t of lines.slice(kwAt + 1, kwAt + 4)) {
                // the list carries on when the line above ended mid-list or this one starts in lower case
                if (!(kwLine === '' || /[,;·•]\s*$/.test(kwLine) || /^\p{Ll}/u.test(t))) break;
                kwLine += ' ' + t;
            }
        }
        const keywords = kwLine.replace(/\s+/g, ' ').split(/\s*[;,·•]\s*/).map(k => k.replace(/\.$/, '').trim()).filter(k => k && k.length < 60).slice(0, 12);

        // venue and year: a header/footer line naming a conference or journal
        const margins = first.filter(l => l.margin || l.top > 0.85).map(l => l.text);
        const venueLine = [...margins, ...body.slice(0, 4).map(l => l.text)]
            .find(t => /proceedings|conference|journal|transactions|letters|workshop|symposium|\bieee\b|\bacm\b|springer|elsevier|neurips|icml|iclr|cvpr|iccv|eccv|icra|iros|aaai|ijcai|acl|emnlp/i.test(t) && t.length < 200) || '';
        const venue = venueLine
            .replace(/^©\s*(?:(?:19|20)\d{2}\s*)?[^.]*\.\s*/, '')          // "© 2024 Association for Computing Machinery. "
            .replace(/^(published|accepted|appeared|to appear)\s+(in|at)\s+/i, '')
            .replace(/,?\s*(pp?\.|pages)\s*[\d–-]+.*$/i, '')
            .replace(/\s*[|©].*$/, '')                                      // "| Exampleton, UK", a © after it
            .replace(/[.,\s]+$/, '')
            .trim();
        const year = venueLine.match(/\b(19|20)\d{2}\b/)?.[0] || text.match(/©\s*((?:19|20)\d{2})/)?.[1]
            || (info.CreationDate || '').match(/^D:((?:19|20)\d{2})/)?.[1] || '';

        const doi = findDoi(rawText);
        return {
            title, authors, abstract, keywords, venue, published: year,
            doi: doi && !/^10\.48550/i.test(doi) ? doi : '',
            arxiv: rawText.match(/arxiv:\s*(\d{4}\.\d{4,5})/i)?.[1] || '',
        };
    } finally {
        pdf.destroy();
    }
}

// pdf.js text pieces → lines (top to bottom), each with its size, place on the page and whether it's in
// the top or bottom margin (running headers, footers, page numbers); sideways text (arXiv's stamp) is left out
function pdfLinesOf(items, pageHeight) {
    const pieces = items.filter(i => i.str?.trim() && Math.abs(i.transform[1]) < 0.01)
        .map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0, size: Math.abs(i.transform[3]) || 10 }))
        .sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const p of pieces) {
        const line = lines.at(-1);
        if (line && Math.abs(line.y - p.y) <= Math.max(2, p.size * 0.4)) {
            line.parts.push(p);
            line.size = Math.max(line.size, p.size);
        } else {
            lines.push({ y: p.y, size: p.size, parts: [p] });
        }
    }
    return lines.map(line => {
        const parts = line.parts.sort((a, b) => a.x - b.x);
        // side-by-side columns (author blocks): a wide gap is kept as a tab in `cells`
        const cells = parts.reduce((out, p, i) => {
            const prev = parts[i - 1];
            if (prev && p.x - (prev.x + prev.w) > Math.max(prev.size, p.size) * 1.5) out.push('');
            out[out.length - 1] += (out[out.length - 1] ? ' ' : '') + p.str;
            return out;
        }, ['']).map(c => c.replace(/\s+/g, ' ').trim()).filter(Boolean);
        const text = cells.join(' ');
        const top = 1 - line.y / pageHeight;
        return { text, cells: cells.join('\t'), size: line.size, top, margin: top < 0.06 || top > 0.94 };
    });
}

// Names out of the lines under a title. Each line is split into its columns (tabs) and then at commas, "and",
// "&" and ";". What's left is a name when it looks like one: 2–5 words, capitalised (particles like "van der",
// "de la" allowed), no digits. Affiliations, places, e-mails, footnote marks and superscripts (Smith1,2 / Lee*)
// are dropped. Names in capitals are written normally (OLUWASEUN ADEYEMI → Oluwaseun Adeyemi).
const NAME_PARTICLES = new Set(['van', 'von', 'der', 'den', 'de', 'del', 'della', 'da', 'di', 'du', 'la', 'le', 'bin', 'binti', 'al', 'el', 'ter', 'ten', 'dos', 'das', 'y']);
const NOT_A_NAME = /\b(university|universit[äéà]|universidad|institut|institute|department|dept|school|college|faculty|laborator|lab|labs|center|centre|inc|ltd|llc|gmbh|corporation|company|research|group|hospital|academy|foundation|google|microsoft|meta|amazon|ibm|nvidia|deepmind|openai|abstract|introduction|keywords|correspond|equal contribution|contributed|email|e-mail)\b/i;

function authorsFromLines(lines) {
    const names = [];
    for (const line of lines) {
        for (const cell of String(line).split('\t')) {
            if (NOT_A_NAME.test(cell) || /\S@\S/.test(cell)) continue; // an affiliation or an e-mail
            const cleaned = cell
                .replace(/(\p{L})[\d*∗†‡§¶♯]+(?:,[\d*∗†‡§¶♯]+)*(?=\s|,|$)/gu, '$1')   // superscripts stuck to a name: Smith1,2 / Lee*
                .replace(/[∗*†‡§¶♯#]|\{[^}]*\}|\(\s*\d*\s*\)/g, ' ')
                .replace(/\b\d+\b/g, ' ');
            for (const part of cleaned.split(/\s*(?:,|;|\band\b|&)\s*/i)) {
                const words = part.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
                const main = words.filter(w => !NAME_PARTICLES.has(w.toLowerCase()));
                const looksLikeName = main.length >= 2 && main.length <= 5 && words.length <= 7
                    && main.every(w => /^\p{Lu}[\p{L}'’.-]*$/u.test(w))
                    && words.every(w => NAME_PARTICLES.has(w.toLowerCase()) || /^\p{Lu}/u.test(w))
                    && !/\d/.test(part);
                if (!looksLikeName) continue;
                // names in capitals: "OLUWASEUN ADEYEMI" → "Oluwaseun Adeyemi" (initials like "J." stay)
                const written = words.map(w => (w.length > 2 && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w));
                names.push(written);
            }
        }
    }
    const seen = new Set();
    return names.filter(w => !seen.has(w.join(' ')) && seen.add(w.join(' '))).slice(0, 40).map(words => {
        // the surname starts at its particles: "Lisa van der Berg" → Lisa / van der Berg
        const firstParticle = words.findIndex((w, i) => i > 0 && NAME_PARTICLES.has(w.toLowerCase()));
        const cut = firstParticle > 0 ? firstParticle : words.length - 1;
        return { firstName: words.slice(0, cut).join(' '), lastName: words.slice(cut).join(' '), affiliation: '' };
    });
}

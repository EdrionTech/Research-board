// Library: every material (papers, books, videos…), on bookshelves: the ones in your projects and the ones
// you added here, which belong to no project until you add them to one (sources/library.js).
// A material used in several projects is one book (matched by DOI, arXiv id or title). Shown as spines (many
// at a glance) or covers (the PDF's first page when the file is stored, else a printed cover), drawn by
// sources/bookshelf.js. A book opens its profile: abstract, the projects it's in, copy its citation, add it to a project.

const MODE_KEY = 'research_board_library_mode';
const GROUP_KEY = 'research_board_library_group';
const SORT_KEY = 'research_board_library_sort';

let books = [];
let projects = [];
const activeTags = new Set(); // the tag filter (lowercase): a book must have all of them
const authorFilter = AuthorFilter.create($('#author_filter'), () => render()); // by author: any of those chosen

const pref = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const keep = (key, value) => { try { localStorage.setItem(key, value); } catch { } };
const yearOf = Bookshelf.yearOf;

// ---- the books: one per material, across projects and the library ----

function load() {
    projects = Store.getProjects();
    books = Library.books();
}

const homeName = project => (project.library ? 'Library only' : project.title);

// a book's tags: those of every copy (each project tags its own copy), each spelling once, ignoring case
function bookTags(book) {
    const tags = new Map();
    for (const { source } of book.copies) for (const tag of tagsOf(source)) if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag);
    return [...tags.values()];
}
const bookHasTag = (book, tag) => bookTags(book).some(t => t.toLowerCase() === tag);

function shownBooks() {
    const query = $('#search').value.trim().toLowerCase();
    const sort = $('#shelf_sort').value;
    const list = books.filter(b => [...activeTags].every(tag => bookHasTag(b, tag)) && authorFilter.matches(b.source)
        && (!query || [b.source.title, authorsLine(b.source), b.source.venue, yearOf(b.source), ...bookTags(b), ...b.copies.map(c => c.project.title)]
            .join(' ').toLowerCase().includes(query)));
    const by = {
        recent: (a, b) => b.added - a.added,
        title: (a, b) => a.source.title.localeCompare(b.source.title),
        author: (a, b) => (a.source.authors?.[0]?.lastName || '~').localeCompare(b.source.authors?.[0]?.lastName || '~'),
        year: (a, b) => (yearOf(b.source) || '0').localeCompare(yearOf(a.source) || '0'),
    }[sort];
    return list.sort(by);
}

// the shelves: [{ label, books }]
function shelves(list) {
    const group = $('#shelf_group').value;
    if (group === 'all') return [{ label: '', books: list }];
    if (group === 'kind') {
        const kinds = [...new Set(list.map(b => b.source.kind || 'other'))];
        return kinds.map(kind => ({ label: KIND_LABELS[kind] || 'Other', books: list.filter(b => (b.source.kind || 'other') === kind) }));
    }
    return [
        // added here and not in a project yet
        { label: 'Not in a project yet', books: list.filter(b => b.copies.every(c => c.project.library)) },
        ...projects.map(p => ({ label: p.title, href: 'project_dashboard.html?id=' + encodeURIComponent(p.id) + '#literature', books: list.filter(b => Library.inProject(b, p.id)) })),
    ].filter(s => s.books.length);
}

// ---- drawing ----

// the tag chips: every tag in the library with how many books have it, most first; the chip shows the most used spelling
function renderTagFilter() {
    const counts = new Map(); // lowercase tag -> { n, spellings }
    for (const book of books) {
        for (const tag of bookTags(book)) {
            const entry = counts.get(tag.toLowerCase()) || { n: 0, spellings: new Map() };
            entry.n++;
            entry.spellings.set(tag, (entry.spellings.get(tag) || 0) + 1);
            counts.set(tag.toLowerCase(), entry);
        }
    }
    for (const tag of activeTags) if (!counts.has(tag)) activeTags.delete(tag);
    const label = entry => [...entry.spellings].sort((a, b) => b[1] - a[1])[0][0];
    // most papers first (then A to Z)
    const chips = [...counts].map(([key, entry]) => [key, label(entry), entry.n]).sort((a, b) => b[2] - a[2] || a[1].localeCompare(b[1])).map(([key, text, n]) => {
        const chip = el('button', 'tag_chip' + (activeTags.has(key) ? ' active' : ''), `${text} ${n}`);
        chip.type = 'button';
        chip.dataset.tag = key;
        chip.setAttribute('aria-pressed', activeTags.has(key));
        return chip;
    });
    const clear = el('button', 'link', 'Clear');
    clear.type = 'button';
    clear.id = 'tag_clear';
    clear.hidden = !activeTags.size;
    fillFilterRow($('#tag_filter'), 'Tags', chips, [clear]);
}

function render() {
    const mode = $('#shelf_mode [aria-checked="true"]').dataset.mode;
    renderTagFilter();
    authorFilter.render(books.map(b => b.source));
    const list = shownBooks();
    $('#shelf_count').textContent = `${list.length} of ${books.length} material${books.length === 1 ? '' : 's'}`;
    $('#shelf_empty').hidden = list.length > 0;
    $('#shelf_empty').textContent = books.length
        ? `Nothing on the shelves matches ${activeTags.size && !$('#search').value.trim() ? 'the chosen tags' : 'your search'}.`
        : 'Your library is empty. Add papers, books or videos to a project (or here with + New material), and they show up on these shelves.';
    $('#book_shelf').className = 'book_shelf ' + mode;
    $('#book_shelf').replaceChildren(...shelves(list).map(shelf => {
        const section = el('section', 'shelf');
        if (shelf.label) {
            const head = el('h3', 'shelf_label');
            if (shelf.href) {
                const a = el('a', '', shelf.label);
                a.href = shelf.href;
                head.append(a);
            } else head.textContent = shelf.label;
            head.append(el('small', '', ` ${shelf.books.length}`));
            section.append(head);
        }
        const row = el('div', 'shelf_row');
        row.append(...shelf.books.map(book => (mode === 'spines' ? Bookshelf.spine(book.source, book.key) : cover(book))));
        section.append(row, el('div', 'shelf_row_base'));
        return section;
    }));
    if (mode === 'covers') Bookshelf.drawCovers($('#book_shelf'));
    // continue reading: of each book, the copy you read last
    Reading.renderRow($('#continue_row'), books.map(b => b.copies.map(c => c.source).filter(s => s.readingAt).sort((x, y) => y.readingAt.at - x.readingAt.at)[0]).filter(Boolean));
}

// a cover, with the projects it's in under it
function cover(book) {
    const homes = book.copies.filter(c => !c.project.library).length;
    return Bookshelf.cover(book.source, book.key, [shortCitation(book.source), homes > 1 ? `in ${homes} projects` : homes ? '' : 'not in a project'].filter(Boolean).join(' · '));
}

// ---- a book's profile ----

let profileBook = null;

function openProfile(key) {
    const book = books.find(b => b.key === key);
    if (!book) return;
    profileBook = book;
    const s = book.source;
    $('#book_meta').textContent = [videoInfo(s) ? 'Video' : KIND_LABELS[s.kind] || 'Source', yearOf(s), s.venue].filter(Boolean).join(' · ');
    $('#book_title').textContent = s.title;
    $('#book_authors').textContent = authorsLine(s) || 'No authors added';
    const links = $('#book_links');
    links.replaceChildren();
    if (s.doi) links.append(externalLink('https://doi.org/' + s.doi, 'DOI: ' + s.doi));
    if (s.url) links.append(externalLink(s.url, 'Its link'));
    if (s.pdfUrl) links.append(externalLink(s.pdfUrl, 'PDF'));
    $('#book_abstract_box').hidden = !s.abstract;
    if (s.abstract) renderMarkdown($('#book_abstract'), s.abstract);
    // long author lists and abstracts fold, a good part still showing
    foldLong($('#book_authors'), 2, { more: 'Show all authors', less: 'Fewer authors' });
    foldLong($('#book_abstract'), 8);

    // its cover, large
    const box = $('#book_cover');
    box.replaceChildren();
    box.style.setProperty('--book', Bookshelf.color(book.key));
    Bookshelf.preview(s).then(url => {
        if (!url || profileBook !== book) return;
        const img = el('img');
        img.alt = '';
        img.src = url;
        box.replaceChildren(img);
    });
    box.append(el('strong', '', s.title));

    // the projects it's in: open it there, with your status and notes count
    $('#book_projects').replaceChildren(...book.copies.map(({ source, project }) => {
        const li = el('li');
        const a = el('a', '', homeName(project));
        a.href = 'material.html?id=' + encodeURIComponent(source.id);
        const notes = Store.getItems(project.id).filter(i => i.type === 'source_note' && i.sourceId === source.id).length;
        li.append(a, el('span', 'badge ' + (source.status || 'to_read'), STATUS_LABELS[source.status || 'to_read']),
            el('small', '', notes ? `${notes} note${notes === 1 ? '' : 's'}` : ''));
        return li;
    }));
    $('#book_open').href = 'material.html?id=' + encodeURIComponent(book.copies[0].source.id);

    // add it to a project it isn't in yet
    const others = projects.filter(p => !Library.inProject(book, p.id));
    $('#book_add_to').hidden = !others.length;
    $('#book_add_project').replaceChildren(new Option(book.copies.some(c => !c.project.library) ? 'another project…' : 'a project…', ''), ...others.map(p => new Option(p.title, p.id)));
    openModal($('#book_profile'));
}

// on its own in the library: it moves into the project (with your notes); else the project gets a copy
async function addToProject(projectId) {
    const from = profileBook.copies.find(c => c.project.library)?.source || profileBook.source;
    await Library.addToProject(from, projectId);
    load();
    render();
    const book = books.find(b => b.key === profileBook.key);
    if (book) openProfile(book.key);
    $('#book_copy').textContent = `Added to ${projects.find(p => p.id === projectId).title} ✓`;
    setTimeout(() => { $('#book_copy').textContent = 'Copy citation'; }, 2000);
}

// ---- + New material: into the library, on its own (the same form as a project's "+ Source") ----

function openNewMaterial() {
    SourceForm.open(null, { projectId: Store.LIBRARY_ID, onSaved: id => { location.href = 'material.html?id=' + encodeURIComponent(id); } });
}

// ---- Find papers: by subject, or by a title, reference or DOI; added to the library (sources/paper_search.js) ----

$('#find_papers').onclick = () => PaperSearch.open({ projectId: Store.LIBRARY_ID, onAdded: () => render() });

// ---- events ----

$('#shelf_mode').addEventListener('click', e => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    for (const b of $$('#shelf_mode [data-mode]')) b.setAttribute('aria-checked', b === btn);
    keep(MODE_KEY, btn.dataset.mode);
    render();
});
$('#shelf_group').onchange = () => { keep(GROUP_KEY, $('#shelf_group').value); render(); };
$('#shelf_sort').onchange = () => { keep(SORT_KEY, $('#shelf_sort').value); render(); };
$('#search').oninput = render;
$('#tag_filter').addEventListener('click', e => {
    if (e.target.id === 'tag_clear') activeTags.clear();
    else {
        const chip = e.target.closest('.tag_chip');
        if (!chip) return;
        if (activeTags.has(chip.dataset.tag)) activeTags.delete(chip.dataset.tag);
        else activeTags.add(chip.dataset.tag);
    }
    render();
});
$('#book_shelf').addEventListener('click', e => {
    const book = e.target.closest('.book');
    if (book) openProfile(book.dataset.key);
});
$('#book_copy').onclick = async e => {
    const btn = e.currentTarget;
    const style = profileBook.copies[0].project.citeStyle || 'apa';
    const ok = await copyText(Cite.format(profileBook.source, style));
    btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
    setTimeout(() => { btn.textContent = 'Copy citation'; }, 1600);
};
$('#book_add_project').onchange = e => { if (e.target.value) addToProject(e.target.value); };
$('#new_material').onclick = openNewMaterial;
// changes made in another tab
window.addEventListener('storage', e => {
    if (e.key === 'research_board_items' || e.key === 'research_board_projects') {
        load();
        render();
    }
});

// start
Nav.backLink($('.bar .back'), '../index.html', 'Projects');
for (const b of $$('#shelf_mode [data-mode]')) b.setAttribute('aria-checked', b.dataset.mode === pref(MODE_KEY, 'spines'));
$('#shelf_group').value = pref(GROUP_KEY, 'project');
$('#shelf_sort').value = pref(SORT_KEY, 'recent');
load();
render();

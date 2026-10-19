// Bookshelf: materials drawn as books, on the Library page and a project's Literature tab.
// A spine (the title down the side) or a cover (the PDF's first page when the file is stored, else a printed
// cover). Each style dresses them in its own colours (--book-0 … --book-7) and its own shelf (style/bookshelf.css,
// themes/<style>, "library shelves"). Uses sources.js (KIND_LABELS, shortCitation, videoInfo, pdfFile, arxivIdOf, ensurePdfJs).
// Previews (a material's first page, small) are made once, from its stored PDF or its PDF link, and kept with
// it (source.preview = { from, image: 'asset:…' }), so new materials get one too without being opened first.

const Bookshelf = (() => {
    const COLORS = 8;
    const DAY = 24 * 60 * 60 * 1000;
    const previews = new Map(); // source id + what it's made from -> promise of an image URL (or null)
    let queue = Promise.resolve();

    const hash = text => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const yearOf = source => (source.published || '').match(/\d{4}/)?.[0] || '';
    // one of the style's book colours (so the shelves look like they belong to the style)
    const color = key => `var(--book-${hash(key) % COLORS})`;

    // a spine: the title down the side, the first author and year at the foot
    function spine(source, key) {
        const btn = el('button', 'book spine');
        btn.type = 'button';
        btn.dataset.key = key;
        btn.title = [source.title, shortCitation(source)].filter(Boolean).join(' — ');
        const h = hash(key);
        btn.style.setProperty('--book', color(key));
        btn.style.setProperty('--h', 150 + (h % 5) * 12 + 'px');                     // books aren't all one height
        btn.style.setProperty('--w', Math.min(54, 30 + Math.round(source.title.length / 6)) + 'px');
        btn.append(el('span', 'spine_title', source.title), el('span', 'spine_foot', [source.authors?.[0]?.lastName, yearOf(source)].filter(Boolean).join(' ')));
        if (videoInfo(source)) btn.classList.add('video');
        return btn;
    }

    // a cover, with its title and a line under it (`caption`)
    function cover(source, key, caption) {
        const btn = el('button', 'book cover');
        btn.type = 'button';
        btn.dataset.key = key;
        btn.title = source.title;
        btn.style.setProperty('--book', color(key));
        const face = el('div', 'cover_face');
        face.append(el('span', 'cover_kind', videoInfo(source) ? '▶ Video' : KIND_LABELS[source.kind] || 'Source'),
            el('strong', 'cover_title', source.title), el('span', 'cover_authors', shortCitation(source) || ''));
        if (canPreview(source)) face.dataset.source = source.id;
        const under = el('span', 'cover_caption');
        under.append(el('strong', '', source.title), el('small', '', caption || ''));
        btn.append(face, under);
        return btn;
    }

    // ---- previews ----

    // what a material's preview is made from: its stored PDF (or the link that copy came from), else its PDF link
    function previewFrom(source) {
        const file = pdfFile(source);
        if (file) return file.fromUrl || 'asset:' + file.assetId;
        if (source.pdfUrl) return source.pdfUrl;
        const arxiv = arxivIdOf(source);
        return arxiv ? 'https://arxiv.org/pdf/' + arxiv : '';
    }
    const youtube = source => (videoInfo(source)?.provider === 'youtube' ? videoInfo(source).id : '');
    const canPreview = source => !!(source.thumbnail || youtube(source) || previewFrom(source));

    // its preview's URL (null when it has none): its own thumbnail if it has one, else made the first time
    // it's asked for, then kept
    async function preview(source) {
        if (!source) return null;
        if (source.thumbnail) {
            const own = await Images.url(source.thumbnail);
            if (own) return own;
        }
        if (youtube(source)) return Promise.resolve(`https://i.ytimg.com/vi/${youtube(source)}/hqdefault.jpg`);
        const from = previewFrom(source);
        if (!from) return Promise.resolve(null);
        const key = source.id + ' ' + from;
        if (!previews.has(key)) previews.set(key, keptOrMade(source, from));
        return previews.get(key);
    }

    async function keptOrMade(source, from) {
        const kept = Store.getItem(source.id)?.preview || source.preview;
        if (kept?.from === from || (kept && source.file?.fromUrl === kept.from)) {
            const blob = kept.image && await Store.getAsset(kept.image.slice(6)).catch(() => null);
            if (blob) return URL.createObjectURL(blob);
            if (kept.failedAt && Date.now() - kept.failedAt < DAY) return null; // its link didn't work today
        }
        // one at a time: PDFs can be big
        const made = queue.then(() => make(source, from));
        queue = made.catch(() => null);
        return made;
    }

    async function make(source, from) {
        const keep = preview => { if (Store.getItem(source.id)) Store.saveItem({ id: source.id, preview }, { touch: false }); };
        try {
            let data;
            if (from.startsWith('asset:')) data = await (await Store.getAsset(from.slice(6)))?.arrayBuffer();
            else {
                const res = await fetch(from);
                if (!res.ok) throw new Error('download failed');
                data = await res.arrayBuffer();
            }
            if (!data) throw new Error('no file');
            const pdfjs = await ensurePdfJs();
            const pdf = await pdfjs.getDocument({ data }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 360 / page.getViewport({ scale: 1 }).width });
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            pdf.destroy();
            const image = await new Promise(done => canvas.toBlob(done, 'image/jpeg', 0.8));
            if (!image) throw new Error('not drawn');
            const old = Store.getItem(source.id)?.preview?.image;
            keep({ from, image: 'asset:' + await Store.putAsset(image) });
            if (old) Store.deleteAsset(old.slice(6));
            return URL.createObjectURL(image);
        } catch {
            keep({ from, failedAt: Date.now() }); // e.g. a publisher that won't let other sites download it
            return null;
        }
    }

    // previews drawn once they're on screen: `apply(element, url)` for each element with a data-source
    function whenVisible(elements, apply) {
        const observer = new IntersectionObserver(entries => {
            for (const { target, isIntersecting } of entries) {
                if (!isIntersecting) continue;
                observer.unobserve(target);
                preview(Store.getItem(target.dataset.source)).then(url => { if (url) apply(target, url); });
            }
        }, { rootMargin: '200px' });
        for (const element of elements) observer.observe(element);
    }

    // the covers' first pages
    function drawCovers(root = document) {
        whenVisible(root.querySelectorAll('.cover_face[data-source]'), (face, url) => {
            const img = el('img');
            img.alt = '';
            img.src = url;
            face.classList.add('has_image');
            face.prepend(img);
        });
    }

    return { hash, yearOf, color, spine, cover, drawCovers, canPreview, preview, whenVisible };
})();

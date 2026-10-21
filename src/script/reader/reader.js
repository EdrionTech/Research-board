// Gets a source's material ready for the reader on the material page:
//   arXiv HTML version -> a self-contained page for an iframe (looks like the paper)
//   PDF                -> pages drawn with PDF.js (src/vendor/pdfjs) plus the position of every text line
//   pasted text        -> numbered lines

const Reader = (() => {
    if (window.pdfjsLib) {
        // kept in the app (src/vendor), so PDFs open offline in the desktop and phone apps
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.js', document.currentScript.src).href;
    }

    // ---- arXiv HTML ----

    // Styles added inside the paper iframe for clickable paragraphs and note highlights.
    // body[data-mode] follows the note attach mode (block, sentence, phrase, word).
    const PAPER_CSS = `
        html { touch-action: pan-x pan-y; -webkit-text-size-adjust: 100%; } /* two fingers zoom the paper (zoom.js) */
        body { margin: 0; padding: 8px 24px 40px; background: #fff; box-sizing: border-box; width: auto; overflow-wrap: break-word; }
        .ltx_page_main, .ltx_page_content { max-width: 100%; box-sizing: border-box; }
        img, svg.ltx_picture, video { max-width: 100%; height: auto; }
        /* wide tables and equations scroll by themselves instead of pushing the whole paper sideways */
        table.ltx_tabular, table.ltx_equation, table.ltx_equationgroup {
            display: block; width: fit-content; max-width: 100%; overflow-x: auto; margin-inline: auto; }
        math[display="block"], figure.ltx_figure, figure.ltx_table { max-width: 100%; overflow-x: auto; }
        /* author names and footnotes have (minimum) widths in em: with bigger text they'd poke out */
        .ltx_note, .ltx_note_outer, .ltx_note_content, .ltx_creator, .ltx_personname, .ltx_contact, .ltx_author_notes {
            min-width: 0; max-width: 100%; box-sizing: border-box; }
        .ltx_p, .ltx_title, .ltx_note_content { overflow-wrap: anywhere; } /* long URLs and identifiers */
        /* all the authors share one row: on a narrow screen each got a sliver ("Po- / Heng / Chen"), so they wrap */
        .ltx_authors { flex-wrap: wrap; row-gap: 12px; }
        .ltx_authors > .ltx_creator { flex: 1 1 9em; }
        @media (max-width: 600px) { body { padding: 8px 12px 32px; } }
        .ltx_ERROR.undefined { display: none; } /* arXiv's marker for a macro it couldn't convert, e.g. \\dspfont */
        [data-anchor] { border-radius: 4px; transition: background .2s; }
        body[data-mode="block"] [data-anchor] { cursor: pointer; }
        body[data-mode="block"] [data-anchor]:hover { background: rgba(61, 90, 254, .06); }
        body[data-mode="sentence"] [data-anchor], body[data-mode="word"] [data-anchor] { cursor: pointer; }
        [data-anchor].noted { background: color-mix(in srgb, var(--note-color, #ffc800) 22%, transparent);
            box-shadow: -6px 0 0 var(--note-color, rgba(255, 170, 0, .8)); }
        [data-anchor].selected { outline: 2px solid #3d5afe; outline-offset: 3px; }
        [data-anchor].flash { animation: flash 1.4s ease-out; }
        [data-anchor].bookmarked { position: relative; }
        [data-anchor].bookmarked::before { content: ''; position: absolute; left: -22px; top: 2px; width: 10px; height: 16px;
            background: #e8590c; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%); } /* a bookmark (material_places.js) */
        body[data-mode="image"], body[data-mode="image"] [data-anchor] { cursor: crosshair; -webkit-user-select: none; user-select: none; }
        body[data-mode="image"] figure, body[data-mode="image"] img.ltx_graphics { touch-action: none; }
        .region { position: absolute; z-index: 4; pointer-events: none; border: 2px solid var(--note-color, rgba(255, 170, 0, .95));
            background: color-mix(in srgb, var(--note-color, #ffc800) 22%, transparent); border-radius: 3px; }
        .region.selected, .region.drawing { border: 2px dashed #3d5afe; background: rgba(61, 90, 254, .12); }
        img.flash { animation: pulse 1.4s ease-out; }
        .img_note_bar { position: absolute; z-index: 6; display: flex; gap: 4px; }
        .img_note_bar[hidden] { display: none; }
        .img_note_btn { border: none; border-radius: 999px; padding: 4px 10px;
            font: 600 12px/1.4 system-ui, sans-serif; background: #3d5afe; color: #fff; cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, .25); }
        .img_note_btn[data-act="save"] { background: #2e7d32; }
        @keyframes pulse { from { outline: 4px solid rgba(61, 90, 254, .8); } to { outline: 4px solid transparent; } }
        ::highlight(noted) { background-color: rgba(255, 200, 0, .45); }
        ::highlight(selected) { background-color: rgba(61, 90, 254, .3); }
        @keyframes flash { from { background: rgba(61, 90, 254, .35); } }`;

    const attr = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

    // Resolves to { srcdoc, url }, or throws if arXiv has no HTML version.
    async function arxivHtml(id) {
        const res = await fetch('https://arxiv.org/html/' + id);
        if (!res.ok) throw new Error('no HTML version');
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const article = doc.querySelector('article.ltx_document');
        if (!article) throw new Error('no HTML version');

        // keep only the paper: no scripts or inline handlers
        article.querySelectorAll('script, iframe, object, embed').forEach(node => node.remove());
        for (const node of article.querySelectorAll('*')) {
            for (const { name } of [...node.attributes]) if (name.startsWith('on')) node.removeAttribute(name);
        }
        const body = window.DOMPurify ? DOMPurify.sanitize(article.outerHTML) : article.outerHTML;
        const styles = [...doc.querySelectorAll('link[rel="stylesheet"]')]
            .map(link => new URL(link.getAttribute('href'), res.url).href);

        // <base> makes the paper's relative image links work; target opens links in a new tab
        const srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8">
            <base href="${attr(res.url)}" target="_blank">
            ${styles.map(href => `<link rel="stylesheet" href="${attr(href)}">`).join('')}
            <style>${PAPER_CSS}</style></head>
            <body><div class="ltx_page_main"><div class="ltx_page_content">${body}</div></div></body></html>`;
        return { srcdoc, url: res.url };
    }

    // ---- PDF ----

    // Downloads a PDF in one go (some sites refuse PDF.js's chunked requests),
    // reporting progress as onProgress(loadedBytes, totalBytes). Resolves to a Blob.
    async function download(url, onProgress) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`download failed (${res.status})`);
        const total = Number(res.headers.get('content-length')) || 0;
        const reader = res.body.getReader();
        const chunks = [];
        let loaded = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            onProgress?.(loaded, total);
        }
        return new Blob(chunks, { type: 'application/pdf' });
    }

    function openPdf(data) {
        if (!window.pdfjsLib) throw new Error('the PDF reader did not load (offline?)');
        return pdfjsLib.getDocument({ data }).promise;
    }

    // Page size plus its text lines, each with a box given as fractions of the page.
    // `content` and `viewport` are what renderTextLayer needs.
    async function pageLines(page) {
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        return { width: viewport.width, height: viewport.height, lines: groupLines(content.items, viewport), content, viewport };
    }

    // Invisible but selectable text laid exactly over the drawn page (PDF.js text layer),
    // so sentences, phrases and words can be picked. Sized by the --scale-factor CSS variable.
    function renderTextLayer(content, viewport, container) {
        return pdfjsLib.renderTextLayer({ textContentSource: content, container, viewport, textDivs: [] }).promise;
    }

    // Where pictures are drawn on the page, as boxes in fractions of the page. Follows the page's
    // drawing commands, tracking the current position/scale, and records each image painted.
    // (Charts drawn as lines rather than pictures are not found; drag a box over those.)
    async function pageImages(page) {
        const { OPS, Util } = pdfjsLib;
        const viewport = page.getViewport({ scale: 1 });
        const { fnArray, argsArray } = await page.getOperatorList();
        const paints = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject,
            OPS.paintImageXObjectRepeat, OPS.paintJpegXObject].filter(op => op !== undefined));
        const stack = [];
        let ctm = [1, 0, 0, 1, 0, 0];
        const boxes = [];
        fnArray.forEach((fn, i) => {
            const args = argsArray[i];
            if (fn === OPS.save) stack.push(ctm);
            else if (fn === OPS.restore) ctm = stack.pop() || ctm;
            else if (fn === OPS.transform) ctm = Util.transform(ctm, args);
            else if (fn === OPS.paintFormXObjectBegin) {
                stack.push(ctm);
                if (args?.[0]) ctm = Util.transform(ctm, args[0]);
            } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() || ctm;
            else if (paints.has(fn)) {
                // an image fills the unit square of the current transform
                const m = Util.transform(viewport.transform, ctm);
                const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(p => Util.applyTransform(p, m));
                const xs = corners.map(p => p[0]);
                const ys = corners.map(p => p[1]);
                const x = Math.max(0, Math.min(...xs) / viewport.width);
                const y = Math.max(0, Math.min(...ys) / viewport.height);
                const w = Math.min(1, Math.max(...xs) / viewport.width) - x;
                const h = Math.min(1, Math.max(...ys) / viewport.height) - y;
                if (w > 0.04 && h > 0.03) boxes.push({ x, y, w, h }); // skip icons and specks
            }
        });
        return mergeBoxes(boxes);
    }

    // Figures are often built from several touching or overlapping pictures: join them into one box.
    function mergeBoxes(boxes, gap = 0.012) {
        const near = (a, b) => a.x <= b.x + b.w + gap && b.x <= a.x + a.w + gap
            && a.y <= b.y + b.h + gap && b.y <= a.y + a.h + gap;
        const merged = [...boxes];
        for (let i = 0; i < merged.length; i++) {
            for (let j = i + 1; j < merged.length; j++) {
                if (!near(merged[i], merged[j])) continue;
                const a = merged[i];
                const b = merged.splice(j, 1)[0];
                const x = Math.min(a.x, b.x);
                const y = Math.min(a.y, b.y);
                merged[i] = { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
                j = i; // the grown box may now touch earlier ones: check again
            }
        }
        return merged;
    }

    // Draws the page sharp enough for `cssWidth` pixels on this screen (zoomed pages are wider).
    // Capped at about 16 million pixels a page: phones refuse bigger canvases.
    async function renderPage(page, canvas, cssWidth) {
        const base = page.getViewport({ scale: 1 });
        const wanted = (cssWidth || 800) * (window.devicePixelRatio || 1) / base.width;
        const scale = Math.min(wanted, Math.sqrt(16e6 / (base.width * base.height)));
        const viewport = page.getViewport({ scale });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }

    // PDF text arrives in fragments. Start a new line at an end-of-line marker, when the
    // baseline moves by more than about half a letter (so superscripts stay put), or at a
    // wide horizontal gap (the next column).
    function groupLines(fragments, viewport) {
        const lines = [];
        let current = null;
        let lastY = null;
        let lastEnd = null;

        const flush = () => {
            const text = current?.text.replace(/\s+/g, ' ').trim();
            // a "line" with no letters or digits is a stray maths accent or symbol
            if (text && /[\p{L}\p{N}]/u.test(text)) {
                lines.push({
                    text,
                    box: {
                        x: current.x0 / viewport.width,
                        y: current.y0 / viewport.height,
                        w: (current.x1 - current.x0) / viewport.width,
                        h: (current.y1 - current.y0) / viewport.height,
                    },
                });
            }
            current = null;
        };

        for (const fragment of fragments) {
            // skip non-text items and rotated text (e.g. arXiv's sideways stamp in the margin)
            if (!('str' in fragment) || Math.abs(fragment.transform[1]) > 0.01) continue;
            const [, , , , x, y] = fragment.transform;
            const size = fragment.height || 10;
            if (current && (Math.abs(y - lastY) > Math.max(2, size * 0.6) || x - lastEnd > size * 3)) flush();

            if (fragment.str.trim()) {
                // fragment box in page coordinates (origin top-left)
                const [, , , , vx, vy] = pdfjsLib.Util.transform(viewport.transform, fragment.transform);
                const top = vy - size * 0.9;
                const bottom = vy + size * 0.25;
                const right = vx + fragment.width;
                current ??= { text: '', x0: vx, y0: top, x1: right, y1: bottom };
                current.x0 = Math.min(current.x0, vx);
                current.y0 = Math.min(current.y0, top);
                current.x1 = Math.max(current.x1, right);
                current.y1 = Math.max(current.y1, bottom);
            }
            if (current) current.text += fragment.str;

            lastY = y;
            lastEnd = x + fragment.width;
            if (fragment.hasEOL) flush();
        }
        flush();
        return lines;
    }

    // ---- pasted text ----

    function textLines(text) {
        return text.split('\n').map(line => line.trim()).filter(Boolean).map(text => ({ text }));
    }

    return { arxivHtml, download, openPdf, pageLines, pageImages, renderPage, renderTextLayer, textLines };
})();

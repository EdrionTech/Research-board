// Markdown -> safe HTML for notes, summaries and abstracts.
// Uses marked + DOMPurify from the CDN; if they did not load (offline) the text is shown as-is.
// Images you add yourself are stored in the browser (Store assets) and written as ![name](asset:ID).

if (window.marked) marked.use({ breaks: true });

const assetUrls = new Map(); // asset id -> object URL, reused while the page is open

function renderMarkdown(el, text, placeholder = '') {
    if (!text) {
        el.innerHTML = '';
        if (placeholder) {
            const p = document.createElement('p');
            p.className = 'placeholder';
            p.textContent = placeholder;
            el.append(p);
        }
        return;
    }
    if (window.marked && window.DOMPurify) {
        // asset: links are not a web address, so pass them through as #asset-ID and load them below
        const prepared = text.replace(/\]\(asset:([a-z0-9]+)\)/gi, '](#asset-$1)');
        el.innerHTML = DOMPurify.sanitize(marked.parse(prepared));
        for (const a of el.querySelectorAll('a')) {
            a.target = '_blank';
            a.rel = 'noopener';
        }
        loadAssetImages(el);
    } else {
        el.textContent = text;
        el.style.whiteSpace = 'pre-wrap';
    }
}

// Fills in <img src="#asset-ID"> with the stored image.
async function loadAssetImages(el) {
    // mark them all first (data-asset says which stored image it is), then load each
    const images = [...el.querySelectorAll('img[src^="#asset-"]')];
    for (const img of images) {
        img.dataset.asset = img.getAttribute('src').slice('#asset-'.length);
        img.removeAttribute('src');
    }
    for (const img of images) {
        const id = img.dataset.asset;
        let url = assetUrls.get(id);
        if (!url && typeof Store !== 'undefined') {
            const blob = await Store.getAsset(id).catch(() => null);
            if (blob) {
                url = URL.createObjectURL(blob);
                assetUrls.set(id, url);
            }
        }
        if (url) img.src = url;
        else img.alt = '(image missing)';
    }
}

// Small DOM helpers and popup handling shared by the dashboard and material pages.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// Link that opens in a new tab; only http(s) addresses become clickable.
function externalLink(href, text) {
    const a = el('a', '', text);
    if (/^https?:\/\//i.test(href)) a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
}

// Copies text to the clipboard; resolves to true if it worked.
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // older browsers / insecure pages
        const area = el('textarea');
        area.value = text;
        area.style.cssText = 'position:fixed;opacity:0';
        document.body.append(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        return ok;
    }
}

// Saves text as a file in the viewer's downloads. In the apps there's no browser to do it: the desktop app puts it
// in Downloads, the phone app in Documents/Research Board (boot.js), and a message says where.
function downloadText(filename, text, type = 'text/plain') {
    if (window.RB_SERVER?.save) {
        const tell = message => (typeof toast === 'function' ? toast(message) : alert(message)); // (toast: the material page)
        window.RB_SERVER.save(filename, text).then(
            where => tell(`Saved to ${where}`),
            err => tell(`Couldn't save ${filename}: ${err?.message || err}`));
        return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
    const a = el('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- layout: things that stick under the top bar need its height ----
// --bar-h is the sticky top bar's height, or 0 on small screens where it scrolls away.

function measureTopBar() {
    const bar = $('.bar');
    if (!bar) return;
    const sticky = getComputedStyle(bar).position === 'sticky';
    document.documentElement.style.setProperty('--bar-h', (sticky ? bar.offsetHeight : 0) + 'px');
}
if ($('.bar')) {
    new ResizeObserver(measureTopBar).observe($('.bar'));
    addEventListener('resize', measureTopBar);
}

// phones and tablets: notes open as a bottom sheet, the note box sits at the bottom, etc.
const smallScreen = matchMedia('(max-width: 900px)');
// phones: toolbars show icons only, dropdowns open as sheets
const phoneScreen = matchMedia('(max-width: 700px)');

// A dropdown (the contents, bookmarks…) on a phone opens as a sheet at the bottom of the screen. While open it's
// moved to the end of the page, so the toolbar it belongs to (a swipeable row, or blurred by a style) can't clip
// it; it goes back when closed. Call it each time the dropdown opens or closes.
function sheetOnPhone(drop, open) {
    if (open && phoneScreen.matches) {
        drop.rbHome ??= drop.parentElement;
        document.body.append(drop);
        drop.classList.add('sheet');
    } else if (!open && drop.rbHome) {
        drop.rbHome.append(drop);
        drop.classList.remove('sheet');
    }
}

// ---- popups: every .modal sits inside #modals and one shows at a time ----

function openModal(modal) {
    const modals = $('#modals');
    modals.hidden = false;
    for (const m of $$('.modal', modals)) m.hidden = m !== modal;
}

function closeModals() {
    $('#modals').hidden = true;
}

document.addEventListener('click', e => {
    const modals = $('#modals');
    if (modals && !modals.hidden && (e.target === modals || e.target.closest('[data-close]'))) closeModals();
});

document.addEventListener('keydown', e => {
    const modals = $('#modals');
    if (e.key === 'Escape' && modals && !modals.hidden) closeModals();
});

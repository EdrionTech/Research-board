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

// A toolbar's dropdown: a sheet along the bottom on phones; elsewhere lifted out into the page and pinned under its
// button, inside the screen. (Left in the toolbar, the toolbar's own glass shows through it, and it can be cut off.)
// Its button is the first one in the dropdown's home (the element it sits in until it opens).
function dropDown(drop, open) {
    if (phoneScreen.matches || drop.classList.contains('sheet')) return sheetOnPhone(drop, open);
    drop.rbHome ??= drop.parentElement;
    if (!open) {
        if (!drop.classList.contains('floating')) return;
        drop.classList.remove('floating');
        for (const prop of ['top', 'left', 'maxHeight']) drop.style[prop] = '';
        drop.rbHome.append(drop);
        return;
    }
    const button = drop.rbHome.querySelector('button, .btn').getBoundingClientRect();
    document.body.append(drop);
    drop.classList.add('floating');
    const top = button.bottom + 6;
    drop.style.top = top + 'px';
    drop.style.maxHeight = Math.max(160, innerHeight - top - 8) + 'px';
    // lined up with the button's left edge, or with its right edge when that would leave the screen
    const width = drop.getBoundingClientRect().width;
    const left = button.left + width > innerWidth - 8 ? button.right - width : button.left;
    drop.style.left = Math.max(8, left) + 'px';
}

// A filter row (tags, authors): its name and how many chips it has, on a button that folds the chips away so they
// don't crowd the list. Folded, only the chips you've chosen show. Open or folded is remembered per row (this device).
//   fillFilterRow(row, 'Tags', chips, [clearButton])
function fillFilterRow(row, label, chips, extra = []) {
    const key = 'research_board_filter_open:' + row.id;
    let open = false;
    try { open = localStorage.getItem(key) === '1'; } catch { }
    const chosen = chips.filter(chip => chip.classList.contains('active')).length;
    const toggle = el('button', 'link filter_toggle');
    toggle.type = 'button';
    const show = () => {
        row.classList.toggle('filter_open', open);
        toggle.setAttribute('aria-expanded', open);
        toggle.textContent = `${label} (${chips.length}${chosen ? `, ${chosen} chosen` : ''}) ${open ? '▴' : '▾'}`;
        toggle.title = open ? 'Fold these away' : `Show all ${chips.length}`;
    };
    toggle.onclick = () => {
        open = !open;
        try { localStorage.setItem(key, open ? '1' : ''); } catch { }
        show();
    };
    show();
    row.hidden = !chips.length;
    row.replaceChildren(toggle, ...chips, ...extra);
}

// ---- popups: every .modal sits inside #modals and one shows at a time (the one window system for every page:
// system_documents/design/ui.md). On phones they're sheets along the bottom, their buttons always in view.
// A page tidies up after its own popup on its 'modalclose' event (closed by a button, a click outside, Escape).

function openModal(modal) {
    const modals = $('#modals');
    modals.hidden = false;
    for (const m of $$('.modal', modals)) m.hidden = m !== modal;
    modal.scrollTop = 0;
}

function closeModals() {
    const modals = $('#modals');
    if (!modals || modals.hidden) return;
    const open = $$('.modal', modals).find(m => !m.hidden);
    modals.hidden = true;
    open?.dispatchEvent(new Event('modalclose'));
}

document.addEventListener('click', e => {
    const modals = $('#modals');
    if (modals && !modals.hidden && (e.target === modals || e.target.closest('[data-close]'))) closeModals();
});

document.addEventListener('keydown', e => {
    const modals = $('#modals');
    if (e.key === 'Escape' && modals && !modals.hidden) closeModals();
});

// Folds a long block (a long author list, an abstract) to about `lines` lines, faded at the bottom, with a button
// under it to show it all and fold it again. Nothing extra shows when it fits. Call it after filling the block;
// it measures on the next frame, so it can be called just before its popup opens.
function foldLong(box, lines, { more = 'Show more', less = 'Show less' } = {}) {
    box.classList.add('fold');
    box.classList.remove('open', 'folded');
    box.style.setProperty('--fold-lines', lines);
    let btn = box.nextElementSibling?.classList.contains('fold_toggle') ? box.nextElementSibling : null;
    if (!btn) {
        btn = el('button', 'link fold_toggle');
        btn.type = 'button';
        box.after(btn);
    }
    btn.onclick = () => {
        const open = box.classList.toggle('open');
        btn.textContent = open ? less : more;
        btn.setAttribute('aria-expanded', open);
    };
    btn.textContent = more;
    btn.setAttribute('aria-expanded', 'false');
    btn.hidden = true;
    // measured once it's on screen, and again when its width changes (a box shown later, e.g. behind Details ▾ on
    // phones, is measured when it appears)
    const measure = () => {
        if (box.classList.contains('open') || !box.clientHeight) return;
        const fits = box.scrollHeight <= box.clientHeight + 2;
        box.classList.toggle('folded', !fits);
        btn.hidden = fits;
    };
    box.rbFold?.disconnect();
    box.rbFold = new ResizeObserver(measure);
    box.rbFold.observe(box);
    requestAnimationFrame(measure);
}

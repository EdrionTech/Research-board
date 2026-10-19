// Back links that go back to where you came from: library → paper → back to the library;
// project → paper → back to the project; settings → back to whichever page opened them.
// Every page records itself in a short trail for this tab (sessionStorage). A page's "←" link points at the
// page before it in the trail, named after it; with no trail (a page opened directly) it uses its default.
// Loaded on every page (no dependencies, so the home page can have it too).

const Nav = (() => {
    const KEY = 'research_board_trail';
    const MAX = 30;
    const page = href => href.split('#')[0]; // the same page whatever tab (#literature…) it shows

    function read() {
        try {
            const trail = JSON.parse(sessionStorage.getItem(KEY));
            return Array.isArray(trail) ? trail : [];
        } catch {
            return [];
        }
    }
    const write = trail => { try { sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-MAX))); } catch { } };

    // this page joins the trail (a reload doesn't add it twice; the browser's own Back steps back along it)
    const trail = read();
    const here = page(location.href);
    if (trail.at(-1)?.page === here) { /* reloaded */ }
    else if (trail.at(-2)?.page === here) trail.pop();
    else trail.push({ page: here, href: location.href, title: '' });
    write(trail);

    // the page's name and exact address (its tab, its title) as you leave it
    addEventListener('pagehide', () => {
        const now = read();
        const last = now.at(-1);
        if (last?.page !== page(location.href)) return;
        last.href = location.href;
        last.title = document.title;
        write(now);
    });

    // a short name for a page in the trail: the app's own pages by name, the rest by their title
    function nameOf(entry) {
        const file = entry.page.split('?')[0].split('/').pop();
        if (file === '' || file === 'index.html') return 'Projects';
        if (file === 'library.html') return 'Library';
        if (file === 'settings.html') return 'Settings';
        const title = (entry.title || '').replace(/\s*·\s*Research Board$/, '').trim();
        return title.length > 42 ? title.slice(0, 40) + '…' : title || 'Back';
    }

    // Points a "←" link at the previous page (or the fallback when there isn't one)
    function backLink(link, fallbackHref, fallbackLabel) {
        if (!link) return;
        const prev = read().at(-2);
        if (!prev) {
            link.href = fallbackHref;
            link.textContent = '← ' + fallbackLabel;
            return;
        }
        link.href = prev.href;
        link.textContent = '← ' + nameOf(prev);
        link.title = prev.title || '';
        link.onclick = e => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return; // a new tab keeps this one's trail
            e.preventDefault();
            const now = read();
            now.pop(); // leaving this page
            write(now);
            location.href = prev.href;
        };
    }

    // where the back link goes (e.g. after deleting this page's item)
    const backHref = fallbackHref => read().at(-2)?.href || fallbackHref;

    return { backLink, backHref };
})();

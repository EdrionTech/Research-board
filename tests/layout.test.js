// Layout on phones (system_documents/design/ui.md): every page at phone widths, and every popup on it. A page
// mustn't scroll sideways; a popup must fit the screen, and its buttons (a form's last row) must be in view.
// A change made for one page or for desktop that breaks another on a phone shows up here.
const { startServer, launchBrowser, tester } = require('./helpers');

const WIDTHS = [360, 412];
const PAGES = [
    ['home', 'index.html'],
    ['library', 'page/library.html'],
    ['project dashboard', 'page/project_dashboard.html?id=p1'],
    ['material', 'page/material.html?id=s1'],
    ['review', 'page/review.html?id=p1'],
    ['settings', 'page/settings.html'],
    ['server control page', 'page/server.html'],
];

(async () => {
    const t = tester();
    const server = await startServer(5597);
    const browser = await launchBrowser();
    try {
        for (const [name, url] of PAGES) {
            await t.test(`${name}: fits a phone, and so does each popup`, async () => {
                const problems = [];
                for (const width of WIDTHS) {
                    const page = await browser.newPage();
                    const errors = [];
                    page.on('pageerror', e => errors.push(e.message));
                    await page.setViewport({ width, height: 760, deviceScaleFactor: 1 });
                    await page.goto(server.base + url, { waitUntil: 'networkidle0' });
                    await new Promise(r => setTimeout(r, 300));
                    const found = await page.evaluate(() => {
                        const out = [];
                        const wide = () => document.documentElement.scrollWidth > innerWidth + 1;
                        // what sticks out past the right edge, to say where
                        const culprit = () => [...document.querySelectorAll('body *')]
                            .filter(e => e.getClientRects().length && e.getBoundingClientRect().right > innerWidth + 1)
                            .map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''))
                            .slice(-3).join(', ');
                        if (wide()) out.push(`the page scrolls sideways (${culprit()})`);
                        // each tab of a page with tabs (Settings, the dashboard, the server's page)
                        for (const tab of document.querySelectorAll('[data-tab]')) {
                            tab.click();
                            if (wide()) out.push(`its "${tab.textContent.trim()}" tab scrolls sideways (${culprit()})`);
                        }
                        document.querySelector('[data-tab]')?.click();
                        const modals = document.querySelector('#modals');
                        for (const modal of modals ? modals.querySelectorAll('.modal') : []) {
                            if (typeof openModal === 'function') openModal(modal);
                            else { modals.hidden = false; modal.hidden = false; }
                            const box = modal.getBoundingClientRect();
                            const label = modal.id || modal.className.split(' ')[0];
                            if (box.width > innerWidth + 1 || box.left < -1) out.push(`popup ${label} is wider than the screen`);
                            if (modal.scrollWidth > modal.clientWidth + 1) out.push(`popup ${label} scrolls sideways (${culprit()})`);
                            const actions = modal.matches('form') ? modal.querySelector(':scope > .actions:last-child') : null;
                            if (actions) {
                                const bar = actions.getBoundingClientRect();
                                if (bar.bottom > innerHeight + 1 || bar.top < 0) out.push(`popup ${label}: its buttons are off the screen`);
                            }
                            if (typeof closeModals === 'function') closeModals();
                            else modals.hidden = true;
                        }
                        return out;
                    });
                    for (const p of found) problems.push(`${width}px: ${p}`);
                    for (const e of errors) problems.push(`${width}px: page error: ${e}`);
                    await page.close();
                }
                return problems.length ? problems.join('\n') : null;
            });
        }
    } finally {
        await browser.close();
        await server.close();
    }
    t.finish();
})().catch(e => { console.error(e); process.exit(1); });

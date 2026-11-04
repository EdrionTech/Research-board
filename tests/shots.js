// Screenshots at phone size (Pixel 7) and one at desktop size, into tests/shots/, for checking layouts by eye.
// Not a test: nothing passes or fails. `bun shots.js` (or bun run shots).
const fs = require('fs');
const path = require('path');
const { SAMPLE, startServer, launchBrowser, wait } = require('./helpers');

// a Pixel 7, as Playwright describes it
const PIXEL_7 = {
    viewport: { width: 412, height: 839, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
};

const OUT = path.join(__dirname, 'shots');

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const server = await startServer(5595);
    const { base } = server;
    const browser = await launchBrowser();
    const shot = (page, name, options) => page.screenshot({ path: path.join(OUT, name + '.png'), ...options });
    const project = SAMPLE.projects[0].id, source = SAMPLE.items[0].id;

    const phone = await browser.newPage();
    await phone.emulate(PIXEL_7);
    phone.on('pageerror', e => console.log('phone pageerror:', e.message));
    await phone.goto(base, { waitUntil: 'networkidle0' });
    await shot(phone, 'phone-home');
    await phone.goto(base + 'page/project_dashboard.html?id=' + project, { waitUntil: 'networkidle0' });
    await shot(phone, 'phone-dashboard');
    await phone.goto(base + 'page/material.html?id=' + source, { waitUntil: 'networkidle0' });
    await wait(1500);
    await shot(phone, 'phone-reader');
    await phone.click('#toc_btn');
    await wait(400);
    await shot(phone, 'phone-contents');
    await phone.keyboard.press('Escape');
    await phone.click('#more_btn');
    await wait(300);
    await shot(phone, 'phone-more');

    const desk = await browser.newPage();
    await desk.setViewport({ width: 1366, height: 800 });
    desk.on('pageerror', e => console.log('desktop pageerror:', e.message));
    await desk.goto(base + 'page/material.html?id=' + source, { waitUntil: 'networkidle0' });
    await wait(1500);
    await shot(desk, 'desktop-reader');

    await browser.close();
    await server.close();
    console.log('Screenshots in', OUT);
})().catch(e => { console.error(e); process.exit(1); });

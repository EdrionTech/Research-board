// Screenshots at phone size (Pixel 7) and one at desktop size, into tests/shots/, for checking layouts by eye.
// Not a test: nothing passes or fails. `node shots.js` (or npm run shots).
const fs = require('fs');
const path = require('path');
const { devices } = require('playwright-core');
const { SAMPLE, startServer, launchBrowser } = require('./helpers');

const OUT = path.join(__dirname, 'shots');

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const server = await startServer(5595);
    const { base } = server;
    const browser = await launchBrowser();
    const shot = (page, name, options) => page.screenshot({ path: path.join(OUT, name + '.png'), ...options });
    const project = SAMPLE.projects[0].id, source = SAMPLE.items[0].id;

    const phone = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage();
    phone.on('pageerror', e => console.log('phone pageerror:', e.message));
    await phone.goto(base, { waitUntil: 'networkidle' });
    await shot(phone, 'phone-home');
    await phone.goto(base + 'page/project_dashboard.html?id=' + project, { waitUntil: 'networkidle' });
    await shot(phone, 'phone-dashboard');
    await phone.goto(base + 'page/material.html?id=' + source, { waitUntil: 'networkidle' });
    await phone.waitForTimeout(1500);
    await shot(phone, 'phone-reader');
    await phone.click('#toc_btn');
    await phone.waitForTimeout(400);
    await shot(phone, 'phone-contents');
    await phone.keyboard.press('Escape');
    await phone.click('#more_btn');
    await phone.waitForTimeout(300);
    await shot(phone, 'phone-more');

    const desk = await (await browser.newContext({ viewport: { width: 1366, height: 800 } })).newPage();
    desk.on('pageerror', e => console.log('desktop pageerror:', e.message));
    await desk.goto(base + 'page/material.html?id=' + source, { waitUntil: 'networkidle' });
    await desk.waitForTimeout(1500);
    await shot(desk, 'desktop-reader');

    await browser.close();
    await server.close();
    console.log('Screenshots in', OUT);
})().catch(e => { console.error(e); process.exit(1); });

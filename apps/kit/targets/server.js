// A web app served by a Bun server (project.json "server"):
//
//   browser         start the server here and open the app in the browser:  bun <dir>/<start> --open
//   dev browser     the same, reloading the page when the web folder changes:  bun <dir>/<start> --open <dev>
//                   (offered when "dev" names the server's option for it, e.g. "dev": "--dev")
//   host            the server for other devices (its own menu or control page):  bun <dir>/<host> [options]
//   build server    the server version, ready to copy to another computer: builds/<name>-<version>-host.zip
//
// The server version keeps the project's own layout (the web folder, the server folder, the kit, run.bat / run.sh
// and project.json, marked "bundle": true), so the server and the launcher work in it unchanged; only browser and
// host are offered there.
// "health" is a path that answers once the server is up: the bundle is started once to check it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { say, done, warn, fail, handOver, zipFolder } = require('../lib/util');

module.exports = p => {
    const s = { start: 'server.js', host: '', health: '', bundle: ['*.js', '*.sh', 'README.md'], ...p.cfg.server };
    const dir = p.at(s.dir);
    if (!fs.existsSync(path.join(dir, s.start))) return {};
    const bun = process.execPath;
    const zipName = p.artifact('-host.zip');

    async function bundle() {
        say('Preparing the server version');
        const out = path.join(p.out, 'host');
        fs.rmSync(out, { recursive: true, force: true });
        fs.mkdirSync(out, { recursive: true });
        const copy = rel => fs.cpSync(p.at(rel), path.join(out, rel), { recursive: true });
        copy(p.cfg.web);
        copy(p.kit);
        for (const file of ['run.bat', 'run.sh']) copy(file);
        // marked as a server version: the launcher there offers only browser and host
        fs.writeFileSync(path.join(out, p.config), JSON.stringify({ ...p.cfg, bundle: true }, null, 2) + '\n');
        const globs = s.bundle.map(g => new Bun.Glob(g));
        fs.mkdirSync(path.join(out, s.dir), { recursive: true });
        for (const name of fs.readdirSync(dir)) {
            if (globs.some(g => g.match(name)) && fs.statSync(path.join(dir, name)).isFile()) copy(path.join(s.dir, name));
        }
        fs.writeFileSync(path.join(out, 'VERSION'), p.version + '\n');

        if (s.health) await check(path.join(out, s.dir, s.start));
        const zip = path.join(p.out, zipName);
        zipFolder(out, zip);
        done(`Server version: ${out} (and ${zip})${s.health ? '; it started and answered' : ''}`);
        warn('On the other computer: unzip it, then run.bat host (Windows) or ./run.sh host (macOS, Linux).');
        warn('Bun is installed there if it is missing.');
        return [zip];
    }

    // it starts and answers, on a spare port with an empty data folder
    async function check(entry) {
        const port = 5593;
        const data = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-host-check-'));
        const child = spawn(bun, [entry], { env: { ...process.env, PORT: String(port), DATA: data }, stdio: 'ignore' });
        try {
            for (let i = 0; i < 30; i++) {
                await Bun.sleep(300);
                try { if ((await fetch(`http://127.0.0.1:${port}${s.health}`)).ok) return; } catch { }
            }
            fail(`The server version did not start (try: bun ${path.join(s.dir, s.start)} in ${path.join(p.out, 'host')})`);
        } finally {
            child.kill();
            await Bun.sleep(300);
            fs.rmSync(data, { recursive: true, force: true });
        }
    }

    const serve = extra => args => handOver(bun, [path.join(dir, s.start), '--open', ...extra, ...args], { cwd: p.root });
    const tasks = { browser: { label: 'The app here, in your browser', serves: true, aka: ['open'], run: serve([]) } };
    if (s.dev) tasks['dev browser'] = { label: 'The app in your browser, reloading as the code changes (development)', serves: true, dev: true, run: serve([].concat(s.dev)) };
    if (s.host && fs.existsSync(path.join(dir, s.host))) {
        tasks.host = { label: 'Host it for other devices', serves: true, run: args => handOver(bun, [path.join(dir, s.host), ...args], { cwd: p.root }) };
    }
    tasks['build server'] = { label: 'Server version (folder and .zip)', build: bundle, dev: true };
    return {
        tasks,
        builds: [{ name: 'server', task: 'build server', file: zipName, sources: [p.cfg.web, s.dir, p.kit, 'run.bat', 'run.sh', p.config] }],
        release: bundle,
    };
};

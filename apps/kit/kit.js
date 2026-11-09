// The kit: one launcher for running, hosting, building and releasing a project made of a web app and the shells
// around it (a Bun server, a Tauri desktop app, a Capacitor phone app). run.bat / run.sh find Bun and start this.
// Everything about the project itself is in project.json, beside the kit's folder; see kit/README.md.
//
//   run                  a menu (with which builds are older than the code), back after each task
//   run <task> [...]     a task, e.g.  run browser,  run host --public,  run build phone,  run release
//   run help             the tasks this project has

if (!process.versions.bun) {
    console.error('The kit runs on Bun: bun kit/kit.js, or run.bat / ./run.sh (https://bun.sh)');
    process.exit(1);
}

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const u = require('./lib/util');

// project.json sits beside the kit's folder; its "root" is the project's top folder, from there ("." by default).
// Every other path in it is from the project's top folder.
const CONFIG = path.resolve(__dirname, '..', 'project.json');
let ROOT = path.dirname(CONFIG);

function loadProject() {
    let cfg;
    try { cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch (err) { u.fail(`Couldn't read project.json (${err.message})`); }
    if (!cfg.name || !cfg.version) u.fail('project.json needs at least "name" and "version"');
    cfg = { root: '.', web: 'src', builds: 'builds', ...cfg };
    ROOT = path.resolve(path.dirname(CONFIG), cfg.root);
    const fileName = cfg.fileName || cfg.name.replace(/[^A-Za-z0-9]+/g, '');
    const out = path.resolve(ROOT, cfg.builds);
    return {
        root: ROOT, kit: path.relative(ROOT, __dirname), config: path.relative(ROOT, CONFIG), cfg, out, name: cfg.name, version: cfg.version, fileName,
        slug: cfg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        at: (...parts) => path.resolve(ROOT, ...parts),
        artifact: suffix => `${fileName}-${cfg.version}${suffix}`,
        ensureOut: () => fs.mkdirSync(out, { recursive: true }),
    };
}

function collect(p) {
    const targets = [
        p.cfg.server && require('./targets/server')(p),
        p.cfg.desktop && require('./targets/tauri')(p),
        p.cfg.phone && require('./targets/capacitor')(p),
    ].filter(Boolean);
    const tasks = {}, builds = [], releasers = [];
    for (const t of targets) {
        Object.assign(tasks, t.tasks);
        builds.push(...(t.builds || []));
        if (t.release) releasers.push(t.release);
    }

    // the tasks every project has (those that apply)
    const firstBuilds = targets.map(t => t.builds && t.builds[0] && t.builds[0].task).filter(Boolean);
    if (firstBuilds.length > 1) {
        tasks['build all'] = { label: `All of them (${firstBuilds.map(k => k.slice(6)).join(', ')})`, dev: true, build: async () => { for (const k of firstBuilds) await tasks[k].build(); } };
    }
    const notes = p.cfg.releaseNotes && p.at(p.cfg.releaseNotes, `${p.version}.md`);
    if (releasers.length) {
        tasks.release = { label: 'A release: the tests, then every build, notes and checksums together', dev: true, build: () => release(p, tasks, releasers, notes) };
    }
    if (builds.length) tasks.status = { label: 'Which builds are older than the code', dev: true, run: () => status(p, builds) };
    if (p.cfg.tests && fs.existsSync(p.at(p.cfg.tests.dir))) tasks.test = { label: 'Run the tests', dev: true, run: args => test(p, args) };
    tasks.clean = { label: `Empty ${p.cfg.builds}/`, dev: true, run: () => { fs.rmSync(p.out, { recursive: true, force: true }); u.done(`${p.cfg.builds}/ emptied`); } };
    return { tasks, builds };
}

// each build in builds/ against the code it's made from: a build older than its code doesn't have the latest changes
function status(p, builds) {
    for (const b of builds) {
        const file = path.join(p.out, b.file);
        let built = null;
        try { built = fs.statSync(file).mtimeMs; } catch { }
        const changed = u.newest(b.sources.map(s => p.at(s)));
        const name = b.name.padEnd(14);
        if (!built) console.log('  ' + u.grey(`${name}not built yet                       (run ${b.task})`));
        else if (changed && changed.mtime > built) {
            console.log('  ' + u.yellow(`${name}OUT OF DATE  built ${u.stamp(built)}, code changed ${u.stamp(changed.mtime)} (${path.relative(ROOT, changed.file)}): run ${b.task}`));
        } else console.log('  ' + u.green(`${name}up to date   built ${u.stamp(built)}  ${b.file}`));
    }
}

// the tests: "run" in the tests folder, on Bun, its packages installed the first time
function test(p, args = []) {
    const dir = p.at(p.cfg.tests.dir);
    if (fs.existsSync(path.join(dir, 'package.json')) && !fs.existsSync(path.join(dir, 'node_modules'))) {
        u.say('Installing the test tools (once)');
        u.run(process.execPath, ['install'], { cwd: dir });
    }
    u.run(process.execPath, [p.cfg.tests.run || 'run.js', ...args], { cwd: dir });
}

// Nothing is built unless every test passes; then every build, with the notes and SHA256SUMS.txt, in
// builds/releases/<version>/. builds/releases/latest/ is then a copy of the highest version there (so re-making an
// older release doesn't replace it). The version is project.json's: raise it there first.
const versionParts = v => v.split(/[.-]/).map(n => (/^\d+$/.test(n) ? Number(n) : -1));
function compareVersions(a, b) {
    const x = versionParts(a), y = versionParts(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
    return 0;
}
function updateLatest(releases) {
    const versions = fs.readdirSync(releases).filter(n => n !== 'latest' && fs.statSync(path.join(releases, n)).isDirectory());
    const newest = versions.sort(compareVersions).pop();
    const latest = path.join(releases, 'latest');
    fs.rmSync(latest, { recursive: true, force: true });
    if (!newest) return null;
    fs.cpSync(path.join(releases, newest), latest, { recursive: true });
    fs.writeFileSync(path.join(latest, 'VERSION'), newest + '\n');
    return newest;
}

async function release(p, tasks, releasers, notes) {
    if (notes && !fs.existsSync(notes)) u.fail(`No release notes for ${p.version} yet: write ${path.relative(ROOT, notes)} (or raise "version" in project.json)`);
    if (tasks.test) {
        u.say(`Release ${p.version}: the tests first`);
        test(p);
    }
    const files = [];
    for (const make of releasers) files.push(...await make());
    const releases = path.join(p.out, 'releases');
    const dir = path.join(releases, p.version);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const file of files) fs.copyFileSync(file, path.join(dir, path.basename(file)));
    if (notes) fs.copyFileSync(notes, path.join(dir, 'RELEASE-NOTES.md'));
    const sums = files.map(file => `${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}  ${path.basename(file)}`);
    fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), sums.join('\n'));
    u.done(`Release ${p.version}: ${dir}`);
    for (const name of fs.readdirSync(dir)) console.log(`   ${name.padEnd(40)} ${u.mb(path.join(dir, name)).padStart(9)}`);
    const newest = updateLatest(releases);
    u.done(newest === p.version ? `${path.join(releases, 'latest')} is now ${newest}` : `latest/ stays ${newest} (a higher version than ${p.version})`);
}

function help(p, list) {
    console.log(`${p.name} ${p.version}${p.cfg.bundle ? ' (server version)' : ''}: run <task>\n`);
    for (const [key, t] of list) console.log(`  ${key.padEnd(20)} ${t.label}`);
}

// a task's words and options from the command line: "build phone" is two words, "open" one
// a task's name is one or two words; a task can also answer to older names (aka)
function parse(offered, args) {
    if (offered[`${args[0]} ${args[1]}`]) return [`${args[0]} ${args[1]}`, args.slice(2)];
    const old = Object.keys(offered).find(k => (offered[k].aka || []).includes(args[0]));
    return [old || args[0], args.slice(1)];
}

async function perform(p, offered, key, args, { menu = false } = {}) {
    const task = offered[key];
    if (!task) u.fail(`No task "${key}". The tasks: ${Object.keys(offered).join(', ')}`);
    if (task.ask && !args.length) args = [(prompt(task.ask + ':') || '').trim().replace(/^"|"$/g, '')];

    // From the menu on Windows, a task that keeps running (a server) gets a window of its own, so the menu stays
    // usable: through the launcher, which keeps that window open if it stops with an error.
    const launcher = path.join(ROOT, 'run.bat');
    if (menu && task.serves && process.platform === 'win32' && fs.existsSync(launcher)) {
        const title = `${p.name} - ${key}`; // (has a space, so it's passed quoted: start takes it as the title)
        u.run(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'start', title, launcher, ...key.split(' '), ...args]);
        u.done(`${key}: started in its own window. Close that window (or Ctrl + C in it) to stop it.`);
        return;
    }
    if (menu && task.serves) u.warn('Ctrl + C stops it and brings back the menu.');

    const started = Date.now();
    if (task.build) await task.build(args);
    else await task.run(args);
    if (task.build) {
        const s = Math.round((Date.now() - started) / 1000);
        u.done(`Finished in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    }
}

// the menu, again after each task (a failed one too) until it's closed: Enter on its own, or q
async function menu(p, list, offered, builds) {
    process.on('SIGINT', () => { }); // Ctrl + C stops the task running, not the menu
    for (;;) {
        console.log('\n' + u.cyan(`${p.name} ${p.version}`) + '\n');
        if (!p.cfg.bundle && builds.length) { status(p, builds); console.log(''); }
        list.forEach(([k, t], i) => console.log(`  ${String(i + 1).padStart(2)}. ${k.padEnd(20)} ${t.label}`));
        const pick = (prompt('\nWhich (number or name; Enter to close)?') || '').trim();
        if (!pick || /^(q|quit|exit)$/i.test(pick)) return;
        const [key, args] = /^\d+$/.test(pick) ? [(list[Number(pick) - 1] || [String(pick)])[0], []] : parse(offered, pick.split(/\s+/));
        try {
            await perform(p, offered, key, args, { menu: true });
        } catch (err) {
            console.error('\n' + u.red(err instanceof u.KitError ? err.message : err.stack || String(err)));
        }
        process.exitCode = 0;
    }
}

async function main() {
    const p = loadProject();
    const { tasks, builds } = collect(p);
    const list = Object.entries(tasks).filter(([, t]) => !(p.cfg.bundle && t.dev));
    const offered = Object.fromEntries(list);

    const args = process.argv.slice(2);
    if (!args.length) return menu(p, list, offered, builds);
    if (['help', '-h', '--help'].includes(args[0])) return help(p, list);
    await perform(p, offered, ...parse(offered, args));
}

main().catch(err => {
    console.error('\n' + u.red(err instanceof u.KitError ? err.message : err.stack || String(err)));
    process.exitCode = 1;
});

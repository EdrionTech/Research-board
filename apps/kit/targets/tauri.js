// A desktop app made with Tauri (project.json "desktop": its src-tauri folder):
//
//   build desktop [options]  the app for the system it's built on, in builds/<name>-<version>…:
//                    Windows -setup.exe and .msi; macOS .dmg and -mac.app.zip; Linux .AppImage, .deb and .rpm
//                    (which ones: bundle.targets, per system in tauri.windows / macos / linux.conf.json). Options go to
//                    cargo tauri build, e.g. --target universal-apple-darwin (one Mac app for Intel and Apple silicon)
//   dev desktop     run the app from the web folder without installing (cargo tauri dev)
//   icons <file>    every icon size from a square SVG or a 1024 px PNG (and the phone's icons, if there is a phone app)
//
// The version in tauri.conf.json is set from project.json's before each build, so there is only one to change.
// Each system builds only its own app: a Mac for macOS, a Linux machine for Linux. macOS signing and notarization are
// Tauri's, from the environment (APPLE_SIGNING_IDENTITY; APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID): without them the app
// is signed "ad hoc" (tauri.macos.conf.json), which runs, but other Macs warn before opening it the first time.

const fs = require('fs');
const path = require('path');
const { say, done, warn, fail, run, succeeds, newestIn, place } = require('../lib/util');
const { WIN, MAC, useTauri } = require('../lib/tools');

module.exports = p => {
    const dir = p.at(p.cfg.desktop.dir);
    const conf = path.join(dir, 'tauri.conf.json');
    if (!fs.existsSync(conf)) return {};

    // (folder in target/[<target>/]release/bundle, file name pattern, what it's called in builds/)
    const kinds = [
        ['nsis', /-setup\.exe$/, '-setup.exe'],
        ['msi', /\.msi$/, '.msi'],
        ['dmg', /\.dmg$/, '.dmg'],
        ['macos', /\.app$/, '-mac.app.zip'], // (a folder: zipped with ditto, which keeps what macOS needs)
        ['appimage', /\.AppImage$/, '.AppImage'],
        ['deb', /\.deb$/, '.deb'],
        ['rpm', /\.rpm$/, '.rpm'],
    ];
    const primary = p.artifact(WIN ? '-setup.exe' : MAC ? '.dmg' : '.AppImage');

    function syncVersion() {
        const text = fs.readFileSync(conf, 'utf8');
        const json = JSON.parse(text);
        if (json.version === p.version) return;
        json.version = p.version;
        fs.writeFileSync(conf, JSON.stringify(json, null, 2) + '\n');
        warn(`tauri.conf.json: version set to ${p.version} (from project.json)`);
    }

    // Linux: Tauri needs the system's web view and its build packages
    function linuxPackages() {
        if (process.platform !== 'linux' || !Bun.which('pkg-config')) return;
        if (succeeds('pkg-config', ['--exists', 'webkit2gtk-4.1'])) return;
        fail('Needs the packages Tauri builds with. Debian / Ubuntu:\n'
            + '  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev\n'
            + 'Fedora: sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel\n'
            + 'Others: https://v2.tauri.app/start/prerequisites/');
    }

    function build(args = []) {
        useTauri();
        linuxPackages();
        syncVersion();
        say('Building the desktop app (first time: several minutes)');
        const started = Date.now();
        run('cargo', ['tauri', 'build', ...args], { cwd: dir });
        p.ensureOut();
        const at = args.indexOf('--target');
        const bundle = at >= 0 ? path.join(dir, 'target', args[at + 1], 'release', 'bundle') : path.join(dir, 'target', 'release', 'bundle');
        const made = [];
        for (const [folder, test, suffix] of kinds) {
            const file = newestIn(path.join(bundle, folder), test);
            if (!file || fs.statSync(file).mtimeMs < started - 1000) continue; // (only what this build made)
            const to = path.join(p.out, p.artifact(suffix));
            if (folder === 'macos') {
                fs.rmSync(to, { force: true });
                run('ditto', ['-c', '-k', '--keepParent', file, to]);
            } else place(file, to);
            made.push(to);
            done(`Desktop app: ${to}`);
        }
        if (!made.length) fail(`No installer was made (look in ${bundle})`);
        return made;
    }

    function icons([file]) {
        if (!file || !fs.existsSync(file)) fail('Give the icon: run icons path/to/logo.svg (a square SVG, or a 1024 x 1024 PNG)');
        useTauri();
        say('Making the app icons');
        run('cargo', ['tauri', 'icon', path.resolve(file), '-o', 'icons'], { cwd: dir });
        const phoneRes = p.cfg.phone && p.at(p.cfg.phone.dir, 'android', 'app', 'src', 'main', 'res');
        if (phoneRes && fs.existsSync(phoneRes)) {
            const android = path.join(dir, 'icons', 'android');
            for (const density of fs.readdirSync(android).filter(n => /^mipmap-.*dpi$/.test(n))) {
                for (const png of fs.readdirSync(path.join(android, density)).filter(n => n.endsWith('.png'))) {
                    fs.copyFileSync(path.join(android, density, png), path.join(phoneRes, density, png));
                }
            }
        }
        // iOS: one 1024 px icon (Capacitor's AppIcon set)
        const iosIcon = p.cfg.phone && p.at(p.cfg.phone.dir, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
        const tauriIos = path.join(dir, 'icons', 'ios', 'AppIcon-512@2x.png');
        if (iosIcon && fs.existsSync(iosIcon) && fs.existsSync(tauriIos)) fs.copyFileSync(tauriIos, iosIcon);
        done(p.cfg.phone ? 'Desktop and phone icons updated: rebuild them to see the change' : 'Desktop icons updated: rebuild to see the change');
    }

    const rel = (...parts) => path.join(p.cfg.desktop.dir, ...parts);
    return {
        tasks: {
            'build desktop': { label: WIN ? 'Desktop app (installer .exe and .msi)' : MAC ? 'Mac app (.dmg and .app)' : 'Linux app (.AppImage, .deb, .rpm)', build, dev: true },
            'dev desktop': { label: 'Run the desktop app from the code (development)', serves: true, run: () => { useTauri(); run('cargo', ['tauri', 'dev'], { cwd: dir }); }, dev: true },
            icons: { label: 'New app icons from a logo file', run: icons, ask: 'Logo file (square SVG or 1024 px PNG)', dev: true },
        },
        builds: [{ name: 'desktop', task: 'build desktop', file: primary, sources: [p.cfg.web, rel('src'), rel('icons'), rel('tauri.conf.json'), rel(`tauri.${WIN ? 'windows' : MAC ? 'macos' : 'linux'}.conf.json`), rel('Cargo.toml')] }],
        release: () => build(),
    };
};

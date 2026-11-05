// How this computer hosts Research Board for other devices: the saved settings (serve.json) and starting with the
// computer. Used by serve.js (which starts the server with them) and by the server's control page (server.js,
// /api/admin), which changes them.
//
//   serve.json   { mode: 'network' | 'public', port: 5500, data: '' }    data: '' = data/ (data-public/ for public)
//     network: devices on the same network, by this machine's address (http)
//     public:  any network, through a temporary https://….trycloudflare.com address (server.js --public, tunnel.js)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execSync } = require('child_process');

const APP = path.resolve(__dirname, '..', '..');
const SETTINGS = path.join(APP, 'serve.json');
const DEFAULTS = { mode: 'network', port: 5500, data: '' };
const MODES = ['network', 'public'];

function loadSettings() {
    try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) }; } catch { return { ...DEFAULTS }; }
}

// checked: a mode, a port from 1024 to 65535, a folder (relative to the Research Board folder, or absolute)
function saveSettings(changes) {
    const settings = { ...loadSettings(), ...changes };
    if (!MODES.includes(settings.mode)) throw new Error('mode: network or public');
    const port = Number(settings.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('the port is a whole number from 1024 to 65535');
    settings.port = port;
    settings.data = String(settings.data || '').trim();
    fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
    return settings;
}

const dataDir = s => path.resolve(APP, s.data || (s.mode === 'public' ? 'data-public' : 'data'));

// ---- starting with the computer: { available, on(), off(), is(), when } ----

const NAME = 'Research Board server';
const STARTUP = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', NAME + '.cmd');
const UNIT = path.join(os.homedir(), '.config', 'systemd', 'user', 'research-board.service');
const PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.researchboard.server.plist');
const SERVE = path.join(__dirname, 'serve.js');
const quiet = (command, args) => spawnSync(command, args, { stdio: 'ignore' }).status === 0;

const autostart = {
    // a small launcher in your Startup folder (no administrator rights needed; remove it there by hand too)
    win32: {
        on: () => fs.writeFileSync(STARTUP, `@rem Starts the Research Board server when you sign in (its control page: "Start with the computer").\r\n`
            + `@start "${NAME}" /min "${path.join(APP, 'serve.bat')}" --start\r\n`),
        off: () => fs.rmSync(STARTUP, { force: true }),
        is: () => fs.existsSync(STARTUP),
        when: 'each time you sign in to Windows, in a small window',
    },
    linux: {
        on() {
            fs.mkdirSync(path.dirname(UNIT), { recursive: true });
            fs.writeFileSync(UNIT, `[Unit]\nDescription=${NAME}\nAfter=network-online.target\n\n[Service]\nWorkingDirectory=${APP}\n`
                + `ExecStart="${process.execPath}" "${SERVE}" --start\nRestart=on-failure\n\n[Install]\nWantedBy=default.target\n`);
            execSync('systemctl --user daemon-reload && systemctl --user enable research-board', { stdio: 'ignore' });
            quiet('loginctl', ['enable-linger', os.userInfo().username]); // (keeps it running after you sign out)
        },
        off() {
            quiet('systemctl', ['--user', 'disable', 'research-board']);
            fs.rmSync(UNIT, { force: true });
            quiet('systemctl', ['--user', 'daemon-reload']);
        },
        is: () => quiet('systemctl', ['--user', 'is-enabled', 'research-board']),
        when: 'with the computer, in the background (its messages: journalctl --user -u research-board)',
    },
    darwin: {
        on() {
            const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
            const log = path.join(APP, 'serve.log');
            fs.mkdirSync(path.dirname(PLIST), { recursive: true });
            fs.writeFileSync(PLIST, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.researchboard.server</string>
  <key>ProgramArguments</key><array><string>${esc(process.execPath)}</string><string>${esc(SERVE)}</string><string>--start</string></array>
  <key>WorkingDirectory</key><string>${esc(APP)}</string>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${esc(log)}</string><key>StandardErrorPath</key><string>${esc(log)}</string>
</dict></plist>
`);
        },
        off() {
            quiet('launchctl', ['unload', PLIST]);
            fs.rmSync(PLIST, { force: true });
        },
        is: () => fs.existsSync(PLIST),
        when: `when you sign in, in the background (its messages: ${path.join(APP, 'serve.log')})`,
    },
}[process.platform];

const startsWithComputer = () => !!autostart && autostart.is();
function setStartsWithComputer(on) {
    if (!autostart) throw new Error(`starting with the computer isn't set up for ${process.platform}`);
    if (on) autostart.on();
    else autostart.off();
    return { on: autostart.is(), when: autostart.when };
}

module.exports = { APP, SETTINGS, DEFAULTS, loadSettings, saveSettings, dataDir, autostart, startsWithComputer, setStartsWithComputer };

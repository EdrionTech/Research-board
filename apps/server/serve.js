// Research Board as a server for other devices: the launcher behind serve.bat / serve.sh.
//
//   (nothing)        start it with the saved settings, and open its control page in your browser (double-clicking
//                    serve.bat): addresses, invites (QR codes), devices, the key, the settings
//   --start          start it, without opening the page (what starting with the computer runs)
//   --public         start it once from any network (a temporary https address), whatever is saved
//   --autostart      start with the computer: on       --no-autostart   off
//
// The settings are kept in serve.json (hosting.js) and changed on the control page. When it saves new ones, the
// server stops with code 75 and this starts it again with them.

if (!process.versions.bun) {
    console.error('Run this with Bun: bun apps/server/serve.js (https://bun.sh)');
    process.exit(1);
}

const path = require('path');
const { spawn } = require('child_process');
const { APP, loadSettings, dataDir, setStartsWithComputer } = require('./hosting');

const RESTART = 75; // the server's "start me again" (its control page saved new settings)

function start({ mode, openPage }) {
    const settings = loadSettings();
    mode ||= settings.mode;
    const env = { ...process.env, PORT: String(settings.port), DATA: dataDir({ ...settings, mode }), RB_SUPERVISED: '1' };
    const args = [path.join(__dirname, 'server.js')];
    if (mode === 'public') args.push('--public');
    else {
        env.HOST = process.env.HOST || '0.0.0.0';
        if (process.platform === 'win32') console.log('If Windows asks whether Bun may use the network, allow it on private networks.');
    }
    if (openPage) args.push('--admin');
    const child = spawn(process.execPath, args, { stdio: 'inherit', env, cwd: APP });
    const pass = signal => () => child.kill(signal);
    const handlers = ['SIGINT', 'SIGTERM', 'SIGHUP'].map(signal => [signal, pass(signal)]);
    for (const [signal, handler] of handlers) process.on(signal, handler);
    child.on('exit', code => {
        for (const [signal, handler] of handlers) process.off(signal, handler);
        if (code !== RESTART) process.exit(code ?? 0);
        console.log('\nStarting again with the new settings…\n');
        start({ openPage: false }); // (the control page that asked finds it again by itself)
    });
}

const args = process.argv.slice(2);
if (args.includes('--autostart') || args.includes('--no-autostart')) {
    try {
        const { on, when } = setStartsWithComputer(args.includes('--autostart'));
        console.log(on ? `It will start ${when}.` : "It won't start by itself any more.");
    } catch (err) {
        console.log(`Couldn't change that: ${err.message}`);
    }
} else if (args.includes('--public')) {
    start({ mode: 'public', openPage: process.stdin.isTTY });
} else {
    start({ openPage: !args.includes('--start') && process.stdin.isTTY });
}

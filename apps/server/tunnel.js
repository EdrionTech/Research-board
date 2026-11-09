// A public HTTPS address for a server on this computer, without opening anything on the router: Cloudflare's
// free "quick tunnel" (cloudflared). cloudflared connects out to Cloudflare, which passes requests for a random
// https://<words>.trycloudflare.com address back down that connection to this server. Nothing listens on the
// network here; stopping the server closes the tunnel. No Cloudflare account is needed (the address changes each
// time; a fixed one needs an account and a domain: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/).
//
// cloudflared is used from PATH if it's installed, else downloaded once into local/tools/ (Cloudflare's own release on
// GitHub) and kept there.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const RELEASES = 'https://github.com/cloudflare/cloudflared/releases/latest/download/';

function onPath() {
    try {
        execFileSync(process.platform === 'win32' ? 'where' : 'which', ['cloudflared'], { stdio: 'ignore' });
        return 'cloudflared';
    } catch { return null; }
}

// the release file for this machine
function releaseName() {
    const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
    if (process.platform === 'win32') return 'cloudflared-windows-amd64.exe'; // (runs on arm64 Windows too)
    if (process.platform === 'darwin') return `cloudflared-darwin-${arch}.tgz`;
    if (process.platform === 'linux') return `cloudflared-linux-${arch}`;
    throw new Error(`no cloudflared download for ${process.platform}: install it (https://github.com/cloudflare/cloudflared) and try again`);
}

async function ensureCloudflared(toolsDir) {
    const found = onPath();
    if (found) return found;
    const exe = path.join(toolsDir, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
    if (fs.existsSync(exe)) return exe;
    const name = releaseName();
    console.log(`Downloading Cloudflare's tunnel program (${name}), once…`);
    const res = await fetch(RELEASES + name);
    if (!res.ok) throw new Error(`couldn't download cloudflared (${res.status})`);
    fs.mkdirSync(toolsDir, { recursive: true });
    const bytes = Buffer.from(await res.arrayBuffer());
    if (name.endsWith('.tgz')) {
        const archive = path.join(toolsDir, name);
        fs.writeFileSync(archive, bytes);
        execFileSync('tar', ['-xzf', archive, '-C', toolsDir]);
        fs.rmSync(archive);
    } else {
        fs.writeFileSync(exe + '.tmp', bytes);
        fs.renameSync(exe + '.tmp', exe);
    }
    fs.chmodSync(exe, 0o755);
    return exe;
}

// Starts the tunnel to http://127.0.0.1:<port>. Resolves { url, stop } once Cloudflare has given the address.
async function startTunnel(port, toolsDir) {
    const exe = await ensureCloudflared(toolsDir);
    const child = spawn(exe, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    const stop = () => { try { child.kill(); } catch { } };
    process.on('exit', stop);
    const url = await new Promise((resolve, reject) => {
        let out = '';
        const timer = setTimeout(() => reject(new Error("Cloudflare didn't give an address within 40 seconds (is this computer online?)")), 40000);
        const read = chunk => {
            out += chunk;
            const found = out.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
            if (found) { clearTimeout(timer); resolve(found[0]); }
        };
        child.stdout.on('data', read);
        child.stderr.on('data', read);
        child.on('exit', code => { clearTimeout(timer); reject(new Error(`the tunnel stopped (exit ${code}):\n${out.slice(-800)}`)); });
    });
    // if it drops later, say so (the server keeps running on this computer)
    child.on('exit', () => console.error('The public address stopped working (the tunnel closed). Start the server again for a new one.'));
    // a new address takes a little while to be known on the internet (DNS): wait until it answers, so the address
    // shown works when it's typed in
    const ready = await answers(url + '/api/health', 90000);
    return { url, stop, ready };
}

async function answers(url, within) {
    const until = Date.now() + within;
    while (Date.now() < until) {
        try {
            if ((await fetch(url, { signal: AbortSignal.timeout(5000) })).ok) return true;
        } catch { }
        await new Promise(r => setTimeout(r, 2000));
    }
    return false;
}

module.exports = { startTunnel, ensureCloudflared };

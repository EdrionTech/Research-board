// The kit's small helpers: messages, running programs, finding the newest file, copying, and writing a .zip.
// Nothing here knows about any one project.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const paint = code => text => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const cyan = paint(36), green = paint(32), yellow = paint(33), grey = paint(90), red = paint(31);

const say = text => console.log('\n' + cyan('== ' + text));
const done = text => console.log('   ' + green(text));
const warn = text => console.log('   ' + yellow(text));

// a problem the kit explains itself (printed without a stack trace)
class KitError extends Error {}
const fail = text => { throw new KitError(text); };

// Windows runs .bat / .cmd files only through cmd.exe
function command(cmd, args) {
    if (process.platform === 'win32' && /\.(bat|cmd)$/i.test(cmd)) return [process.env.ComSpec || 'cmd.exe', ['/d', '/c', cmd, ...args]];
    return [cmd, args];
}

// a program run here stops the task when it fails
function run(cmd, args = [], { cwd, env } = {}) {
    const [exe, argv] = command(cmd, args);
    const result = spawnSync(exe, argv, { cwd, env: env || process.env, stdio: 'inherit' });
    if (result.error) fail(`${cmd} couldn't start: ${result.error.message}`);
    if (result.status !== 0) fail(`${path.basename(cmd)} ${args.join(' ')} failed (exit ${result.status})`);
}

// a program that takes over (a server): its exit code becomes the kit's, with no "failed" message
function handOver(cmd, args = [], { cwd, env } = {}) {
    const [exe, argv] = command(cmd, args);
    const result = spawnSync(exe, argv, { cwd, env: env || process.env, stdio: 'inherit' });
    if (result.error) fail(`${cmd} couldn't start: ${result.error.message}`);
    process.exitCode = result.status ?? 0;
}

const succeeds = (cmd, args = [], options = {}) => {
    const [exe, argv] = command(cmd, args);
    return spawnSync(exe, argv, { stdio: 'ignore', ...options }).status === 0;
};

// every file under the given files and folders (a file is taken as it is)
function* walk(target) {
    let stat;
    try { stat = fs.statSync(target); } catch { return; }
    if (!stat.isDirectory()) return yield { file: target, mtime: stat.mtimeMs };
    for (const entry of fs.readdirSync(target)) yield* walk(path.join(target, entry));
}

// the most recently changed file among them, or null
function newest(targets) {
    let best = null;
    for (const target of targets) for (const f of walk(target)) if (!best || f.mtime > best.mtime) best = f;
    return best;
}

// the newest file in a folder whose name matches, or null
function newestIn(dir, test) {
    if (!fs.existsSync(dir)) return null;
    return fs.readdirSync(dir).filter(name => test.test(name)).map(name => path.join(dir, name))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs).pop() || null;
}

// a finished build put in builds/, dated now: a copy keeps the original's date on Windows, which may be older than
// code that changed since without changing the build (so status would call a new build out of date)
function place(from, to) {
    fs.copyFileSync(from, to);
    const now = new Date();
    fs.utimesSync(to, now, now);
}

const mb = file => (fs.statSync(file).size / 1048576).toFixed(1) + ' MB';
const stamp = ms => new Date(ms).toLocaleString('sv').slice(0, 16); // 2026-11-09 14:05

// ---- .zip, written here so it works the same on every system (folders separated by /, .sh files executable) ----

const CRC = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    return table;
})();
function crc32(bytes) {
    let c = -1;
    for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}
function dosTime(date) {
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
        date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
}

// zip a folder's contents (its files at the top of the archive)
function zipFolder(dir, out) {
    const files = [...walk(dir)].map(f => f.file);
    if (files.length > 65535) fail(`too many files for a .zip (${files.length})`);
    const parts = [], central = [];
    let offset = 0;
    for (const file of files) {
        const data = fs.readFileSync(file);
        const packed = zlib.deflateRawSync(data, { level: 9 });
        const name = Buffer.from(path.relative(dir, file).split(path.sep).join('/'), 'utf8');
        const crc = crc32(data);
        const { time, date } = dosTime(fs.statSync(file).mtime);
        // executable: .sh files, and (zipped on macOS or Linux) whatever is executable there
        const executable = /\.sh$/.test(file) || (process.platform !== 'win32' && (fs.statSync(file).mode & 0o111));
        const mode = executable ? 0o100755 : 0o100644;

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8); // utf-8 names, deflate
        local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12);
        local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        parts.push(local, name, packed);

        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014b50, 0);
        entry.writeUInt16LE((3 << 8) | 20, 4); // made on Unix, so the file modes below count
        entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x0800, 8); entry.writeUInt16LE(8, 10);
        entry.writeUInt16LE(time, 12); entry.writeUInt16LE(date, 14);
        entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(packed.length, 20); entry.writeUInt32LE(data.length, 24);
        entry.writeUInt16LE(name.length, 28);
        entry.writeUInt32LE((mode << 16) >>> 0, 38);
        entry.writeUInt32LE(offset, 42);
        central.push(entry, name);
        offset += local.length + name.length + packed.length;
    }
    const size = central.reduce((n, b) => n + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16);
    fs.writeFileSync(out, Buffer.concat([...parts, ...central, end]));
}

module.exports = { cyan, green, yellow, grey, red, say, done, warn, KitError, fail, run, handOver, succeeds, walk, newest, newestIn, place, mb, stamp, zipFolder };

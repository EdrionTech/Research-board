// Who may use the server: its main key, and a key per device.
//
//   main key    server-key.txt in the data folder (or KEY). The host's: the server's control page needs it.
//               Making a new one doesn't touch the devices' own keys.
//   devices     devices.json in the data folder: [{ id, name, hash, addedAt, lastSeen, by }]. Each device added by an
//               invite gets its own key (only its SHA-256 is kept here), so one device can be removed without the
//               others noticing.
//   invites     in memory (a restart ends them): a link or QR code swapped for a device key. Single-use, or any
//               number of devices until it expires.
//
// createAccess({ data, required, envKey }) → the functions below. required: false on a server for this computer
// only (no key asked for).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const hashOf = token => crypto.createHash('sha256').update(String(token)).digest('hex');
const random = bytes => crypto.randomBytes(bytes).toString('base64url');

function createAccess({ data, required, envKey = '' }) {
    const keyFile = path.join(data, 'server-key.txt');
    const devicesFile = path.join(data, 'devices.json');

    // ---- the main key ----

    let mainKey = '';
    if (envKey) mainKey = envKey;
    else if (required) {
        if (fs.existsSync(keyFile)) mainKey = fs.readFileSync(keyFile, 'utf8').trim();
        if (!mainKey) {
            mainKey = random(24);
            fs.writeFileSync(keyFile, mainKey + '\n', { mode: 0o600 });
        }
    }

    // a new main key (devices keep theirs); not when it's given by KEY
    function newMainKey() {
        if (envKey) throw new Error('the key is set by KEY where the server is started: change it there');
        mainKey = random(24);
        fs.writeFileSync(keyFile, mainKey + '\n', { mode: 0o600 });
        return mainKey;
    }

    // ---- devices ----

    let devices = [];
    try { devices = JSON.parse(fs.readFileSync(devicesFile, 'utf8')); } catch { }
    let byHash = new Map(devices.map(d => [d.hash, d]));
    const saveDevices = () => {
        fs.writeFileSync(devicesFile + '.tmp', JSON.stringify(devices, null, 2), { mode: 0o600 });
        fs.renameSync(devicesFile + '.tmp', devicesFile);
    };
    // "last seen" is kept at most once a minute per device (not a write on every request)
    let seenDirty = false;
    setInterval(() => { if (seenDirty) { seenDirty = false; try { saveDevices(); } catch { } } }, 60000).unref();

    function addDevice(name, by) {
        const token = random(24);
        const device = { id: random(9), name: String(name || 'A device').slice(0, 80), hash: hashOf(token), addedAt: Date.now(), lastSeen: Date.now(), by: by || '' };
        devices.push(device);
        byHash.set(device.hash, device);
        saveDevices();
        return { token, device };
    }

    function removeDevice(id) {
        const before = devices.length;
        devices = devices.filter(d => d.id !== id);
        byHash = new Map(devices.map(d => [d.hash, d]));
        if (devices.length !== before) saveDevices();
        return devices.length !== before;
    }

    const listDevices = () => devices.map(({ hash, ...shown }) => shown);

    // ---- checking a request's key: → { main: true } | { device } | null ----

    function check(token) {
        if (!required && !mainKey) return { main: true }; // (this computer only: no key)
        token = String(token || '');
        if (!token) return null;
        const given = Buffer.from(token);
        const wanted = Buffer.from(mainKey);
        if (given.length === wanted.length && crypto.timingSafeEqual(given, wanted)) return { main: true };
        const device = byHash.get(hashOf(token));
        if (!device) return null;
        if (Date.now() - device.lastSeen > 60000) { device.lastSeen = Date.now(); seenDirty = true; }
        return { device };
    }

    // ---- invites ----

    const invites = new Map(); // token → { id, uses (0: any number), used, until, by }
    function tidy() {
        const now = Date.now();
        for (const [token, invite] of invites) if (invite.until < now) invites.delete(token);
    }

    // uses: 1 (one device) or 0 (any number of devices until it expires)
    function newInvite({ uses = 1, minutes = 20, by = '' } = {}) {
        tidy();
        minutes = Math.min(Math.max(Number(minutes) || 20, 1), 7 * 24 * 60);
        uses = Math.max(0, Math.floor(Number(uses)) || 0);
        const token = random(16);
        const invite = { id: random(6), uses, used: 0, until: Date.now() + minutes * 60000, by };
        invites.set(token, invite);
        return { token, id: invite.id, uses, minutes };
    }

    // an invite swapped for a new device's key: → { token, device } or null (used up, expired, not one)
    function useInvite(token, name) {
        tidy();
        const invite = invites.get(String(token || ''));
        if (!invite) return null;
        invite.used++;
        if (invite.uses && invite.used >= invite.uses) invites.delete(String(token));
        return addDevice(name, invite.by);
    }

    function listInvites() {
        tidy();
        return [...invites.values()].map(({ id, uses, used, until, by }) => ({ id, uses, used, until, by }));
    }

    function cancelInvite(id) {
        for (const [token, invite] of invites) if (invite.id === id) invites.delete(token);
    }

    return {
        get key() { return mainKey; },
        required: required || !!mainKey,
        fromEnv: !!envKey,
        check, newMainKey,
        addDevice, removeDevice, listDevices,
        newInvite, useInvite, listInvites, cancelInvite,
    };
}

module.exports = { createAccess };

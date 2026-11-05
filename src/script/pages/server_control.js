// The server's control page (page/server.html), in tabs: Overview (status, addresses, adding a device, the
// projects on it), Devices (invites; the devices with their own keys), People (accounts: for a public server,
// later), Server (settings, starting with the computer, the main key). apps/server/server.js, /api/admin: the
// main key only. Opened from the server's window with the key in the address's # (never sent to the server, taken
// out at once); else it asks for it. The key is kept for this tab only (sessionStorage).
//
// It looks like the app: the theme, style and colours saved in this server's data (what the app shows when opened
// from this server), changed in its own Appearance tab (core/appearance.js, the same controls as the app's
// Settings), which saves them back there.

const KEY = 'research_board_server_main_key';
let mainKey = '';
let status = null;
let restarting = false;

const say = text => { $('#state').textContent = text; };
const counted = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const when = time => {
    const minutes = Math.round((Date.now() - time) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
    return new Date(time).toLocaleDateString();
};
const left = until => {
    const minutes = Math.max(0, Math.round((until - Date.now()) / 60000));
    return minutes < 60 ? `${minutes} min left` : minutes < 60 * 24 ? `${Math.round(minutes / 60)} h left` : `${Math.round(minutes / 1440)} days left`;
};
const duration = minutes => minutes >= 1440 ? counted(Math.round(minutes / 1440), 'day') : minutes >= 60 ? counted(Math.round(minutes / 60), 'hour') : `${minutes} minutes`;

async function call(path, method = 'GET', body) {
    const res = await fetch(path, {
        method,
        headers: { Authorization: 'Bearer ' + mainKey, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const answer = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(answer.error || `the server said ${res.status}`), { status: res.status });
    return answer;
}
const api = (method, path, body) => call('/api/admin' + path, method, body);

function row(title, detail, buttons = []) {
    const li = el('li');
    const label = el('span', null, title);
    if (detail) label.append(el('small', null, detail));
    li.append(label, ...buttons);
    return li;
}
function button(text, onClick, className = '') {
    const btn = el('button', 'btn small ' + className, text);
    btn.type = 'button';
    btn.onclick = async () => {
        btn.disabled = true;
        try { await onClick(); } catch (err) { say(err.message); } finally { btn.disabled = false; }
    };
    return btn;
}
const emptyRow = text => Object.assign(el('li', 'empty'), { textContent: text });

// an invite's QR code and link, into a box (Overview's quick one, or Devices')
function showInvite(prefix, token, uses, minutes, base) {
    const link = `${base.replace(/\/+$/, '')}/#invite=${token}`;
    const qr = qrcode(0, 'L');
    qr.addData(link);
    qr.make();
    $(`#${prefix}_qr`).innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true, alt: 'Invite QR code' });
    $(`#${prefix}_link`).value = link;
    $(`#${prefix}_note`).textContent = uses === 1 ? `Adds one device, within ${duration(minutes)}.`
        : `Adds any number of devices, for ${duration(minutes)}. Anyone with it can join: share it only with your own devices or your group.`;
    $(`#${prefix === 'invite' ? 'invite' : 'quick_invite_box'}`).hidden = false;
}

// ---- tabs ----

function showTab(name) {
    for (const tab of $$('#tabs [data-tab]')) tab.setAttribute('aria-selected', tab.dataset.tab === name);
    for (const panel of $$('[data-panel]')) panel.hidden = panel.dataset.panel !== name;
    try { sessionStorage.setItem(KEY + ':tab', name); } catch { }
}
$('#tabs').addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) showTab(tab.dataset.tab);
});

// ---- showing it ----

const baseOf = () => {
    const options = status.addresses.length ? status.addresses : [{ label: "this page's address", base: location.origin }];
    return options;
};

function render() {
    const { devices, invites, settings, running, supervised, autostart, keyFromEnv, server } = status;
    $('#server_name').textContent = server.name ? `· ${server.name}` : '';
    $('#server_live').textContent = '';
    $('#status_dot').className = 'status_dot ok';
    $('#status_text').textContent = 'Running';
    const modeName = { network: 'this network', public: 'any network, through a Cloudflare tunnel', proxy: 'its HTTPS address (behind a proxy)' }[running.mode] || running.mode;
    $('#running_detail').textContent = `Reached from ${modeName}, on port ${running.port}. Its data: ${running.data}`;

    // Overview: addresses, each with a copy button
    const options = baseOf();
    $('#addresses').replaceChildren(...options.map(a => {
        const copy = button('Copy', async () => { await copyText(a.base + '/'); say('Address copied ✓'); });
        return row(a.base + '/', a.label, [copy]);
    }));

    // Devices: invites and devices
    const pick = $('#invite_address');
    const chosen = pick.value;
    pick.replaceChildren(...options.map(a => new Option(`${a.base.replace(/^https?:\/\//, '')} (${a.label})`, a.base)));
    if (options.some(a => a.base === chosen)) pick.value = chosen;
    $('#invite_address_label').hidden = options.length < 2;
    $('#invites').replaceChildren(...invites.map(i => row(
        i.uses ? 'For one device' : `For any number of devices (${counted(i.used, 'device')} so far)`,
        `${left(i.until)} · made by ${i.by || 'the server'}`,
        [button('Cancel', async () => { await api('DELETE', '/invites/' + i.id); refresh(); })],
    )));
    if (!invites.length) $('#invites').append(emptyRow('None open.'));
    $('#devices').replaceChildren(...devices.map(d => row(
        d.name,
        `added ${when(d.addedAt)}${d.by ? ' by ' + d.by : ''} · last seen ${when(d.lastSeen)}`,
        [button('Remove', async () => {
            if (!confirm(`Remove "${d.name}"? It can't reach this server any more (its own copy of the projects stays on it). Add it again with a new invite.`)) return;
            await api('DELETE', '/devices/' + d.id);
            say(`Removed ${d.name}.`);
            refresh();
        }, 'danger')],
    )));
    if (!devices.length) $('#devices').append(emptyRow('None yet: make an invite, and scan it on the device.'));
    $('#devices_count').textContent = devices.length || '';

    // Server: settings (not refilled while being changed), starting with the computer, the key
    if (!$('#settings_form').contains(document.activeElement)) {
        $('#set_mode').value = settings.mode;
        $('#set_port').value = settings.port;
        $('#set_data').value = settings.data;
    }
    $('#settings_save').textContent = supervised ? 'Save and restart' : 'Save';
    $('#settings_hint').textContent = supervised
        ? 'Saving starts it again with these (a few seconds; from "any network" it gets a new address).'
        : 'Saved for the next start (it was started without serve.bat / serve.sh: start it again yourself).';
    $('#autostart').hidden = !autostart.available;
    $('#autostart').textContent = autostart.on ? 'Turn off' : 'Turn on';
    $('#autostart_hint').textContent = !autostart.available ? 'Not available on this system.'
        : autostart.on ? 'On: it starts by itself with the saved settings.' : 'Off: start it with serve.bat (serve.sh) when you need it.';
    $('#key_new').hidden = keyFromEnv;
}

// the projects kept on this server
async function renderProjects() {
    try {
        const { projects } = await call('/api/sync');
        $('#projects').replaceChildren(...projects.map(p => row(p.title || 'Untitled project', p.updatedAt ? `changed ${when(p.updatedAt)}` : '')));
        if (!projects.length) $('#projects').append(emptyRow('None yet: a device puts a project here from its settings (Sync › Put on server).'));
    } catch { /* shown as not answering by refresh */ }
}

// this server's appearance (its data's settings): this page drawn the same way as the app here, and its
// Appearance tab showing (and changing) them
async function pairAppearance() {
    try {
        const { data } = await call('/api/boot');
        if (data?.settings) {
            const text = JSON.stringify(data.settings);
            if (localStorage.getItem('research_board_settings') !== text) {
                localStorage.setItem('research_board_settings', text);
                Settings.apply();
            }
        }
    } catch { /* the default look */ }
    Appearance.mount($('#appearance'));
}

// a change made in the Appearance tab: kept in the server's data (what the app opened from it shows too); the
// colour pickers save as you let go, so a short wait gathers a burst of changes into one
let savingLook = null;
addEventListener('settingssaved', e => {
    if (!mainKey) return;
    clearTimeout(savingLook);
    savingLook = setTimeout(() => call('/api/kv/settings', 'PUT', e.detail).catch(err => say("Couldn't keep the look on the server: " + err.message)), 400);
});

async function refresh() {
    try {
        status = await api('GET', '');
        render();
        if (restarting) { restarting = false; say('Started again with the new settings ✓'); }
    } catch (err) {
        if (err.status === 401 || err.status === 403) return signIn('That key opens nothing here: enter the main key.');
        $('#status_dot').className = 'status_dot down';
        $('#status_text').textContent = restarting ? 'Starting again…' : 'Not answering';
        if (!restarting) say(`The server isn't answering (${err.message}). Is it still running?`);
    }
}

function signIn(message) {
    $('#control').hidden = true;
    $('#sign_in').hidden = false;
    if (message) say(message);
    $('#main_key').focus();
}

async function open(key) {
    mainKey = key.trim();
    try { sessionStorage.setItem(KEY, mainKey); } catch { }
    try {
        status = await api('GET', '');
    } catch (err) {
        $('#control').hidden = true;
        $('#sign_in').hidden = false;
        return alert(err.status === 401 || err.status === 403 ? "That isn't the main key." : `Couldn't reach the server: ${err.message}`);
    }
    $('#sign_in').hidden = true;
    $('#control').hidden = false;
    let tab = 'overview';
    try { tab = sessionStorage.getItem(KEY + ':tab') || tab; } catch { }
    showTab(tab);
    say('');
    render();
    renderProjects();
    pairAppearance();
}

// ---- doing things ----

$('#quick_invite').onclick = async () => {
    try {
        const { token, uses, minutes } = await api('POST', '/invites', { uses: 1, minutes: 20 });
        showInvite('quick_invite', token, uses, minutes, baseOf()[0].base);
        refresh();
    } catch (err) { say("Couldn't make an invite: " + err.message); }
};

$('#invite_form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
        const { token, uses, minutes } = await api('POST', '/invites', { uses: Number($('#invite_uses').value), minutes: Number($('#invite_minutes').value) });
        showInvite('invite', token, uses, minutes, $('#invite_address').value || baseOf()[0].base);
        refresh();
    } catch (err) {
        say("Couldn't make an invite: " + err.message);
    }
});
document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const ok = await copyText($('#' + btn.dataset.copy).value);
    btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
    setTimeout(() => { btn.textContent = 'Copy link'; }, 1600);
});

$('#settings_form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
        await api('PUT', '/settings', { mode: $('#set_mode').value, port: Number($('#set_port').value), data: $('#set_data').value });
        if (!status.supervised) return say('Saved: start the server again to use them.'), refresh();
        const port = Number($('#set_port').value);
        await api('POST', '/restart');
        restarting = true;
        say('Starting again…');
        // a new port: this page moves there with it
        if (port !== status.running.port) setTimeout(() => { location.href = `http://localhost:${port}/page/server.html#key=${encodeURIComponent(mainKey)}`; }, 3000);
    } catch (err) {
        say("Couldn't save: " + err.message);
    }
});

$('#autostart').onclick = async () => {
    try {
        const { on, when: time } = await api('PUT', '/autostart', { on: !status.autostart.on });
        say(on ? `It will start ${time}.` : "It won't start by itself any more.");
    } catch (err) { say("Couldn't change that: " + err.message); }
    refresh();
};

$('#key_show').onclick = () => {
    const shown = $('#main_key_shown').textContent === mainKey;
    $('#main_key_shown').textContent = shown ? '••••••••' : mainKey;
    $('#key_show').textContent = shown ? 'Show' : 'Hide';
};
$('#key_new').onclick = async () => {
    if (!confirm('Make a new main key? Devices added by invite keep working. Devices that were given the old key directly will need the new one.')) return;
    try {
        const { key } = await api('POST', '/key');
        mainKey = key;
        try { sessionStorage.setItem(KEY, key); localStorage.setItem('research_board_server_key', key); } catch { }
        $('#main_key_shown').textContent = key;
        $('#key_show').textContent = 'Hide';
        say('New main key made ✓');
    } catch (err) { say("Couldn't make a new key: " + err.message); }
};

$('#sign_in_form').addEventListener('submit', e => {
    e.preventDefault();
    open($('#main_key').value);
});

// ---- starting ----

// the QR library (src/vendor/qrcode.js)
document.head.append(Object.assign(document.createElement('script'), { src: '../vendor/qrcode.js' }));

const fromAddress = new URLSearchParams(location.hash.slice(1)).get('key');
if (fromAddress) history.replaceState(null, '', location.pathname); // (not left in the address bar or history)
let kept = '';
try { kept = sessionStorage.getItem(KEY) || ''; } catch { }
if (fromAddress || kept) open(fromAddress || kept);
else signIn();

// kept up to date: devices seen, invites used, and back after a restart
setInterval(() => { if (mainKey && !$('#control').hidden) { refresh(); renderProjects(); } }, 5000);

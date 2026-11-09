// Settings page: appearance (core/appearance.js: theme, style, colours, your own CSS, shared with the server's
// control page), sync with a server, and your data (backup, restore, delete). Data goes through core/store.js.

// ---- your data ----

const mb = bytes => (bytes / 1048576).toFixed(1) + ' MB';

function setDataState(text) {
    $('#data_state').textContent = text;
}

async function renderStorage() {
    const projects = Store.getProjects().length;
    const items = Store.getProjects().reduce((n, p) => n + Store.getItems(p.id).length, 0);
    const counts = `${projects} project${projects === 1 ? '' : 's'} and ${items} sources, notes and other items`;
    if (Store.mode === 'app') {
        $('#storage_where').textContent = 'Stored on this device';
        $('#storage_info').textContent = `${counts}, kept by the Research Board app on this device${window.RB_SERVER.dataDir ? `: ${window.RB_SERVER.dataDir}` : ''}. Back them up with a backup file below.`;
        return;
    }
    $('#storage_where').textContent = 'Stored on this computer';
    $('#storage_info').textContent = `${counts}, kept in the data folder by the Research Board server: ${window.RB_SERVER.dataDir}. Back it up by copying that folder, or with a backup file below.`;
}

$('#backup').onclick = async () => {
    const includeFiles = $('#backup_files').checked;
    setDataState(includeFiles ? 'Preparing the backup with your files…' : 'Preparing the backup…');
    try {
        const data = await Store.backup({ includeFiles });
        const text = JSON.stringify(data);
        downloadText(`research-board-backup-${new Date().toISOString().slice(0, 10)}.json`, text, 'application/json');
        setDataState(`Backup downloaded (${mb(text.length)}, ${Object.keys(data.files).length} files).`);
    } catch (err) {
        setDataState("Couldn't make the backup: " + err.message);
    }
};

$('#restore_file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let data;
    try {
        data = JSON.parse(await file.text());
    } catch {
        return setDataState("That file isn't a backup (it isn't JSON).");
    }
    const count = Array.isArray(data.projects) ? data.projects.length : 0;
    if (!confirm(`Replace everything here with this backup (${count} project${count === 1 ? '' : 's'})? What's here now will be deleted.`)) return;
    setDataState('Restoring…');
    try {
        await Store.restore(data);
        setDataState(`Restored ${count} project${count === 1 ? '' : 's'} ✓`);
        renderStorage();
    } catch (err) {
        setDataState("Couldn't restore: " + err.message);
    }
});

$('#delete_all').onclick = async () => {
    if (!confirm('Delete all projects, sources, notes and files in this browser? This cannot be undone. (Download a backup first if you might want them.)')) return;
    await Store.clearAll();
    setDataState('Everything was deleted.');
    renderStorage();
};

// ---- sync with a server (Store.syncLinks…, core/place/sync.js) ----

let connected = null; // { address, key, name, projects } once a connection worked

const setSyncState = text => { $('#sync_state').textContent = text; };
const projectTitle = id => Store.getProject(id)?.title || 'A project no longer here';
const ago = time => {
    if (!time) return 'not yet';
    const minutes = Math.round((Date.now() - time) / 60000);
    return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : new Date(time).toLocaleString();
};
function syncRow(title, detail, buttons, error = false) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = title;
    if (detail) {
        const small = document.createElement('small');
        small.textContent = detail;
        small.classList.toggle('error', error);
        label.append(small);
    }
    li.append(label, ...buttons);
    return li;
}
function syncButton(text, onClick, primary = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn small' + (primary ? ' primary' : '');
    button.textContent = text;
    button.onclick = async () => {
        button.disabled = true;
        try { await onClick(); } finally { button.disabled = false; }
    };
    return button;
}
const emptyRow = text => Object.assign(document.createElement('li'), { className: 'empty', textContent: text });
const counted = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const syncSummary = r => r.error ? r.error : `${counted(r.pulled, 'change')} came, ${counted(r.pushed, 'change')} went, ${counted(r.files, 'file')} copied`;

// whether each saved server answers (checked when the page opens): address → { ok, count } | { error }
const serverStatus = new Map();
const serverName = address => {
    const saved = Store.savedServers().find(s => s.address === String(address).replace(/\/+$/, ''));
    return saved?.name ? `${saved.name} (${address.replace(/^https?:\/\//, '').replace(/\/+$/, '')})` : String(address).replace(/^https?:\/\//, '').replace(/\/+$/, '');
};
async function checkServers() {
    await Promise.all(Store.savedServers().map(async s => {
        try { serverStatus.set(s.address, { ok: true, count: (await Store.serverProjects(s.address, s.key)).length }); }
        catch (err) { serverStatus.set(s.address, { error: err.message }); }
    }));
    renderSavedServers();
}

// the servers this device knows: their projects (what can go there, what can come here), invites, forgetting
let lastLinks = [];
function renderSavedServers() {
    const servers = Store.savedServers();
    const same = (a, b) => String(a).replace(/\/+$/, '') === String(b).replace(/\/+$/, '');
    $('#sync_saved').replaceChildren(...servers.map(s => {
        const synced = lastLinks.filter(l => same(l.server, s.address)).length;
        const status = serverStatus.get(s.address);
        const state = !status ? 'checking…' : status.ok ? `answering · ${counted(status.count, 'project')} on it` : `not answering (${status.error})`;
        const row = syncRow(s.name || s.address, `${s.name ? s.address + ' · ' : ''}${counted(synced, 'project')} synced here · ${state}`, [
            syncButton(connected?.address === s.address ? 'Projects ✓' : 'Projects', () => connect(s.address, s.key), connected?.address !== s.address),
            syncButton('Invite a device', () => showInvite(s)),
            syncButton('Forget', async () => {
                if (!confirm(`Forget ${s.name || s.address} and its key on this device? Projects synced with it keep syncing; to stop one, use its own settings.`)) return;
                Store.forgetServer(s.address);
                if (connected?.address === s.address) connected = null;
                renderSync();
            }),
        ], !!status?.error);
        return row;
    }));
    if (!servers.length) $('#sync_saved').append(emptyRow('None yet: add one below.'));
}

async function connect(address, key = '', { quiet = false } = {}) {
    if (!quiet) setSyncState('Connecting…');
    try {
        const { server, projects, moved } = await Store.connectServer(address, key);
        connected = { address: server.address, key: server.key, name: server.name, projects };
        serverStatus.set(server.address, { ok: true, count: projects.length });
        $('#sync_address').value = ''; // (added: it's under Your servers now)
        $('#sync_key').value = '';
        $('.sync_keybox').open = false;
        setSyncState(`Connected to ${server.name || server.address}: ${counted(projects.length, 'project')} there.`
            + (moved ? ` Its new address now syncs ${counted(moved, 'project')} that used the old one.` : ''));
    } catch (err) {
        if (!quiet) connected = null;
        setSyncState(quiet ? `${address} isn't answering right now (${err.message}). If its address changed, enter the new one.` : `Couldn't connect: ${err.message}`);
    }
    renderSync();
}

async function renderSync() {
    let links = [];
    try { links = await Store.syncLinks(); } catch (err) { setSyncState("Couldn't read the synced projects: " + err.message); }
    lastLinks = links;
    renderSavedServers();
    const linked = new Set(links.map(l => l.projectId));

    links.sort((a, b) => serverName(a.server).localeCompare(serverName(b.server)) || projectTitle(a.projectId).localeCompare(projectTitle(b.projectId)));
    $('#sync_links').replaceChildren(...links.map(link => syncRow(
        projectTitle(link.projectId),
        link.error ? `on ${serverName(link.server)} · last try failed: ${link.error}` : `on ${serverName(link.server)} · synced ${ago(link.syncedAt)}`,
        [syncButton('Stop syncing', async () => {
            if (!confirm(`Stop syncing "${projectTitle(link.projectId)}"? Both copies stay; this one won't get the server's changes any more.`)) return;
            await Store.unlinkProject(link.projectId);
            setSyncState('Stopped syncing ' + projectTitle(link.projectId));
            renderSync();
        })],
        !!link.error,
    )));
    if (!links.length) $('#sync_links').append(emptyRow("None yet: open a server above (Projects), or a project's own settings."));
    $('#sync_now').hidden = !links.length;

    $('#sync_choices').hidden = !connected;
    if (!connected) return;
    $('#sync_choices_title').textContent = `Projects on ${connected.name || connected.address.replace(/^https?:\/\//, '')}`;
    const link = { server: connected.address, key: connected.key };
    const here = Store.getProjects().filter(p => !linked.has(p.id));
    const there = connected.projects.filter(p => !linked.has(p.id) && !Store.getProject(p.id));

    $('#sync_up').replaceChildren(...here.map(project => syncRow(project.title || 'Untitled project', '', [
        syncButton('Put on server', async () => {
            setSyncState(`Putting "${project.title}" on the server…`);
            try {
                const result = await Store.linkProject(project.id, link);
                setSyncState(`"${project.title}" is on the server and synced: ${syncSummary(result)}.`);
            } catch (err) { setSyncState(`Couldn't put "${project.title}" on the server: ${err.message}`); }
            await refreshServerList();
        }, true),
    ])));
    if (!here.length) $('#sync_up').append(emptyRow('Every project here is synced.'));

    $('#sync_down').replaceChildren(...there.map(project => syncRow(project.title || 'Untitled project', '', [
        syncButton('Bring here', async () => {
            setSyncState(`Bringing "${project.title}" here…`);
            try {
                const result = await Store.linkProject(project.id, link);
                setSyncState(`"${project.title}" is here and synced: ${syncSummary(result)}.`);
            } catch (err) { setSyncState(`Couldn't bring "${project.title}" here: ${err.message}`); }
            await refreshServerList();
        }, true),
    ])));
    if (!there.length) $('#sync_down').append(emptyRow('Nothing else on this server.'));
}

async function refreshServerList() {
    if (connected) {
        try { connected.projects = await Store.serverProjects(connected.address, connected.key); } catch { }
    }
    renderSync();
}

$('#sync_form').addEventListener('submit', async e => {
    e.preventDefault();
    await connect($('#sync_address').value, $('#sync_key').value);
});

$('#sync_now').onclick = async () => {
    setSyncState('Syncing…');
    const results = await Store.syncNow().catch(err => [{ error: err.message }]);
    setSyncState(results.length
        ? results.map(r => `${projectTitle(r.projectId)}: ${syncSummary(r)}`).join(' · ')
        : 'Another open page is syncing right now.');
    renderSync();
};

// ---- QR codes: scanning a server's invite, showing one for another device ----
// (src/vendor: qrcode.js draws them, jsQR.js reads them where the browser has no BarcodeDetector of its own)

const vendorScript = (file, global) => window[global] ? Promise.resolve(window[global]) : new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '../vendor/' + file;
    script.onload = () => resolve(window[global]);
    script.onerror = () => reject(new Error(`couldn't load ${file}`));
    document.head.append(script);
});

let stopScan = null;
async function startScan() {
    stopScan?.();
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch (err) {
        return setSyncState(`Couldn't open the camera (${err.message}). Paste the invite link instead.`);
    }
    const video = $('#sync_video');
    $('#sync_scanner').hidden = false;
    video.srcObject = stream;
    await video.play().catch(() => { });
    const native = 'BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats?.().catch(() => []))?.includes('qr_code');
    const detector = native ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
    const read = detector ? null : await vendorScript('jsQR.js', 'jsQR');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const stop = () => {
        stream.getTracks().forEach(track => track.stop());
        $('#sync_scanner').hidden = true;
        if (stopScan === stop) stopScan = null;
    };
    stopScan = stop;
    const look = async () => {
        if (stopScan !== stop) return;
        let text = null;
        if (video.readyState >= 2 && video.videoWidth) {
            if (detector) text = (await detector.detect(video).catch(() => []))[0]?.rawValue;
            else {
                const scale = Math.min(1, 640 / video.videoWidth); // (smaller frames read faster)
                canvas.width = Math.round(video.videoWidth * scale);
                canvas.height = Math.round(video.videoHeight * scale);
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const image = context.getImageData(0, 0, canvas.width, canvas.height);
                text = read(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data;
            }
        }
        if (!text) return setTimeout(look, 250);
        stop();
        $('#sync_address').value = text;
        connect(text);
    };
    look();
}

async function showInvite(server) {
    setSyncState('Making an invite…');
    try {
        const { link, minutes } = await Store.inviteDevice(server.address, server.key);
        const qrcode = await vendorScript('qrcode.js', 'qrcode');
        const qr = qrcode(0, 'L');
        qr.addData(link);
        qr.make();
        $('#sync_invite_qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true, alt: 'Invite QR code' });
        $('#sync_invite_link').value = link;
        $('#sync_invite_note').textContent = `On the other device: Settings › Sync with a server › Scan QR code, or paste this link there. It works once, for ${minutes} minutes.`;
        $('#sync_invite').hidden = false;
        setSyncState('');
    } catch (err) {
        setSyncState("Couldn't make an invite: " + err.message);
    }
}

$('#sync_scan').hidden = !navigator.mediaDevices?.getUserMedia; // (a camera needs https, or the apps)
$('#sync_scan').onclick = startScan;
$('#sync_scan_stop').onclick = () => stopScan?.();
$('#sync_invite_close').onclick = () => { $('#sync_invite').hidden = true; };
$('#sync_invite_copy').onclick = async e => {
    const ok = await copyText($('#sync_invite_link').value);
    e.target.textContent = ok ? 'Copied ✓' : 'Copy failed';
    setTimeout(() => { e.target.textContent = 'Copy link'; }, 1600);
};

// a sync brought changes (here or in another tab): titles and times may have changed
addEventListener('storage', e => { if (e.key === 'research_board_projects') renderSync(); });

Appearance.mount($('#appearance'));

// ---- reading: the timer in reading passes (pages/material_passes.js) ----

$('#pass_timer_setting').checked = Settings.read().passTimer !== false;
$('#pass_timer_setting').addEventListener('change', e => Settings.save({ passTimer: e.target.checked }));

// ---- tabs: Appearance, Reading, Sync, Your data (a link to settings.html#sync opens that one; the last one is kept) ----

const TAB_KEY = 'research_board_settings_tab';
function showTab(name) {
    if (!$(`#tabs [data-tab="${name}"]`)) name = 'appearance';
    for (const tab of $$('#tabs [data-tab]')) tab.setAttribute('aria-selected', tab.dataset.tab === name);
    for (const panel of $$('[data-panel]')) panel.hidden = panel.dataset.panel !== name;
    try { sessionStorage.setItem(TAB_KEY, name); } catch { }
}
$('#tabs').addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) showTab(tab.dataset.tab);
});
addEventListener('hashchange', () => showTab(location.hash.slice(1)));
let firstTab = location.hash.slice(1);
try { firstTab ||= sessionStorage.getItem(TAB_KEY) || ''; } catch { }
showTab(firstTab);
renderStorage();
renderSync();
// the server used last: opened again by itself (its projects listed, nothing typed); the others checked
const lastServer = Store.savedServers()[0];
if (lastServer) connect(lastServer.address, lastServer.key, { quiet: true });
checkServers();

// back to the page that opened Settings
Nav.backLink($('#back_link'), '../index.html', 'Projects');

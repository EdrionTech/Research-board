// A project's own sync settings (its settings window on the home page, and "Project" on its dashboard): where it
// lives (this device only, or synced with a server), putting it on one of your saved servers, syncing now,
// stopping (the copy here stays, on this device only), and making a separate copy that isn't synced.
// Servers are added in Settings → Sync with a server (Store.connectServer); this picks from those.
//
//   ProjectSync.render(container, projectId, { settingsHref, onCopied(newId) })

const ProjectSync = (() => {
    const make = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    };
    const button = (text, onClick, primary = false) => {
        const btn = make('button', 'btn small' + (primary ? ' primary' : ''), text);
        btn.type = 'button';
        btn.onclick = async () => {
            btn.disabled = true;
            try { await onClick(); } finally { btn.disabled = false; }
        };
        return btn;
    };
    const ago = time => {
        if (!time) return 'not yet';
        const minutes = Math.round((Date.now() - time) / 60000);
        return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : new Date(time).toLocaleString();
    };
    const hostOf = address => { try { return new URL(address).host; } catch { return address; } };
    const counted = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

    async function render(container, projectId, options = {}) {
        const project = Store.getProject(projectId);
        if (!project) return container.replaceChildren();
        const state = make('p', 'sync_state');
        state.setAttribute('aria-live', 'polite');
        const say = text => { state.textContent = text; };
        if (options.message) say(options.message);
        // drawn again after a change, keeping what was just said
        const again = () => render(container, projectId, { ...options, message: state.textContent });

        let link = null;
        try { link = (await Store.syncLinks()).find(l => l.projectId === projectId) || null; } catch (err) { say("Couldn't read the sync settings: " + err.message); }
        const servers = Store.savedServers();
        const named = address => {
            const saved = servers.find(s => s.address === address);
            return saved?.name ? `${saved.name} (${hostOf(address)})` : hostOf(address);
        };

        const status = make('p', 'sync_status');
        const rows = make('div', 'sync_actions');
        if (link) {
            status.append(make('strong', null, 'Synced with ' + named(link.server)));
            status.append(make('small', link.error ? 'error' : null,
                link.error ? `Last try failed: ${link.error}` : `Last synced ${ago(link.syncedAt)}`));
            rows.append(
                button('Sync now', async () => {
                    say('Syncing…');
                    const results = await Store.syncNow().catch(err => [{ projectId, error: err.message }]);
                    const mine = results.find(r => r.projectId === projectId);
                    say(!mine ? 'Another open page is syncing right now.' : mine.error ? "Couldn't sync: " + mine.error
                        : `Synced: ${counted(mine.pulled, 'change')} came, ${counted(mine.pushed, 'change')} went, ${counted(mine.files, 'file')} copied.`);
                    again();
                }, true),
                button('Stop syncing', async () => {
                    if (!confirm(`Stop syncing "${project.title}"? The copy here stays, on this device only, and the server keeps its copy; changes no longer pass between them.`)) return;
                    await Store.unlinkProject(projectId);
                    again();
                }),
            );
        } else {
            status.append(make('strong', null, 'On this device only'));
            status.append(make('small', null, 'Put it on a server to have it on your other devices, kept in step.'));
            if (servers.length) {
                const pick = make('select', 'sync_server_pick');
                pick.setAttribute('aria-label', 'Server');
                for (const s of servers) pick.append(new Option(named(s.address), s.address));
                rows.append(pick, button('Put on server', async () => {
                    const server = servers.find(s => s.address === pick.value);
                    say(`Putting it on ${named(server.address)}…`);
                    try {
                        const result = await Store.linkProject(projectId, { server: server.address, key: server.key });
                        say(`On the server and synced: ${counted(result.pushed, 'change')} sent, ${counted(result.files, 'file')} copied.`);
                    } catch (err) {
                        say("Couldn't put it on the server: " + err.message + (/reach/.test(err.message) ? ' (if its address changed, connect to the new one in Settings)' : ''));
                    }
                    again();
                }, true));
            } else {
                const add = make('a', 'btn small', 'Add a server in Settings');
                add.href = (options.settingsHref || 'settings.html') + '#sync';
                rows.append(add);
            }
        }

        // edits that clashed while this device and another couldn't sync: the newer was kept; the other, here
        const clashes = make('div', 'sync_clashes');
        let found = [];
        try { found = await Store.conflicts(projectId); } catch { }
        if (found.length) {
            clashes.append(make('strong', null, `${counted(found.length, 'edit')} clashed`),
                make('small', null, 'Changed on two devices before they could sync. The newer change was kept; the one it replaced is below.'));
            for (const c of found) {
                const what = c.kind === 'project' ? 'The project' : describe(c.lost || c.kept);
                const card = make('div', 'sync_clash');
                card.append(
                    make('span', 'sync_clash_what', what),
                    make('small', null, (c.lostFrom === 'here' ? 'Your change here was replaced by a newer one from another device'
                        : 'A change from another device was replaced by your newer one here') + ` · ${ago(c.at)}`),
                    make('div', 'sync_clash_versions'),
                );
                const versions = card.lastChild;
                versions.append(version('Kept (now)', c.kept), version('Replaced', c.lost));
                const actions = make('div', 'sync_actions');
                actions.append(
                    button('Use the replaced one', async () => {
                        await Store.keepReplaced(c.id);
                        say('Brought back ✓ It syncs to your other devices now.');
                        again();
                    }),
                    button('Keep as it is', async () => {
                        await Store.dismissConflict(c.id);
                        again();
                    }),
                );
                card.append(actions);
                clashes.append(card);
            }
        }

        const copyRow = make('div', 'sync_copy');
        copyRow.append(
            make('small', null, link ? 'A separate copy here, not synced: change it without changing the shared one.'
                : 'A separate copy of this project, with its own files.'),
            button('Make a separate copy', async () => {
                const title = prompt('Name of the copy:', `${project.title} (copy)`);
                if (title == null) return;
                say('Copying…');
                try {
                    const id = await Store.copyProject(projectId, title.trim() || undefined);
                    say(`Made "${Store.getProject(id).title}" (on this device only).`);
                    options.onCopied?.(id);
                } catch (err) { say("Couldn't copy it: " + err.message); }
            }),
        );

        container.replaceChildren(status, rows, ...(found.length ? [clashes] : []), copyRow, state);
    }

    // a record, in a few words: a material's title, a note's start…
    const TYPES = { source: 'Material', source_note: 'Note', bookmark: 'Bookmark', figure: 'Figure', lit_review: 'Literature review' };
    function describe(record) {
        if (!record) return 'Something deleted';
        const name = record.title || record.quote || (record.body || record.text || '').replace(/[#*_>`[\]()!]/g, '').trim();
        return `${TYPES[record.type] || 'Note'}: ${(name || 'untitled').slice(0, 80)}`;
    }
    // one version's words (enough to tell them apart)
    function version(label, record) {
        const box = make('div', 'sync_version');
        box.append(make('small', null, label));
        const text = !record ? '(deleted)' : [record.title, record.quote, record.body, record.text, record.desc].filter(Boolean).join('\n\n').slice(0, 400) || '(no text)';
        box.append(make('p', null, text));
        return box;
    }

    return { render };
})();

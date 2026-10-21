// The library: every material, in your projects or on its own. A material added in the Library belongs to no
// project (projectId 'library': Store.LIBRARY_ID) until you add it to one. The same paper in several projects
// is one book (matched by DOI, arXiv id or title).
// Used by the Library page, a material's page ("Add to project") and the Literature tab ("+ From library").

const Library = (() => {
    const norm = text => (text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const keyOf = source => source.doi?.toLowerCase() || (arxivIdOf(source) && 'arxiv:' + arxivIdOf(source)) || 'title:' + norm(source.title);

    // [{ key, source (the most complete copy), copies: [{ source, project }], added }]
    function books() {
        const homes = [...Store.getProjects(), Store.getProject(Store.LIBRARY_ID)];
        const byKey = new Map();
        for (const project of homes) {
            for (const source of Store.getItems(project.id).filter(i => i.type === 'source')) {
                const key = keyOf(source);
                if (!byKey.has(key)) byKey.set(key, { key, copies: [] });
                byKey.get(key).copies.push({ source, project });
            }
        }
        return [...byKey.values()].map(book => {
            const best = [...book.copies].sort((a, b) => !!pdfFile(b.source) - !!pdfFile(a.source) || b.source.updatedAt - a.source.updatedAt)[0];
            return { ...book, source: best.source, added: Math.min(...book.copies.map(c => c.source.createdAt || 0)) };
        });
    }

    const bookOf = source => books().find(b => b.key === keyOf(source));
    const inProject = (book, projectId) => book.copies.some(c => c.project.id === projectId);

    // Adds a material to a project. On its own in the library: it moves there, with your notes on it.
    // Already in another project: that project keeps its copy, and this one gets its own (and its own file).
    // Resolves to the material's id in the project.
    async function addToProject(source, projectId) {
        if (source.projectId === Store.LIBRARY_ID) {
            for (const note of Store.getItems(Store.LIBRARY_ID).filter(i => i.sourceId === source.id)) {
                Store.saveItem({ id: note.id, projectId }, { touch: false });
            }
            Store.saveItem({ id: source.id, projectId });
            return source.id;
        }
        const { id, projectId: _from, createdAt, updatedAt, citekey, citedIn, ...fields } = source;
        let file = source.file;
        if (file?.assetId) {
            try {
                const blob = await Store.getAsset(file.assetId);
                file = blob ? { ...file, assetId: await Store.putAsset(blob) } : undefined;
            } catch {
                file = undefined;
            }
        }
        const copy = { ...fields, projectId, status: 'to_read' };
        if (file) copy.file = file;
        else delete copy.file;
        // an uploaded thumbnail is copied too (each copy can change or delete its own); the preview is remade;
        // where you were reading stays with the copy you read
        delete copy.preview;
        delete copy.readingAt;
        if (/^asset:/.test(copy.thumbnail || '')) {
            try {
                const blob = await Store.getAsset(copy.thumbnail.slice(6));
                copy.thumbnail = blob ? 'asset:' + await Store.putAsset(blob) : '';
            } catch {
                copy.thumbnail = '';
            }
        }
        return Store.saveItem(copy);
    }

    return { keyOf, books, bookOf, inProject, addToProject };
})();

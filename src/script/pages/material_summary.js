// Material page: the Summary in the notes side, one document in sections, each with its own Edit
// (writing/summary_editor.js). "Edit all" (the panel's own button, with the formatting bar) edits the whole document.
// The passes write into the same sections (material_passes.js), so whatever you change here shows in every pass,
// and the other way round.
// Uses material.js (source, citeSources, project, fieldValue, refresh); loaded before it.

const SummaryPanel = (() => {
    let editor = null;

    function setup() {
        editor = SummaryEditor.create($('.md_field[data-field="summary"] .md'), {
            get: () => fieldValue('summary'),
            save: summary => {
                Store.saveItem({ id: source.id, summary });
                refresh();
            },
            linkify: text => PaperLinks.withLinks(text, citeSources, project.citeStyle || 'apa'),
            empty: 'Nothing written yet. Reading in passes fills it in section by section, or write your own.',
        });
    }

    const render = () => editor?.render();

    return { setup, render };
})();

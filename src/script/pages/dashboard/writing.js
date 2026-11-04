// Project dashboard, Writing tab: what you write from the project (documenting the study; the Research tab is
// doing it). Your documents (the literature review, plus papers, chapters and reports: items of type 'draft'),
// each opened in the writing editor (review.html?id=<project>&doc=<id>) with the project's sources to cite,
// its figures and its exports. Under them, the tab's own sections (Outline, Notes for writing: dashboard.js).

const DRAFT_TEMPLATES = {
    paper: {
        label: 'Paper (IMRaD)',
        body: title => `# ${title}\n\n## Abstract\n\n\n## Introduction\n\n\n## Methods\n\n\n## Results\n\n\n## Discussion\n\n\n## Conclusion\n`,
    },
    chapter: {
        label: 'Thesis chapter',
        body: title => `# ${title}\n\n## Introduction\n\n\n## Section 1\n\n\n## Section 2\n\n\n## Summary\n`,
    },
    report: {
        label: 'Report',
        body: title => `# ${title}\n\n## Summary\n\n\n## Background\n\n\n## What we did\n\n\n## What we found\n\n\n## Recommendations\n`,
    },
    blank: { label: 'Blank', body: title => `# ${title}\n\n` },
};

const draftUrl = draft => 'review.html?id=' + encodeURIComponent(project.id) + (draft ? '&doc=' + encodeURIComponent(draft.id) : '');
// words written, leaving out citation keys
const wordsIn = text => ((text || '').replace(/\[@[^\]]*\]|@[\w:.-]+|!\[[^\]]*\]\([^)]*\)/g, ' ').match(/[\p{L}\p{N}'’-]+/gu) || []).length;

function renderWriting() {
    const review = items.find(i => i.type === 'lit_review');
    const drafts = items.filter(i => i.type === 'draft').sort((a, b) => b.updatedAt - a.updatedAt);
    // (only sources with a key can have been cited: giving the others keys here saved every one of them on load)
    const sources = items.filter(i => i.type === 'source' && i.citekey);
    const cited = text => {
        const keys = new Set([...(text || '').matchAll(/@([\w:.-]*\w)/g)].map(m => m[1]));
        return sources.filter(s => keys.has(s.citekey)).length;
    };
    const info = doc => {
        if (!doc?.body) return 'Not started yet';
        const n = wordsIn(doc.body);
        const c = cited(doc.body);
        return [`${n.toLocaleString()} word${n === 1 ? '' : 's'}`, c ? `${c} source${c === 1 ? '' : 's'} cited` : '', 'edited ' + new Date(doc.updatedAt).toLocaleDateString()].filter(Boolean).join(' · ');
    };
    const row = (doc, { title, own }) => {
        const li = el('li', 'draft_row');
        if (doc) li.dataset.id = doc.id;
        const text = el('div', 'draft_text');
        text.append(el('strong', '', title), el('small', '', info(doc)));
        const open = el('a', 'btn small primary', 'Open');
        open.href = own ? draftUrl(doc) : draftUrl(null);
        li.append(text, el('span', 'spacer'));
        if (own) {
            for (const [act, label] of [['rename', 'Rename'], ['delete', 'Delete']]) {
                const btn = el('button', 'link draft_' + act, label);
                btn.type = 'button';
                li.append(btn);
            }
        }
        li.append(open);
        return li;
    };
    $('#draft_list').replaceChildren(row(review, { title: 'Literature review', own: false }), ...drafts.map(d => row(d, { title: d.title || 'Untitled', own: true })));
}

$('#new_draft').onclick = () => {
    const form = $('#draft_form');
    form.reset();
    openModal(form);
    form.elements.title.focus();
};
$('#draft_form').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target.elements;
    const title = f.title.value.trim() || 'Untitled';
    const template = DRAFT_TEMPLATES[f.template.value] || DRAFT_TEMPLATES.blank;
    const id = Store.saveItem({ projectId: project.id, type: 'draft', title, body: template.body(title) });
    location.href = draftUrl({ id });
});
$('#draft_list').addEventListener('click', e => {
    const li = e.target.closest('.draft_row');
    const draft = li && items.find(i => i.id === li.dataset.id);
    if (!draft) return;
    if (e.target.closest('.draft_rename')) {
        const title = prompt('New name for this document:', draft.title || '');
        if (title?.trim()) {
            Store.saveItem({ id: draft.id, title: title.trim() });
            render();
        }
    } else if (e.target.closest('.draft_delete')) {
        if (!confirm(`Delete "${draft.title || 'Untitled'}"? What you wrote in it is lost.`)) return;
        Store.deleteItem(draft.id);
        render();
    }
});
for (const [value, { label }] of Object.entries(DRAFT_TEMPLATES)) $('#draft_form select[name="template"]').append(new Option(label, value));

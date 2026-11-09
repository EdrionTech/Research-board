# Reading in passes, and literature surveys

Based on S. Keshav, *How to Read a Paper* (2007): each paper is read up to three times, each pass deeper than the last, and you can stop after any of them. A literature survey uses the same passes across many papers.

## The three passes (built)

Turned on per material with **Passes** in the reader bar. A bar under the reader's shows the passes, a timer, and a button to the pass's form at the end of the reader.

| Pass | In the paper | The form |
| --- | --- | --- |
| 1 · Bird's-eye view (5–10 min) | Title, abstract, introduction and conclusion shown in full. Other sections fold to their headings; a click opens one (a *peek*, recorded) | The five Cs: Category, Context, Correctness, Contributions, Clarity. References you already know |
| 2 · Grasp the content (about 1 hr) | Everything except appendices and proofs | The main argument in your own words; key evidence (your highlights, pinned); each figure checked (axes labelled, error bars, meaningful); references to follow up, added to the project in one click |
| 3 · Re-implement it | Each run of main work is blurred behind a card: write what you expect, **Reveal**, then note how theirs differs (or **Skip**) | Your predictions; notes; assumptions, weak spots, missing citations, future work; optionally the outline from memory, compared with the contents |

Each form ends with a decision: **Go to the next pass**, **Enough** (stop here; offers to mark the material Done) or **Park it**, with an optional reason.

**Guided, never locked.** The passes can be taken in any order: a later pass marks the ones jumped over as *skipped*, and an earlier one is a re-read. No field is required. Folded and blurred sections open with a click. What you did is recorded, so the Literature tab shows how far each paper was really read ("Pass 2", "Stopped after pass 1", "Read in three passes").

**The timer** counts active time only: the page is shown and you did something in the last two minutes. It shows e.g. `6 min of 5–10 min`; once past the range it changes colour and asks "ready to decide?" (once, quietly). Pass 3 shows the time so far. It can be turned off in Settings → Reading.

### Sections and their roles

Sections come from the Contents (the PDF's outline or headings found in its text, arXiv's sections, Markdown headings in pasted text). Each gets a role from its heading:

- *Opening*: abstract, introduction
- *Background*: related work, background, preliminaries
- *Main work*: method, experiments, results… and any heading not recognised
- *Closing*: discussion, conclusion
- *References*, *Appendix*, *Other* (acknowledgements, declarations)

A subsection takes its parent's role unless its own name says otherwise. A single entry holding all the others (a PDF outline's root, usually the paper's title) counts as the opening. You can change any section's role in Contents; your tag wins. A heading that wasn't found can be marked with a right-click (**Mark as a section heading**), in a PDF or pasted text.

Sections fold in the views that flow as text: arXiv HTML, PDF read mode, pasted text. Turning passes on with a PDF's printed pages showing switches to read mode. In the printed pages, the pages with nothing to read in the pass are dimmed instead.

### Data

One record per material, its own item (so typing in it never clashes with an edit to the material, and each collaborator can later have their own):

```
{ type: 'passes', projectId, sourceId, on, pass: 1|2|3, state: 'reading'|'stopped'|'parked'|'finished',
  roles: { sectionKey: role }, marks: [{ title, level, place }],
  passes: { 1: { cs, refsKnown }, 2: { summary, evidence, figures, followUp },
            3: { predictions, notes, assumptions, weaknesses, missing, future, outline } } }
```

Every pass also keeps `activeMs`, `startedAt`, `doneAt`, `decision`, `reason`, `skipped` and `peeks`. A section key is its heading, cleaned up, plus its level, so it's the same in every view of the paper.

Code: `src/script/sources/passes.js` (the method, roles, the record), `src/script/pages/material_passes.js` (the material page), `src/style/passes.css`. Tests: `tests/passes.test.js`.

## Still to build

- **Survey board** on the project dashboard: seed papers, columns Unread → Pass 1 → Pass 2 → Pass 3 / Stopped, time per paper.
- **Key papers:** count the citations and authors shared by your pass 1 papers, and suggest the most cited ones you don't have yet. Needs one new piece: recognising the same cited work across papers when it isn't in the project (DOI, then arXiv id, then the cleaned-up title).
- **Review page:** a side panel of the five Cs and pass 2 summaries, each a click from a `[@key]` citation.
- Smaller: assumptions linked to highlights; marking headings in the arXiv HTML version; figure checks beside each figure in the paper; a `by` on the record once collaborators sign in.

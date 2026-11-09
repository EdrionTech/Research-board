# Reading in passes, and literature surveys

Based on S. Keshav, *How to Read a Paper* (2007): each paper is read up to three times, each pass deeper than the last, and you can stop after any of them. A literature survey uses the same passes across many papers.

## The three passes (built)

Turned on per material with **Passes** in the reader bar. A slim bar under the reader's shows the passes as steps (done, current, skipped), a timer, and a button to the pass's notes at the end of the paper. The notes open with a card saying which pass it is and what it's for, then your earlier passes (folded), then the pass's steps, numbered in the order you do them while reading, and end with the decision as three choices.

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

## The survey board (built)

Literature tab → **List | Survey**. The search, status, tag and author filters apply to the board too.

- **The four steps** along the top, from Keshav's survey: ① Seed papers (starred) → ② A first pass on each → ③ Find the key papers → ④ Two passes on the key papers. Each shows how far along it is ("2 of 3"); the first not done is highlighted with a line on what to do.
- **The board:** columns Not started · Pass 1 · Pass 2 · Pass 3 · Stopped or parked · Read in three passes. Cards move as you read (nothing is dragged). A card shows the title, author and year, your five-Cs *Category*, the time spent, and ★ to make it a seed. Seeds have a gold edge; key papers a badge.
- **Key papers:** from the references of every paper that has had its first pass, the works cited by two or more of them (the same work matched by DOI, arXiv id or cleaned-up title; ones already in the project aren't suggested), most cited first, with **+ Add** (looked up like a reference on a paper's page; it arrives as a key paper, cited in those papers). Under them, **authors who keep coming up** across those reference lists, each linked to their papers on Google Scholar.

Data: the seeds on the project (`surveySeeds: [sourceId]`); a key paper is a source with `surveyKey: true` and `citedIn`. Code: `src/script/sources/survey.js` (columns, steps, key papers), `src/script/pages/dashboard/survey.js` (the board), `References.identity` and `References.toSource` (shared with the material page). Tests: `tests/survey.test.js`.

## Still to build

- **Review page:** a side panel of the five Cs and pass 2 summaries, each a click from a `[@key]` citation.
- Smaller: assumptions linked to highlights; marking headings in the arXiv HTML version; figure checks beside each figure in the paper; a `by` on the record once collaborators sign in.

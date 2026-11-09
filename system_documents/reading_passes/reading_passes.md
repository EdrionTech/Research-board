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

### How the passes join the rest of the app

The passes are a way *into* what a material already has, not a second copy of it:

| What | Where it's kept | Also shown / set in |
| --- | --- | --- |
| How far you've read it | The material's **status**, set by the passes: in a pass or parked → Reading; stopped or finished → Done (without passes it's chosen by hand, as before) | The status picker, the Literature tab, the survey board's columns |
| The five Cs | The passes record | **First look**, at the top of the notes side; each source card on the literature review page |
| Pass 2's main argument | The material's **Summary** (`source.summary`) | The Summary box; "Insert summary" on the review page |
| Pass 3's close-out | The material's **Assessment** (`source.review`, Markdown: your notes, then a `### ` section per part) | The Assessment box (written by hand, its sections fill the pass's boxes); "Insert assessment" on the review page |
| References known / to follow up | Marks on the paper's one reference list (`ref.known`, `ref.followUp`) | The References panel (✓ Known, ✓ Follow up); a follow-up is a key paper on the survey board |
| Key evidence | A highlight colour: the project's evidence colour (`project.evidenceColor`, or the colour called "Evidence") | Every highlight, in the paper and on the Literature tab |
| A figure's checks | On the captured figure (`checks`) when there is one; otherwise on the passes record | The figure, wherever it's reused |
| Recurring authors (survey) | — | The Literature tab's author filter when they have papers here; Google Scholar when not |
| Time spent | The passes record, counted by the reader's one timer (`src/script/reader/timer.js`) | The pass bar; full-screen reading's clock is to use the same timer |

"Review" now means only the literature review: a material's own judgement is its **Assessment**.

### Data

One record per material, its own item (so typing in it never clashes with an edit to the material, and each collaborator can later have their own):

```
{ type: 'passes', projectId, sourceId, on, pass: 1|2|3, state: 'reading'|'stopped'|'parked'|'finished',
  roles: { sectionKey: role }, marks: [{ title, level, place }],
  passes: { 1: { cs, related }, 2: { figures }, 3: { predictions, outline } } }
```

Every pass also keeps `activeMs`, `startedAt`, `doneAt`, `decision`, `reason`, `skipped` and `peeks`. A section key is its heading, cleaned up, plus its level, so it's the same in every view of the paper. Records from before the join (with a summary, close-out or reference lists of their own) are moved into the material's fields the first time the material opens (`Passes.moveIntoSource`).

Code: `src/script/sources/passes.js` (the method, roles, the record, the Assessment's sections, reference marks), `src/script/pages/material_passes.js` (the material page), `src/script/reader/timer.js` (active time), `src/style/passes.css`. Tests: `tests/passes.test.js`.

## The survey board (built)

Literature tab → **List | Survey**. The search, status, tag and author filters apply to the board too. It follows section 3 of Keshav's paper, *Doing a literature survey*:

| Keshav | On the board |
| --- | --- |
| Find 3–5 recent, highly cited papers; one pass on each; read their related work; look for a recent survey | ① **Seed papers** (★, or **Find papers…**: an OpenAlex search of the last five years, the words in the title or abstract, most cited first, each **+ Add as seed**). ② **A first pass on each**: a seed paper's pass 1 also opens its background and related work, with a step for what the field has done. A paper that looks like a survey (its title, or your Category) offers **Use its references**: its whole reference list joins the key papers |
| Shared citations and repeated authors in their references are the key papers and researchers; find where the key researchers publish | ③ **Find the key papers**: works cited by two or more first-passed papers (matched by DOI, arXiv id or cleaned-up title), **+ Add**; **authors who keep coming up**, linked to Google Scholar; **where the field publishes**: the venues those references cite most (the same venue however it's written: NeurIPS, NIPS, Advances in Neural Information Processing Systems) |
| Scan the top venues' recent proceedings; with the key papers, make two passes | Click a venue: its papers of the last two years from OpenAlex, most cited first, **+ Add** (a key paper of the survey). ④ **Two passes on the key papers** |

- **The board:** columns Not started · Pass 1 · Pass 2 · Pass 3 · Stopped or parked · Read in three passes. Cards move as you read (nothing is dragged). A card shows the title, author and year, your five-Cs *Category*, the time spent, *Key paper* / *Survey*, and ★ to make it a seed.
- **Online:** Find papers and a venue's papers need the internet (OpenAlex); everything else works offline. When OpenAlex doesn't know a venue, or can't be reached, the popup says so and offers the same search on Google Scholar.

Data: on the project, `surveySeeds` and `surveyFrom` (the survey papers whose references you use), both `[sourceId]`; a key paper is a source with `surveyKey: true` (and `citedIn` when it came from references). Code: `src/script/sources/survey.js` (columns, steps, key papers, venues, the OpenAlex searches), `src/script/pages/dashboard/survey.js` (the board and the papers popup), `References.identity` / `toSource` and `fieldsFromOpenAlex` (shared). Tests: `tests/survey.test.js` (OpenAlex faked).

## Still to build

- **Review page:** a side panel of the five Cs and pass 2 summaries, each a click from a `[@key]` citation.
- Smaller: assumptions linked to highlights; marking headings in the arXiv HTML version; figure checks beside each figure in the paper; a `by` on the record once collaborators sign in.

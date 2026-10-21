# Citation style creator and editor

Status: **next session.** Create, edit and import citation styles (APA, MLA, IEEE… and your own), including from uploaded templates and examples.

## Today

Styles are code: `src/script/sources/cite.js` has APA 7, MLA 9, Harvard, IEEE and BibTeX written as functions. Adding or changing one means editing code, and each style knows a few kinds of material (articles, videos…) at most.

## The idea: styles as data, in the standard format

Use **CSL (Citation Style Language)**, the format Zotero, Mendeley and Pandoc use:

- **Thousands of ready styles** (the Zotero style repository): every journal's house style, university variants, APA 7, Chicago, Vancouver, Nature… Importing one is uploading its `.csl` file, or picking it from a search.
- **Your own styles** are CSL files too, so they can be exported and used in Zotero or Word, and the other way round.
- **Rendering** with citeproc-js (the library Zotero uses): the reference list and in-text citations (parenthetical, narrative, numbered), in the review, the bibliography export and "Copy citation".
- Materials are given to it as CSL-JSON. That's a short mapping from the material fields (model/literature material.json), including kinds the app doesn't format today (books, chapters, theses, reports, web pages, datasets).

The built-in styles become CSL files shipped with the app, so nothing changes for existing projects.

## Creating and editing a style

**Start from a style:** "Copy APA 7 and change it" is the common case.

**Visual editor** for what people actually change, with a live preview of real references from the project:
- **Authors:** how many before "et al.", initials or full names, order (Last, F. / F. Last), "and" or "&", Oxford comma.
- **The date:** where it goes, year only or full date, "n.d.".
- **The title:** sentence or title case, italics or quotes.
- **The source** (journal, volume, issue, pages), DOI or URL, and "Retrieved from".
- **Punctuation and order** of the parts, per kind of material.
- **In-text citations:** (Author, year), numbered [1], footnotes; page locators; how several citations are combined and sorted.
- **The reference list:** sorting, hanging indent, numbering.

**Code view** for the full CSL, for anything the visual editor doesn't cover.

## From templates and examples

- **Upload a `.csl` file:** used as it is.
- **Upload a template or guide** (a journal's author instructions, a university's referencing guide as PDF or Word): the example references in it are found and used as below.
- **Paste or upload example references** ("this is how my department wants them"): the app matches them to materials it knows (or reads their parts: authors, year, title, journal, pages) and works out the pattern (order, punctuation, author format, italics). It starts the new style from the closest existing one, adjusts it, and shows the examples next to the result so differences are visible. AI can help with harder cases later (see ../ai/ai.md).

## Where styles live

- **Kept with the data** (SQLite next session), so they work offline and move with backups. A project's citation style can be any of them.
- **Per user**, like the library: your styles in every project. Sharing styles with others comes with the rest of collaboration (on hold).
- **The project's citation style** setting (Literature tab, review editor, material pages) lists the built-in, imported and your own styles.

## Decided

- **citeproc-js is kept in the app** (shipped with it, not loaded from the internet), so styles work offline in every client.
- **The common styles ship built in:** APA 7, MLA 9, Harvard, IEEE, Chicago, Vancouver (and BibTeX export as now). Others are imported as `.csl` files.
- **"From examples", first version:** match your examples against the styles the app has, start from the closest and adjust the obvious differences (author format, "&" or "and", where the year goes, italics, punctuation), showing your examples next to its output. AI for examples unlike any known style comes later with the other AI features.

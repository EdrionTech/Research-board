# AI features (future)

Status: **notes only, not started.** Ideas to come back to once storage and collaboration settle (see [../collaboration/collaboration.md](../collaboration/collaboration.md)).

## Auto-tagging when papers are added

When a material is added (link, DOI, upload, from the library, from a paper's references), suggest tags from its title, abstract, keywords and venue, and later from its full text.

- **Suggested, not applied silently.** Tags appear as chips in the add-source form and on the material's page; one click accepts or dismisses them. A per-project setting can switch to "apply automatically".
- **The project's tags come first.** It prefers tags the project already uses before inventing new ones, so tagging stays consistent.
- **It learns from you.** Dismissed suggestions are remembered per project and not offered again.
- **Batches are fine.** Adding many references at once tags them in the background, with a summary to review.

## Tag clustering (no tag sprawl)

Tags drift: `RL`, `reinforcement learning`, `Reinforcement-Learning`, `rl methods`.

- **Near-duplicates are grouped**: spelling, case, plurals, abbreviations and synonyms (by meaning, not just letters). A cleanup view proposes merges, e.g. "merge 4 tags into *reinforcement learning* (23 materials)".
- **Hierarchy can be suggested**, e.g. *manipulation* › *grasping*, so filters can work at either level.
- **New tags are checked as they're typed.** "Did you mean *grasping*?" before a new near-duplicate is created.
- **A soft limit per project** (a few dozen active tags), with the rarest or closest ones offered for merging.
- **Merges are undoable**, and each tag keeps a record of the names it absorbed, so old filters and citations of tags still resolve.

## A platform an AI agent can use fully

Everything a person can do, an agent should be able to do, through the same rules.

- **One documented set of actions over the data.** List and search projects, materials and notes; add a material (with lookup); attach notes and highlights to a place; write the summary and review; cite; tag; bookmark; export. These are the server API (`apps/server/README.md`) plus higher-level actions, not screen scraping.
- **An MCP server** exposing those actions as tools, so Claude or another assistant can work in your Research Board: "find the papers on grasping I haven't summarised and draft summaries", "which notes cite Vaswani et al.?".
- **Stable, described data.** The item types and fields are documented (model/literature material.json is the start), each record says who made or changed it (person or agent), and places in materials use the same format the app uses (page and position, paragraph, line, time).
- **Permissions like a collaborator.** An agent gets a role (viewer, commenter, editor) per project. Its changes are labelled and can be reviewed and undone; large changes (bulk tagging, merging, deleting) are proposed first and applied after you accept them.
- **Text it can read.** Materials keep their extracted text (PDF lines, HTML paragraphs, transcripts), so an agent reads exactly what the reader shows, with positions to cite.

## Other ideas (etc.)

- **Summaries:** a first draft from the paper and your highlights, which you edit in the summary pad.
- **Related papers:** from the references and citing papers (OpenAlex), ranked against the project; "you cite X but not Y, which most of your papers cite".
- **Questions to the project:** answers drawn from your materials and notes, with citations to the passages.
- **Review checks:** unsupported claims, a citation that doesn't say what the sentence says, missing references, consistency of terms.
- **Highlight help:** suggest a colour (meaning) for a new highlight from what you've coloured before.
- **Reading plan:** what to read next for a section you're writing.

## Constraints to keep in mind

- **The AI is a helper, never the only copy.** Your text stays yours. AI output is marked as suggested or AI-written until you accept or edit it.
- **Privacy.** Choose what is sent to which model, per project. Works fully without AI. A local model option for self-hosted setups.
- **Cost.** Batch and cache work (tags, embeddings) and don't redo it for unchanged materials.
- **Where it runs.** On the server (self-hosted or online) so every device gets the same results; a browser-only setup can call a model directly with your own key.

# Research tab (to discuss, not started)

Status: proposal (2026-10-29). Recorded for discussion; nothing built.

## The proposal

The Research tab is where researchers plan, manage and track the actual work of a study: from designing the methodology to collecting data, analysing results and evaluating findings. Each project has its own workflow, adapted to its methodology, instead of one fixed sequence for every project.

1. **Workflow.** A customisable sequence of stages. A system-interaction study might go: protocol design, ethics approval, pilot testing, participant sessions, coding review, data cleaning, analysis. A multi-agent maze simulation study might go: experimental design, simulation setup, testing under varying conditions, data collection, performance analysis, evaluation. Stages can be added, removed, reordered or revisited.
2. **Tasks.** Activities with deadlines, progress and dependencies (defining observation categories, preparing coding guidelines; configuring scenarios in Unity, running simulations). Linked tasks are done in the right order.
3. **Research assets.** Documents, datasets, scripts, images, logs and other files in one place, each linked to the activity it belongs to (observation protocols, coding manuals, cleaned datasets; CSVs, simulation logs, agent trajectories exported from Unity). No integration with outside tools needed.
4. **Data & analysis.** Tracking data preparation, methods, results and findings, even when the analysis itself is done in other software (completion times, success rates, path lengths, collision counts across maze configurations). Outputs are uploaded and linked to their datasets and experiments.
5. **Change log.** Methodological decisions, revisions and their consequences: an ambiguous observation category that means revising the coding protocol (and maybe recoding earlier records), or a parameter or metric changed after finding a limitation. It keeps the reasoning and shows which activities, datasets and analyses are affected.

**Core principle:** one consistent system for workflows, tasks, assets, analysis and decisions, with each project defining its own process. The Research tab is about *conducting* the study; the Writing tab is about *documenting* it. The two stay connected so activities, evidence and findings can be referenced in the paper without being copied.

## Notes (Claude, 2026-10-29)

- **It completes the dashboard.** Literature (reading) → Research (doing) → Writing (reporting). The Writing tab is still empty, so the link between them can be designed at the same time.
- **It fits the storage as it is.** Every record is an item with a `type` and a `projectId` in `place.js`, so stages, tasks, assets, decisions and findings are new item types: no new tables, and they sync, back up and (later) get collaborated on like everything else. Uploaded assets use the existing file storage (kept once by content).
- **One kind of link does most of the work.** Tasks depending on tasks, an asset belonging to a stage, a finding coming from a dataset, a decision affecting a stage, a paragraph in the paper citing a finding: all are "item A links to item B". A single link field (or link items) used everywhere keeps it simple, and the Writing tab can cite a finding or decision the way it cites a paper.
- **Stages are lightweight.** A stage can be a named group of tasks with a status, so "workflow" and "tasks" are one feature with two views (the stage line and the task list), not two systems.
- **Templates, not fixed workflows.** The two example studies make good starter templates ("interaction study", "simulation study", blank), and a project's workflow can be saved as a template.
- **The change log earns its keep through "affected".** When a decision is logged, ticking what it affects (stages, datasets, analyses) can mark them "needs review" until someone clears them. That's the part a plain notes page can't do.
- **Watch the scope.** This can grow into a full project-management tool. A suggested order: (1) stages + tasks, (2) assets linked to them, (3) change log with "affected", (4) data & analysis (mostly assets + findings + links), (5) citing them from Writing.
- **Later, with collaboration:** assigning tasks to members, and per-person progress.

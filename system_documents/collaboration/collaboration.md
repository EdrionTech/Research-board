# Collaboration

Status: **on hold.** Recorded to see the way forward; nothing here is being built for now. Later, a **Collab** button will show where it goes, so people can see it's coming.
Working on projects together. Where data lives (places, SQLite, the apps, signing in) is in [../platforms/platforms.md](../platforms/platforms.md): collaboration builds on it.

## A project lives in one place

Each project lives in one **place**: this device, our online service, or a private server. Everyone working on it connects to that place. Places don't sync with each other (federation is out of scope).

| Place | How people collaborate |
| --- | --- |
| This device | Not live: export a project file, import it elsewhere (merging) |
| A private server | Accounts on that server, joined with an invite link from its host |
| Our online service | Accounts; invite people to a project by link (email later) |

One person can have projects in several places; the app reaches each. Collaboration needs an account on an online place, but using the app on its own never does.

## What is shared and what is per person

A project is collaborative: **everything in it is shared**, notes included.

| Shared with the project | Each person's own |
| --- | --- |
| Materials (details, abstract, PDF, thumbnail) | Reading status (to read / reading / done) |
| All notes: highlights, questions, overview and research notes, quick notes | Where they are in each material (continue reading) |
| Highlight colours and their meanings | Theme, style, colours, reader zoom, shelf view |
| The literature review and figures | Their library |
| Tags, citation style | |

Bookmarks are shared like notes for now; they could become personal later.

Every record keeps who made it and who last changed it, so shared notes and highlights show their author.

**Libraries belong to a person**, and can be shared with others, who can take materials from them (a copy) into their own library or projects. See [../platforms/platforms.md](../platforms/platforms.md).

## Edits at the same time

| Data | Approach |
| --- | --- |
| Small records (a material's details, a note, a caption) | The newer edit wins, record by record (`updatedAt`) |
| Long shared text (the literature review) | Live co-editing with Yjs, which merges everyone's typing |
| Deletes | Kept as a "deleted" marker until every device has seen it, so an offline device can't bring a record back |

Changes travel as "changes since point N" when a page opens or comes back online, plus live updates while it's open (WebSockets).

## Roles

| Role | Can |
| --- | --- |
| Owner | Everything, plus managing members and deleting the project |
| Editor | Edit everything in the project |
| Commenter | Highlight, take notes, comment |
| Viewer | Read |

The server enforces roles, not the app. Comment threads on a highlight fit here.

## PDFs

- PDFs in a project are shared with its members (like a team drive), never public and never visible across projects.
- A file is stored once, matched by its content, however many people upload it.
- File storage is the cost limit on our online service, so teams with many PDFs may prefer a private server.

## Data model (prepared by the platforms work, before any sharing exists)

- Ids that can't collide across devices.
- `created_by` and `updated_by` on every record.
- A server-assigned change number on every change, for "changes since N".
- Deleted markers instead of removing records.
- Per-person state split out: reading status, where you are in each material, settings, the library.
- The literature review stored so Yjs can be added without converting it.

Tables, the same in every place: `projects`, `items`, `settings`, `files`, `changes`, plus for collaboration `members` and `user_state`.

## Order (after the platforms build order)

1. **The Collab button**, in place and explaining what's coming (can be done any time).
2. **Members and roles** on the server, and inviting people to a project.
3. **Per-person state:** reading status and where you are in each material.
4. **Live updates** while a project is open.
5. **Live co-editing of the literature review** with Yjs.
6. **Sharing libraries** with other people.
7. **Project file export and import** for people with no online place.

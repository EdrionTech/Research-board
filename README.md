<img src="src/assets/logo.svg" alt="Research Board logo" width="96">

# Reasearch Board

## Description

This is meant to be a research dashboard / journal/ aider for tracking your research progress. It is a simple web application that allows you to create, read, update, and delete research entries. Each entry can contain a title, description, and tags for easy categorization.

Its menant to hlp read, review journal/note lmarterials during literature review. as well as analysing and tracking your research progress.

IT is also intended to help with document creatio
n, by providing a simple interface to create and manage research notes and documents.

## Features

- Create, read, update, and delete research entries
- Literature analysis, tracking, noting, and reviewing

## Running it

Needs [Node.js](https://nodejs.org) 18 or newer; nothing else to install.

Double-click `start.bat` (Windows) or run `./start.sh` (macOS, Linux): the app opens in your browser at <http://127.0.0.1:5500/>. Or run it yourself:

```sh
node apps/server/server.js
```

Your data (projects, materials, notes, uploaded PDFs and images) is kept in the `data/` folder next to this file. Back it up by copying that folder. The first time, the app offers to bring in anything an earlier version saved in your browser.

## Building the apps

`build.bat` (double-click for a menu) builds the Android app, the Windows installer and the server version into `builds/`, says which builds are older than the code, and runs the tests. See [apps/README.md](apps/README.md).

| Folder | |
| --- | --- |
| `src/` | The app itself, the same in the browser and in every app |
| `apps/` | What builds or runs it: `server/`, `desktop/`, `phone/` and the build script |
| `tests/` | The tests ([tests/README.md](tests/README.md)) |
| `system_documents/` | Plans and the [roadmap](system_documents/roadmap.md) |
| `data/`, `builds/` | Your data and finished builds (not in git) |

Opening `src/index.html` directly, or with Live Server, still works, but then the data is kept only in that browser at that address. See [apps/server/README.md](apps/server/README.md) for options and the API.

# Disclaimer

- This projecct is still in early stages and will be built over time
- This project may have AI usage to aid in development

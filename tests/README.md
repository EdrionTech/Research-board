# Research Board tests

```powershell
build.bat test        # from the project folder: installs the test tools the first time, then runs them all
```

Or here: `npm install` once, then `npm test` (all), `node run.js api` (only the files whose names include "api"), or `node api.test.js` (one file). Needs Node 22.13+ and Edge or Chrome (any other Chromium browser with `BROWSER=<path to it>`). Nothing is downloaded but `playwright-core`.

Each test file starts its own server on a spare port with a new, temporary data folder holding the sample in [helpers.js](helpers.js). Your `data/` folder is never used.

| File | Checks |
| --- | --- |
| `api.test.js` | The server API and its SQLite storage: saving, older saves and deletes, files kept once, the changes feed, restart, restore and clear |
| `pages.test.js` | Every page opens with no errors, shows the data and saves a change; without the server, the pages say how to start it |
| `offline.test.js` | With the internet refused (as in the apps): the libraries, PDF.js and each style's font still load |

`node shots.js` (or `npm run shots`) isn't a test: it saves phone-size (Pixel 7) and desktop screenshots of the main pages into `shots/` (not in git), for checking layouts by eye.

A new test file: name it `<topic>.test.js`, use `startServer`, `launchBrowser` and `tester` from `helpers.js`, and it's picked up by `run.js`. When a feature changes, update its test and delete checks that no longer describe the app.

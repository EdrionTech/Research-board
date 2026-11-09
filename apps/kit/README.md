# The kit

One launcher to run, host, build and release a project made of a **web app** and the shells around it: a **Bun server**, a **Tauri desktop app**, a **Capacitor phone app**. Nothing in this folder knows about any one project. Everything project-specific is in `project.json`, beside this folder.

```text
run.bat / run.sh                  the launcher (the project's top folder): finds Bun, installing it the first time
<somewhere>/project.json          the project: its name, version, and where each part is
<somewhere>/kit/                  this folder
  kit.js                          the tasks and the menu
  lib/util.js                     messages, running programs, newest file, .zip
  lib/tools.js                    finding Rust + the Tauri tool, Java 21+, the Android SDK (Windows, macOS, Linux)
  targets/server.js               open, host, build server
  targets/tauri.js                build desktop, dev desktop, icons
  targets/capacitor.js            build phone, build phone-release, sync phone; build ios, build ios-release, sync ios, open ios
```

In Research Board, `project.json` and `kit/` are in `apps/`, with the server, desktop and phone projects and `builds/`.

## Using it

Double-click `run.bat` (Windows), or run `./run.sh` (macOS, Linux), for a menu that also says which builds are older than their code. The menu comes back after each task (a failed one too) until you press Enter on its own or type `q`. Tasks that keep running (`browser`, `dev browser`, `host`, `dev desktop`) get a window of their own on Windows, so the menu stays usable; on macOS and Linux they run in place and Ctrl + C brings the menu back. Or name a task:

| Task | What it does |
| --- | --- |
| `browser` | Start the server here and open the app in the browser (`open`, its old name, still works) |
| `dev browser` | The same, and the page reloads itself when the web folder changes: the server is given `server.dev` (`"dev": "--dev"`), offered only when that's set |
| `host [options]` | The server for other devices (its own options, passed on: in Research Board `--public`, `--start`, `--autostart`, `--no-autostart`) |
| `build server` | The server version, ready to copy elsewhere: `builds/host/` and `<file>-<version>-host.zip`. Started once to check it answers |
| `build desktop [options]` | The app for the system it's built on: Windows `-setup.exe` and `.msi`; macOS `.dmg` and `-mac.app.zip`; Linux `.AppImage`, `.deb`, `.rpm`. Options go to `cargo tauri build` (e.g. `--target universal-apple-darwin`: one Mac app for Intel and Apple silicon) |
| `dev desktop` | The desktop app from the code, without installing (`cargo tauri dev`) |
| `icons <file>` | Every icon size from a square SVG or a 1024 px PNG, for the desktop app and the phone's launcher |
| `build phone` | Android, for testing: `<file>-<version>-debug.apk` |
| `build phone-release` | Android, to share: smaller and signed with the release key, `<file>-<version>.apk` |
| `sync phone` | Copy the web app into the Android project without building (then Android Studio) |
| `build ios` | iPhone and iPad, for your own devices: `<file>-<version>-dev.ipa` (Mac only) |
| `build ios-release` | iPhone and iPad, for TestFlight and the App Store: `<file>-<version>.ipa` (Mac only) |
| `sync ios`, `open ios` | Copy the web app into the Xcode project; open it in Xcode (Mac only) |
| `build all` | `build server`, `build desktop`, `build phone` |
| `release` | The tests (nothing is built if one fails), then the release builds of this system (on a Mac: the Mac app and, with a team set, iOS), the notes and `SHA256SUMS.txt` in `builds/releases/<version>/` |
| `status` | Which builds are missing, or older than the code they're made from |
| `test [words]` | The tests |
| `clean` | Empty `builds/` |
| `help` | The tasks this project has |

A task is offered only when its part of the project exists. The server version (`build server`) carries the kit and the launcher with it, marked `"bundle": true`, so on the other computer `run` offers only `browser` and `host`.

### Releases

1. Raise `version` in `project.json`. It's the one version for every build: the file names, the desktop app (written into `tauri.conf.json` before it builds) and the phone apps (Gradle's `-PappVersion` and `-PappVersionCode`, Xcode's `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`; `0.2.0` → `200`).
2. Write its notes: `<releaseNotes>/<version>.md`.
3. `run release`.

```text
builds/
  releases/
    0.2.0/          every release made: the files, RELEASE-NOTES.md, SHA256SUMS.txt
    0.3.0/
    latest/         a copy of the highest version (with VERSION); re-making an older one leaves it alone
  <file>-<version>-debug.apk, …   the single builds (run build …)
  host/                           the server version as a folder
```

**The phone's release key** is made the first time, in `<phone>/keystore/`, with random passwords beside it in `keystore.properties`. Keep it out of git and **back that folder up** elsewhere: Android installs an update only when it's signed with the same key.

## `project.json`

```jsonc
{
  "name": "Research Board",            // shown in the menu; the release key's name
  "fileName": "ResearchBoard",         // the start of every build's file name (default: the name without spaces)
  "version": "0.2.0",
  "root": "..",                        // the project's top folder, from this file ("." by default)
  "web": "src",                        // the web app (every path below is from the top folder)
  "builds": "apps/builds",             // where builds go ("builds" by default)
  "releaseNotes": "system_documents/releases",
  "server":  { "dir": "apps/server", "start": "server.js", "host": "serve.js", "health": "/api/health", "dev": "--dev",  // dev: the option for dev browser
               "bundle": ["*.js", "*.sh", "README.md"] },  // the server folder's files in the server version
  "desktop": { "dir": "apps/desktop/src-tauri" },
  "phone":   { "dir": "apps/phone", "key": "research-board",    // key: Android's release key alias
               "ios": { "team": "" } },                        // your Apple team ID, for iOS builds
  "tests":   { "dir": "tests", "run": "run.js" }
}
```

Leave out any part a project doesn't have. (JSON has no comments: the ones above are only for reading.)

What each part has to be:

- **server**: `start` is run with Bun from the top folder as `bun <dir>/<start> --open` and should open the browser itself. In the check of the server version it gets `PORT` and `DATA` (an empty folder) in its environment and should answer `GET <health>` with 200. `host` is run as `bun <dir>/<host> [options]`.
- **desktop**: a Tauri 2 `src-tauri` folder whose `frontendDist` points at the web folder.
- **phone**: a Capacitor folder (`capacitor.config.json`, `webDir` pointing at the web folder, `android/` and/or `ios/`), its build tools in its own `package.json`. Its `android/app/build.gradle` reads the version (`project.findProperty('appVersion')`, `'appVersionCode'`) and signs release builds with `../keystore/keystore.properties` when it's there. `ios/` is Capacitor's own (`cap add ios`, which works on any system); Xcode signs it automatically for `ios.team` (or `APPLE_TEAM_ID`).
- **tests**: a folder whose `run` file runs them with Bun and exits non-zero if one fails. Its `package.json` packages are installed the first time.

## What it needs

Bun always (the launcher installs it). The kit finds the rest in the usual places, or by `JAVA_HOME` and `ANDROID_HOME`.

| To build | On | Needs |
| --- | --- | --- |
| The server version | any system | nothing more |
| Windows app | Windows | Rust (the Tauri tool is installed the first time), Microsoft C++ Build Tools |
| Mac app | a Mac | Rust, Xcode's command line tools (`xcode-select --install`) |
| Linux app | Linux | Rust and the system's web view packages (the kit names them if they're missing; [Tauri's list](https://v2.tauri.app/start/prerequisites/)) |
| Android app | any system | Android Studio with its SDK, Java 21 or newer |
| iOS app | a Mac | Xcode, and an Apple ID in Xcode > Settings > Accounts (free: your own devices, 7 days at a time; the paid developer program: TestFlight and the App Store) |

Each desktop app is built on its own system (Tauri doesn't build one system's app on another). **Signing:** without Apple's details, the Mac app is signed "ad hoc": it runs, but other Macs warn before opening it the first time. Tauri signs and notarizes it properly when these are set: `APPLE_SIGNING_IDENTITY` (a "Developer ID Application" certificate in the keychain) and `APPLE_ID`, `APPLE_PASSWORD` (an app-specific password), `APPLE_TEAM_ID`. The Windows installer is unsigned (Windows SmartScreen warns once).

## Reusing it in another project

Copy `run.bat`, `run.sh` and this folder, put a `project.json` beside the folder (with `root` pointing at the top folder), and add `builds/` and the phone's `keystore/` to `.gitignore`. To make it a git template, those files with a starter `src/` and an `apps/` like this one are enough.

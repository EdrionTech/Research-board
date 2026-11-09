# Research Board apps

Everything that builds or runs Research Board is here: the three apps, [the kit](kit/README.md) that runs and builds them, its [project.json](project.json), and the finished builds (`builds/`, not in git). Each one serves or wraps `src/` unchanged and keeps its data in SQLite with the same storage code ([src/script/core/place/place.js](../src/script/core/place/place.js)). `src/script/core/boot.js` notices which one it's running in and loads its adapter.

| | Folder | Built with | Its storage adapter |
| --- | --- | --- | --- |
| Server (the browser version here; later private servers and the online service) | `server` | Bun, no packages | `place-bun.js` → `bun:sqlite` |
| Desktop (Windows, macOS, Linux) | `desktop/src-tauri` | Tauri (Rust shell) | `sql-tauri.js` → `src/main.rs` |
| Phone (Android; iOS on a Mac) | `phone` | Capacitor | `sql-capacitor.js` → the SQLite and Filesystem plugins |

## Running and building: `run`

`run.bat` (Windows; double-click it for a menu) or `./run.sh` (macOS, Linux) in the project folder is the one launcher. `run browser` starts the app here in your browser (`run dev browser`: the page reloads itself as you change `src/`), `run host` serves it to other devices, and `run build phone`, `build desktop`, `build server` or `build all` build into `apps/builds/` (not in git). The work is done by [the kit](kit/README.md) (`kit/`, reusable in other projects), which reads [project.json](project.json): the name, **the version** and where each part is. It finds Bun, Rust, Java and the Android SDK by itself.

**`run status`** (also shown at the top of the menu) says which builds are missing or **older than the code they're made from**. A build only has the code as it was when it was built: after changing `src/`, the browser shows the change straight away, but the phone and desktop apps only once they're rebuilt and reinstalled.

`run test` runs the tests in [../tests](../tests/README.md).

### A release

1. Raise `version` in [project.json](project.json) (the one version for every build: the file names, the desktop app, and the phone app's version name and number).
2. Write its notes: `system_documents/releases/<version>.md`.
3. `run release`: the tests first (nothing is built if one fails), then the server zip, the Windows installer and `.msi`, and the phone app for sharing, together in `apps/builds/releases/<version>/` with `RELEASE-NOTES.md` and `SHA256SUMS.txt`. `apps/builds/releases/latest/` is a copy of the highest version.

`run build phone-release` builds only the phone app for sharing: smaller (unused code and resources left out, 64-bit ARM only), and signed with the **release key**. The first time, it makes the key in `apps/phone/keystore/` (not in git: the key and its random passwords in `keystore.properties`). **Back that folder up** somewhere other than this computer: Android installs an update only when it's signed with the same key, so without it, phones would have to remove the app, and its data, to take a new version. `run build phone` stays the quick build for testing (`…-debug.apk`, signed with a key of its own, so the two don't install over each other).

The sections below are the manual steps, for when you need them.

## Desktop

**Needs:** Rust, Microsoft C++ Build Tools (Windows), and the Tauri tool: `cargo install tauri-cli --version "^2" --locked` (once).

```powershell
cd apps\desktop\src-tauri
cargo tauri dev      # run it, from the current src/
cargo tauri build    # the installers
```

`cargo tauri build` makes:

| File (in `apps/desktop/src-tauri/target/release/`) | |
| --- | --- |
| `bundle/nsis/Research Board_<version>_x64-setup.exe` | The installer to give people |
| `bundle/msi/Research Board_<version>_x64_en-US.msi` | The same as an MSI (for managed PCs) |
| `research-board.exe` | The app without an installer |

On a Mac, `run build desktop` makes a `.dmg` and the `.app` (zipped); on Linux, `.AppImage`, `.deb` and `.rpm`. Each is built on its own system; which kinds is set per system in `tauri.macos.conf.json` and `tauri.linux.conf.json` (merged over `tauri.conf.json`). What each needs, and signing the Mac app: [kit/README.md](kit/README.md#what-it-needs).

**Data:** `%APPDATA%\com.researchboard.desktop\` (`research-board.db` and `files/`).

### Names and icons

All in [desktop/src-tauri/tauri.conf.json](desktop/src-tauri/tauri.conf.json):

| What | Setting |
| --- | --- |
| The app's name (window, Start menu, installer) | `productName`; the window's title is `app.windows[0].title` |
| The `.exe`'s file name | `mainBinaryName` (else `name` in `Cargo.toml`) |
| The version in file names | `version`, set from [project.json](project.json) at each build |
| Publisher, copyright | `bundle.publisher`, `bundle.copyright` |
| Where the data is kept | `identifier`. **Set once:** changing it makes a new, empty data folder |

**Icons:** `run icons <logo>` (or `cargo tauri icon <logo>`) (a square SVG, or a 1024 × 1024 PNG) writes every size into `icons/`, including Android's in `icons/android/`. Then rebuild. Today's are made from `src/assets/logo.svg`.

## Phone

**Needs:** Bun (only to build), Android Studio with its SDK, Java 21. iOS: a Mac with Xcode (below).

```powershell
cd apps\phone
bun install                 # once: Capacitor and its plugins (only here; the app code has no packages)
bun --bun run apk           # copies src/ in and builds android/app/build/outputs/apk/debug/app-debug.apk
bun --bun run open          # or open it in Android Studio (run on a phone or emulator, build a release)
```

**If Android Studio offers to upgrade Gradle, say no.** Capacitor 8's Android build plugin needs Gradle 8.x; Gradle 9.6 and newer refuse it ("relies on a Gradle internal API that was removed"). If it happened: `git checkout -- apps/phone/android/gradle/wrapper/gradle-wrapper.properties`.

Install the `.apk` on an Android phone by copying it over and opening it (allow "install unknown apps"), or with `adb install`.

**Data:** the app's private storage on the phone (removed with the app: back up from Settings).

### Names and icons

| What | Where |
| --- | --- |
| Name, app id | [phone/capacitor.config.json](phone/capacitor.config.json) (`appName`, `appId`; the id is set once, like the desktop's), and `android/app/src/main/res/values/strings.xml` |
| Launcher icon | Copy `desktop/src-tauri/icons/android/mipmap-*` into `phone/android/app/src/main/res/` after `cargo tauri icon`, or use Android Studio → New → Image Asset |
| Splash screen | `phone/android/app/src/main/res/drawable*/splash.png` (still Capacitor's) |

### iOS

`apps/phone/ios/` is the Xcode project (Capacitor's, using Swift Package Manager, so no CocoaPods). It's built on a Mac:

1. Install Xcode, open it once, and add your Apple ID in Xcode > Settings > Accounts.
2. Put your team ID in [project.json](project.json): `"phone": { "ios": { "team": "ABCDE12345" } }` (Xcode > Settings > Accounts, or developer.apple.com > Account > Membership).
3. `./run.sh build ios`: an `.ipa` for your own registered iPhone or iPad (install it from Xcode > Window > Devices and Simulators), or `./run.sh open ios` and press Run in Xcode with the phone plugged in. `build ios-release` makes the App Store build (upload with Apple's Transporter app); it needs the paid developer program.

**Data:** the app's own storage on the phone. Files saved from the app go to its Documents folder, shown in the Files app under On My iPhone > Research Board.

App name and id: `capacitor.config.json` and `ios/App/App/Info.plist` (`CFBundleDisplayName`); the icon: `ios/App/App/Assets.xcassets/AppIcon.appiconset/` (`run icons <logo>` updates it).

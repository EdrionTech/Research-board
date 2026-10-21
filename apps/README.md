# Research Board apps

The desktop and phone apps are the same app as in the browser: each wraps `src/` unchanged. They keep their data on the device in SQLite, using the same storage code as the server ([src/script/core/place/place.js](../src/script/core/place/place.js)). `src/script/core/boot.js` notices which one it's running in and loads its adapter.

| | Folder | Built with | Its storage adapter |
| --- | --- | --- | --- |
| Desktop (Windows, macOS, Linux) | `desktop/src-tauri` | Tauri (Rust shell) | `sql-tauri.js` → `src/main.rs` |
| Phone (Android; iOS on a Mac) | `phone` | Capacitor | `sql-capacitor.js` → the SQLite and Filesystem plugins |

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

A `.dmg` (macOS) or `.AppImage` / `.deb` (Linux) is built the same way on that system.

**Data:** `%APPDATA%\com.researchboard.desktop\` (`research-board.db` and `files/`).

### Names and icons

All in [desktop/src-tauri/tauri.conf.json](desktop/src-tauri/tauri.conf.json):

| What | Setting |
| --- | --- |
| The app's name (window, Start menu, installer) | `productName`; the window's title is `app.windows[0].title` |
| The `.exe`'s file name | `mainBinaryName` (else `name` in `Cargo.toml`) |
| The version in file names | `version` |
| Publisher, copyright | `bundle.publisher`, `bundle.copyright` |
| Where the data is kept | `identifier`. **Set once:** changing it makes a new, empty data folder |

**Icons:** `cargo tauri icon <logo>` (a square SVG, or a 1024 × 1024 PNG) writes every size into `icons/`, including Android's in `icons/android/`. Then rebuild. Today's are made from `src/assets/logo.svg`.

## Phone

**Needs:** Node 22+ (only to build), Android Studio with its SDK, Java 21. iOS needs a Mac with Xcode.

```powershell
cd apps\phone
npm install          # once: Capacitor and its plugins (only here; the app code has no npm packages)
npm run apk          # copies src/ in and builds android/app/build/outputs/apk/debug/app-debug.apk
npm run open         # or open it in Android Studio (run on a phone or emulator, build a release)
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

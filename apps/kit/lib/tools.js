// Finding the tools the builds need, on Windows, macOS and Linux: Rust and the Tauri tool, Java 21+, the Android SDK.
// (Bun is already found: the kit runs on it. Its path is process.execPath.)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { say, fail, run, succeeds } = require('./util');

const WIN = process.platform === 'win32';
const MAC = process.platform === 'darwin';
const home = os.homedir();

// Rust, and Tauri's cargo tool (installed the first time)
function useTauri() {
    if (!Bun.which('cargo')) fail('Needs Rust: https://rustup.rs');
    if (!succeeds('cargo', ['tauri', '--version'])) {
        say('Installing the Tauri tool (once, a few minutes)');
        run('cargo', ['install', 'tauri-cli', '--version', '^2', '--locked']);
    }
}

// the major version of the Java in a folder (from its release file), or 0
function javaMajor(dir) {
    try {
        if (!fs.existsSync(path.join(dir, 'bin', WIN ? 'java.exe' : 'java'))) return 0;
        const match = fs.readFileSync(path.join(dir, 'release'), 'utf8').match(/JAVA_VERSION="(\d+)/);
        return match ? Number(match[1]) : 0;
    } catch { return 0; }
}

const subfolders = (dir, test, inner = '') => {
    try { return fs.readdirSync(dir).filter(n => test.test(n)).map(n => path.join(dir, n, inner)); } catch { return []; }
};

// Java 21 or newer and the Android SDK, for Gradle. JAVA_HOME may point at an older Java (some Android Studio
// versions bundle Java 17, which Capacitor 8 refuses), so it's checked like the others.
function useAndroid() {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const candidates = [process.env.JAVA_HOME,
        ...(WIN ? [path.join(pf, 'Android', 'Android Studio', 'jbr'),
            ...['Eclipse Adoptium', 'Java', 'Microsoft'].flatMap(vendor => subfolders(path.join(pf, vendor), /^jdk-/))]
        : MAC ? ['/Applications/Android Studio.app/Contents/jbr/Contents/Home',
            ...subfolders('/Library/Java/JavaVirtualMachines', /./, 'Contents/Home')]
        : [path.join(home, 'android-studio', 'jbr'), '/opt/android-studio/jbr', ...subfolders('/usr/lib/jvm', /./)])];
    const java = candidates.find(dir => dir && javaMajor(dir) >= 21);
    if (!java) fail('Needs Java 21 or newer (https://adoptium.net): set JAVA_HOME to it');
    process.env.JAVA_HOME = java;

    const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
        || (WIN ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk') : MAC ? path.join(home, 'Library', 'Android', 'sdk') : path.join(home, 'Android', 'Sdk'));
    if (!fs.existsSync(sdk)) fail('Needs the Android SDK (install Android Studio): set ANDROID_HOME');
    process.env.ANDROID_HOME = sdk;
    return { java, sdk, keytool: path.join(java, 'bin', WIN ? 'keytool.exe' : 'keytool') };
}

module.exports = { WIN, MAC, useTauri, useAndroid };

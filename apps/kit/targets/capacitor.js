// A phone app made with Capacitor (project.json "phone": the folder with capacitor.config.json, and android/ or ios/):
//
//   build phone          Android, for testing: builds/<name>-<version>-debug.apk
//   build phone-release  Android, to share: smaller, signed with the release key -> builds/<name>-<version>.apk
//   sync phone           copy the web folder into the Android project without building (then Android Studio)
//   build ios            iPhone/iPad, for your own devices (a Mac with Xcode): builds/<name>-<version>-dev.ipa
//   build ios-release    iPhone/iPad, for the App Store and TestFlight: builds/<name>-<version>.ipa
//   sync ios / open ios  copy the web folder into the Xcode project / open it in Xcode
//
// The version: Gradle gets -PappVersion (its name) and -PappVersionCode (a number that grows with it: 0.2.0 -> 200),
// which android/app/build.gradle reads; Xcode gets MARKETING_VERSION and CURRENT_PROJECT_VERSION (Capacitor's Info.plist
// uses them).
//
// Android's release key is made the first time, in <dir>/keystore/ (keep it out of git), with random passwords beside
// it in keystore.properties; build.gradle signs with it. Back that folder up: Android installs an update only when it's
// signed with the same key.
//
// iOS is signed by Xcode ("automatic signing") for your Apple team: "phone": { "ios": { "team": "<team id>" } } in
// project.json, or APPLE_TEAM_ID. The iOS tasks are offered only on a Mac.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { say, done, warn, fail, run, mb, place, newestIn } = require('../lib/util');
const { WIN, MAC, useAndroid } = require('../lib/tools');

module.exports = p => {
    const dir = p.at(p.cfg.phone.dir);
    if (!fs.existsSync(path.join(dir, 'capacitor.config.json'))) return {};
    const android = path.join(dir, 'android');
    const ios = path.join(dir, 'ios', 'App');
    const hasAndroid = fs.existsSync(android);
    const hasIos = MAC && fs.existsSync(ios);
    const iosCfg = { scheme: 'App', ...p.cfg.phone.ios };
    const bun = process.execPath;

    function sync(platform) {
        if (!fs.existsSync(path.join(dir, 'node_modules'))) {
            say('Installing the phone build tools (once)');
            run(bun, ['install'], { cwd: dir });
        }
        say(`Copying the app into the ${platform === 'ios' ? 'Xcode' : 'Android'} project`);
        run(bun, ['--bun', 'x', 'cap', 'sync', platform], { cwd: dir }); // (--bun: Capacitor's tool on Bun, not Node)
    }

    const versionCode = () => {
        const [major, minor, patch] = p.version.split(/[.-]/).map(Number);
        return major * 10000 + minor * 100 + patch;
    };

    // ---- Android ----

    const gradle = args => (WIN ? run('gradlew.bat', args, { cwd: android }) : run('sh', ['gradlew', ...args], { cwd: android }));

    function keystore(keytool) {
        const keys = path.join(dir, 'keystore');
        if (fs.existsSync(path.join(keys, 'keystore.properties'))) return;
        say('Making the release key (once)');
        fs.mkdirSync(keys, { recursive: true });
        const password = crypto.randomBytes(24).toString('base64url');
        const alias = p.cfg.phone.key || p.slug;
        run(keytool, ['-genkeypair', '-keystore', `${alias}.jks`, '-alias', alias, '-keyalg', 'RSA', '-keysize', '4096',
            '-validity', '10000', '-storepass', password, '-keypass', password, '-dname', `CN=${p.name}, O=${p.name}`], { cwd: keys });
        fs.writeFileSync(path.join(keys, 'keystore.properties'), `storeFile=${alias}.jks\nstorePassword=${password}\nkeyAlias=${alias}\nkeyPassword=${password}`);
        warn(`Release key: ${keys}`);
        warn('BACK UP this folder (outside this computer). Updates to the app must be signed with this same key:');
        warn('without it, phones would need the app removed (and its data with it) to install a new version.');
    }

    function apk(release) {
        sync('android');
        const { keytool } = useAndroid();
        if (release) keystore(keytool);
        say(release ? 'Building the Android app for release (Gradle)' : 'Building the Android app (Gradle)');
        gradle([release ? 'assembleRelease' : 'assembleDebug', `-PappVersion=${p.version}`, `-PappVersionCode=${versionCode()}`]);
        p.ensureOut();
        const kind = release ? 'release' : 'debug';
        const to = path.join(p.out, p.artifact(release ? '.apk' : '-debug.apk'));
        place(path.join(android, 'app', 'build', 'outputs', 'apk', kind, `app-${kind}.apk`), to);
        done(`Android app${release ? ' (release)' : ''}: ${to} (${mb(to)})`);
        if (!release) done('Install: copy it to the phone and open it (allow installing unknown apps), or: adb install -r <file>');
        return [to];
    }

    // ---- iOS (a Mac with Xcode) ----

    const team = () => iosCfg.team || process.env.APPLE_TEAM_ID;

    function ipa(release) {
        if (!Bun.which('xcodebuild')) fail('Needs Xcode (from the App Store), opened once to finish installing');
        if (!team()) {
            fail('Needs your Apple team ID: "phone": { "ios": { "team": "ABCDE12345" } } in project.json, or APPLE_TEAM_ID.\n'
                + 'It is on developer.apple.com > Account > Membership, or in Xcode > Settings > Accounts (a free Apple ID works for your own devices).');
        }
        sync('ios');
        const build = path.join(ios, 'build'); // (ignored by the Xcode project's .gitignore)
        const archive = path.join(build, 'App.xcarchive');
        const exportDir = path.join(build, release ? 'export-release' : 'export-dev');
        fs.rmSync(exportDir, { recursive: true, force: true });
        const project = fs.existsSync(path.join(ios, 'App.xcworkspace')) ? ['-workspace', 'App.xcworkspace'] : ['-project', 'App.xcodeproj'];
        const signing = ['-allowProvisioningUpdates', `DEVELOPMENT_TEAM=${team()}`, 'CODE_SIGN_STYLE=Automatic'];

        say(release ? 'Building the iOS app for the App Store (Xcode)' : 'Building the iOS app for your devices (Xcode)');
        run('xcodebuild', [...project, '-scheme', iosCfg.scheme, '-configuration', 'Release', '-destination', 'generic/platform=iOS',
            '-archivePath', archive, 'archive', ...signing, `MARKETING_VERSION=${p.version}`, `CURRENT_PROJECT_VERSION=${versionCode()}`], { cwd: ios });

        const options = path.join(build, 'ExportOptions.plist');
        fs.writeFileSync(options, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>${release ? 'app-store' : 'development'}</string>
  <key>teamID</key><string>${team()}</string>
  <key>signingStyle</key><string>automatic</string>
</dict></plist>
`);
        run('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportPath', exportDir, '-exportOptionsPlist', options, '-allowProvisioningUpdates'], { cwd: ios });
        const made = newestIn(exportDir, /\.ipa$/);
        if (!made) fail(`No .ipa was made (look in ${exportDir})`);
        p.ensureOut();
        const to = path.join(p.out, p.artifact(release ? '.ipa' : '-dev.ipa'));
        place(made, to);
        done(`iOS app${release ? ' (App Store)' : ''}: ${to} (${mb(to)})`);
        done(release ? 'Send it to App Store Connect (TestFlight, then the App Store) with Apple\'s Transporter app, or Xcode > Organizer.'
            : 'Install: Xcode > Window > Devices and Simulators, drag it onto your iPhone (registered with your team).');
        return [to];
    }

    // ---- the tasks ----

    const rel = (...parts) => path.join(p.cfg.phone.dir, ...parts);
    const config = rel('capacitor.config.json');
    const tasks = {}, builds = [];
    if (hasAndroid) {
        const app = (...parts) => rel('android', 'app', ...parts);
        const sources = [p.cfg.web, config, app('src', 'main', 'res'), app('src', 'main', 'java'), app('src', 'main', 'AndroidManifest.xml')];
        Object.assign(tasks, {
            'build phone': { label: 'Android app (.apk, for testing)', build: () => apk(false), dev: true },
            'build phone-release': { label: 'Android app to share (.apk: smaller, signed)', build: () => apk(true), dev: true },
            'sync phone': { label: 'Copy the app into the Android project (for Android Studio)', run: () => { sync('android'); done(`Now: cd ${p.cfg.phone.dir} and bun --bun x cap open android`); }, dev: true },
        });
        builds.push({ name: 'phone', task: 'build phone', file: p.artifact('-debug.apk'), sources },
            { name: 'phone-release', task: 'build phone-release', file: p.artifact('.apk'), sources: [...sources, app('build.gradle'), app('proguard-rules.pro')] });
    }
    if (hasIos) {
        const sources = [p.cfg.web, config, rel('ios', 'App', 'App'), rel('ios', 'App', 'App.xcodeproj'), rel('ios', 'App', 'CapApp-SPM', 'Package.swift')];
        Object.assign(tasks, {
            'build ios': { label: 'iOS app for your own devices (.ipa)', build: () => ipa(false), dev: true },
            'build ios-release': { label: 'iOS app for the App Store and TestFlight (.ipa)', build: () => ipa(true), dev: true },
            'sync ios': { label: 'Copy the app into the Xcode project', run: () => sync('ios'), dev: true },
            'open ios': { label: 'Open the Xcode project', run: () => { sync('ios'); run(bun, ['--bun', 'x', 'cap', 'open', 'ios'], { cwd: dir }); }, dev: true },
        });
        builds.push({ name: 'ios', task: 'build ios', file: p.artifact('-dev.ipa'), sources },
            { name: 'ios-release', task: 'build ios-release', file: p.artifact('.ipa'), sources });
    }

    // a release: Android's shared build, and iOS's App Store build on a Mac with a team set
    async function release() {
        const files = hasAndroid ? apk(true) : [];
        if (hasIos && team()) files.push(...ipa(true));
        else if (hasIos) warn('iOS left out of the release: set "phone": { "ios": { "team": … } } in project.json to include it');
        return files;
    }
    return { tasks, builds, release: (hasAndroid || hasIos) ? release : undefined };
};

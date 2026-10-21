# Research Board's builds, one at a time or all together. Run it with no task for a menu (or double-click build.bat).
#
#   .\devbuild\build.ps1 apk          the Android app      -> devbuild\out\ResearchBoard-<version>-debug.apk
#   .\devbuild\build.ps1 exe          the Windows app      -> devbuild\out\ResearchBoard-<version>-setup.exe (+ .msi)
#   .\devbuild\build.ps1 host         the server version   -> devbuild\out\host\ and ResearchBoard-<version>-host.zip
#   .\devbuild\build.ps1 all          all three
#   .\devbuild\build.ps1 sync         copy src\ into the phone app without building (then Android Studio)
#   .\devbuild\build.ps1 icons <file> new app icons from a square SVG or 1024 px PNG (desktop and phone)
#   .\devbuild\build.ps1 serve        run the browser version here (start.bat)
#   .\devbuild\build.ps1 desktop      run the desktop app from src\ without installing (cargo tauri dev)
#   .\devbuild\build.ps1 clean        empty devbuild\out
#
# What each needs is in apps\README.md. The script finds Node 22+ (even when nvm's is older), Java and the Android SDK.

param(
    [Parameter(Position = 0)] [string] $Task,
    [Parameter(Position = 1)] [string] $Arg
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $PSScriptRoot 'out'
$Desktop = Join-Path $Root 'apps\desktop\src-tauri'
$Phone = Join-Path $Root 'apps\phone'
$Version = (Get-Content (Join-Path $Desktop 'tauri.conf.json') -Raw | ConvertFrom-Json).version

function Say($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Done($text) { Write-Host "   $text" -ForegroundColor Green }

# a program run here stops the build when it fails
function Run($exe, [string[]] $arguments, $where = $Root) {
    Push-Location $where
    try {
        & $exe @arguments
        if ($LASTEXITCODE -ne 0) { throw "$exe $($arguments -join ' ') failed (exit $LASTEXITCODE)" }
    } finally { Pop-Location }
}

# Node 22.13+: the one on PATH if it's new enough, else the installed one (nvm may hold an older one)
function Use-Node {
    $candidates = @((Get-Command node -ErrorAction SilentlyContinue).Source, "$env:ProgramFiles\nodejs\node.exe")
    foreach ($node in $candidates) {
        if (-not $node -or -not (Test-Path $node)) { continue }
        $v = (& $node -p 'process.versions.node').Split('.')
        if ([int]$v[0] -gt 22 -or ([int]$v[0] -eq 22 -and [int]$v[1] -ge 13)) {
            $env:Path = (Split-Path $node) + ';' + $env:Path
            return $node
        }
    }
    throw 'Needs Node.js 22.13 or newer: https://nodejs.org (or winget install OpenJS.NodeJS.LTS)'
}

# Java 21 and the Android SDK, for Gradle
function Use-Android {
    if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
        $java = @("$env:ProgramFiles\Android\Android Studio\jbr") + @(Get-ChildItem "$env:ProgramFiles\Eclipse Adoptium\jdk-21*" -Directory -ErrorAction SilentlyContinue | ForEach-Object FullName) |
            Where-Object { Test-Path "$_\bin\java.exe" } | Select-Object -First 1
        if (-not $java) { throw 'Needs Java 21 (Android Studio includes one): set JAVA_HOME' }
        $env:JAVA_HOME = $java
    }
    if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
    if (-not (Test-Path $env:ANDROID_HOME)) { throw 'Needs the Android SDK (install Android Studio): set ANDROID_HOME' }
}

function Use-Tauri {
    if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Needs Rust: https://rustup.rs' }
    $ErrorActionPreference = 'Continue' # (cargo's "no such command" on stderr isn't a reason to stop)
    & cargo tauri --version *> $null
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) {
        Say 'Installing the Tauri tool (once, a few minutes)'
        Run cargo @('install', 'tauri-cli', '--version', '^2', '--locked')
    }
}

function New-Out { New-Item -ItemType Directory -Force $Out | Out-Null }

# ---- the tasks ----

function Sync-Phone {
    $node = Use-Node
    if (-not (Test-Path (Join-Path $Phone 'node_modules'))) {
        Say 'Installing the phone build tools (once)'
        Run (Join-Path (Split-Path $node) 'npm.cmd') @('install') $Phone
    }
    Say 'Copying src\ into the phone app'
    Run (Join-Path (Split-Path $node) 'npx.cmd') @('cap', 'sync', 'android') $Phone
}

function Build-Apk {
    Sync-Phone
    Use-Android
    Say 'Building the Android app (Gradle)'
    Run (Join-Path $Phone 'android\gradlew.bat') @('assembleDebug') (Join-Path $Phone 'android')
    New-Out
    $apk = Join-Path $Out "ResearchBoard-$Version-debug.apk"
    Copy-Item (Join-Path $Phone 'android\app\build\outputs\apk\debug\app-debug.apk') $apk -Force
    Done "Android app: $apk"
    Done 'Install: copy it to the phone and open it (allow installing unknown apps), or: adb install -r <file>'
}

function Build-Exe {
    Use-Tauri
    Say 'Building the desktop app (first time: several minutes)'
    Run cargo @('tauri', 'build') $Desktop
    New-Out
    $bundle = Join-Path $Desktop 'target\release\bundle'
    $setup = Get-ChildItem "$bundle\nsis\*-setup.exe" | Sort-Object LastWriteTime | Select-Object -Last 1
    $msi = Get-ChildItem "$bundle\msi\*.msi" | Sort-Object LastWriteTime | Select-Object -Last 1
    Copy-Item $setup.FullName (Join-Path $Out "ResearchBoard-$Version-setup.exe") -Force
    Copy-Item $msi.FullName (Join-Path $Out "ResearchBoard-$Version.msi") -Force
    Done "Installer: $(Join-Path $Out "ResearchBoard-$Version-setup.exe")"
    Done "MSI:       $(Join-Path $Out "ResearchBoard-$Version.msi")"
}

# The server version, ready to copy to another computer or a server: the app, the server and its starters.
# Not the data (that stays in each place's own data folder).
function Build-Host {
    Use-Node | Out-Null
    Say 'Preparing the server version'
    $host_ = Join-Path $Out 'host'
    if (Test-Path $host_) { Remove-Item $host_ -Recurse -Force }
    New-Item -ItemType Directory -Force $host_ | Out-Null
    Copy-Item (Join-Path $Root 'src') $host_ -Recurse
    New-Item -ItemType Directory -Force (Join-Path $host_ 'server') | Out-Null
    Copy-Item (Join-Path $Root 'server\*.js'), (Join-Path $Root 'server\README.md') (Join-Path $host_ 'server')
    Copy-Item (Join-Path $Root 'start.bat'), (Join-Path $Root 'start.sh') $host_
    Set-Content (Join-Path $host_ 'VERSION') $Version
    # quick check: it starts and answers, on a spare port with an empty data folder
    $check = Join-Path $env:TEMP "rb-host-check-$PID"
    $node = (Get-Command node).Source
    $env:PORT = '5593'; $env:DATA = $check
    $server = Start-Process $node -ArgumentList "`"$(Join-Path $host_ 'server\server.js')`"" -PassThru -WindowStyle Hidden
    try {
        $ok = $false
        foreach ($i in 1..20) {
            Start-Sleep -Milliseconds 300
            try { $ok = (Invoke-RestMethod http://127.0.0.1:5593/api/health).ok; if ($ok) { break } } catch { }
        }
        if (-not $ok) { throw 'The server version did not start (try: node server\server.js in devbuild\out\host)' }
    } finally {
        Stop-Process $server.Id -ErrorAction SilentlyContinue
        Remove-Item Env:PORT, Env:DATA
        Start-Sleep -Milliseconds 300
        Remove-Item $check -Recurse -Force -ErrorAction SilentlyContinue
    }
    $zip = Join-Path $Out "ResearchBoard-$Version-host.zip"
    Compress-Archive -Path "$host_\*" -DestinationPath $zip -Force
    Done "Server version: $host_ (and $zip); it started and answered"
    Write-Host '   Run it with start.bat / start.sh (Node 22.13+). It has no sign-in yet: keep HOST=127.0.0.1 (this computer only)' -ForegroundColor Yellow
    Write-Host '   until accounts exist; anyone who can reach it can read and change everything.' -ForegroundColor Yellow
}

function Set-Icons($file) {
    if (-not $file -or -not (Test-Path $file)) { throw 'Give the icon: .\devbuild\build.ps1 icons path\to\logo.svg (square SVG, or a 1024 x 1024 PNG)' }
    Use-Tauri
    Say 'Making the app icons'
    Run cargo @('tauri', 'icon', (Resolve-Path $file).Path, '-o', 'icons') $Desktop
    foreach ($dir in Get-ChildItem (Join-Path $Desktop 'icons\android') -Directory -Filter 'mipmap-*dpi') {
        Copy-Item "$($dir.FullName)\*.png" (Join-Path $Phone "android\app\src\main\res\$($dir.Name)") -Force
    }
    Done 'Desktop and phone icons updated: rebuild (exe, apk) to see them'
}

$tasks = [ordered]@{
    apk     = 'Android app (.apk)'
    exe     = 'Windows app (installer .exe and .msi)'
    host    = 'Server version (folder and .zip)'
    all     = 'All three'
    sync    = 'Copy src\ into the phone app (for Android Studio)'
    icons   = 'New app icons from a logo file'
    serve   = 'Run the browser version here'
    desktop = 'Run the desktop app from src\ (development)'
    clean   = 'Empty devbuild\out'
}

if (-not $Task) {
    Write-Host "Research Board builds (version $Version)`n" -ForegroundColor Cyan
    $i = 0
    foreach ($name in $tasks.Keys) { $i++; Write-Host ("  {0}. {1,-8} {2}" -f $i, $name, $tasks[$name]) }
    $pick = Read-Host "`nWhich (number or name)"
    if ($pick -match '^\d+$') { $Task = @($tasks.Keys)[[int]$pick - 1] } else { $Task = $pick }
    if ($Task -eq 'icons') { $Arg = Read-Host 'Logo file (square SVG or 1024 px PNG)' }
}

$started = Get-Date
switch ($Task) {
    'apk' { Build-Apk }
    'exe' { Build-Exe }
    'host' { Build-Host }
    'all' { Build-Host; Build-Exe; Build-Apk }
    'sync' { Sync-Phone; Done 'Now: cd apps\phone; npx cap open android' }
    'icons' { Set-Icons $Arg }
    'serve' { Use-Node | Out-Null; Run node @('server\server.js', '--open') }
    'desktop' { Use-Tauri; Run cargo @('tauri', 'dev') $Desktop }
    'clean' { if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }; Done 'devbuild\out emptied' }
    default { throw "Unknown task '$Task'. Tasks: $($tasks.Keys -join ', ')" }
}
Done ("Finished in {0:mm\:ss}" -f ((Get-Date) - $started))

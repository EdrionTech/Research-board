#!/bin/sh
# The one launcher (macOS, Linux). With no task, a menu (back after each task); or:  ./run.sh <task>   (./run.sh help lists them)
#   ./run.sh open            the app here, in your browser
#   ./run.sh host            a server for other devices (--public, --start, --autostart, --no-autostart)
#   ./run.sh build phone     ... build desktop, build server, build all, release, status, test
# It finds Bun (installing it the first time) and hands over to apps/kit/kit.js, which reads apps/project.json.
cd "$(dirname "$0")" || exit 1

# Bun: the one on PATH, else where Bun's installer puts it, else installed now (https://bun.sh)
BUN=$(command -v bun || echo "$HOME/.bun/bin/bun")
if [ ! -x "$BUN" ]; then
    echo "Installing Bun, which runs this (https://bun.sh)..."
    curl -fsSL https://bun.sh/install | bash || { echo "Couldn't install Bun. Install it from https://bun.sh and run this again."; exit 1; }
    BUN="$HOME/.bun/bin/bun"
fi

exec "$BUN" apps/kit/kit.js "$@"

#!/bin/sh
# Starts Research Board (macOS / Linux) and opens it in your browser once it's ready.
# Your data is kept in the data folder next to this file. Ctrl + C stops it.
cd "$(dirname "$0")" || exit 1
# Bun: the one on PATH, else where Bun's installer puts it
BUN=$(command -v bun || echo "$HOME/.bun/bin/bun")
if [ ! -x "$BUN" ]; then
    echo "Research Board needs Bun: https://bun.sh  (curl -fsSL https://bun.sh/install | bash)"
    exit 1
fi
exec "$BUN" apps/server/server.js --open

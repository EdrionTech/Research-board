#!/bin/sh
# Research Board as a server for other devices (a lab server, or your phone and laptop syncing with it).
# Run it with no options for a menu: how it's reached (this network, or any network for testing), the port, the data
# folder, starting with the computer and the access key, then start it. Installs Bun first if it's missing.
#
#   ./serve.sh                  the menu
#   ./serve.sh --start          start with the saved settings (no menu)
#   ./serve.sh --public         start once from any network (a temporary https address)
#   ./serve.sh --autostart      start with the computer (Linux: systemd; macOS: launchd)   --no-autostart   stop that
#
# The menu is apps/server/serve.js; the settings are kept in serve.json here. For a VPS: apps/server/vps-setup.sh.
cd "$(dirname "$0")" || exit 1

# Bun: the one on PATH, else where Bun's installer puts it, else installed now (https://bun.sh)
BUN=$(command -v bun || echo "$HOME/.bun/bin/bun")
if [ ! -x "$BUN" ]; then
    echo "Installing Bun, which runs the server (https://bun.sh)..."
    curl -fsSL https://bun.sh/install | bash || { echo "Couldn't install Bun. Install it from https://bun.sh and run ./serve.sh again."; exit 1; }
    BUN="$HOME/.bun/bin/bun"
fi

exec "$BUN" apps/server/serve.js "$@"

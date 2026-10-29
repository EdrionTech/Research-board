#!/bin/sh
# Starts Research Board (macOS / Linux) and opens it in your browser once it's ready.
# Your data is kept in the data folder next to this file. Ctrl + C stops it.
cd "$(dirname "$0")" || exit 1
exec node apps/server/server.js --open

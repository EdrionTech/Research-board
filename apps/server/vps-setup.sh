#!/bin/sh
# Research Board on a VPS (a rented server with its own public address), in one run. For Ubuntu or Debian.
#
#   1. Copy Research Board to the server: the server version (build.bat host → ResearchBoard-<version>-host.zip),
#      e.g.  scp ResearchBoard-0.1.0-host.zip root@<server>:  then on the server:  unzip ResearchBoard-0.1.0-host.zip -d research-board
#   2. sudo sh research-board/apps/server/vps-setup.sh [your.domain]
#
# It prints the https address and the access key for your devices (Settings > Sync with a server).
# Running it again updates Research Board from the folder it's run from, keeping the data and the key.
#
# What it sets up:
#   - Research Board in /opt/research-board, run by its own user (researchboard) that can write only to its data
#     folder, /var/lib/research-board; started with the machine and restarted if it stops (systemd)
#   - Caddy in front: HTTPS with a free certificate (Let's Encrypt), renewed by itself. With no domain given, the
#     address is <server ip>.sslip.io (a free name that points at any IP); a domain of your own is better (point
#     its DNS A record at the server first)
#   - the firewall (ufw): only SSH, and web traffic (80, 443) for Caddy. Research Board itself listens on
#     127.0.0.1 only, so it's reached only through Caddy, and always asks for its key (server.js --proxy)
#
# Back up: /var/lib/research-board/data (the database, files/ and server-key.txt).

set -eu

APP_SRC=$(cd "$(dirname "$0")/../.." && pwd)
APP=/opt/research-board
HOME_DIR=/var/lib/research-board
DATA=$HOME_DIR/data
BUN_DIR=/opt/bun
PORT=5500
USER_NAME=researchboard
DOMAIN=${1:-}

say() { printf '\n== %s\n' "$1"; }

[ "$(id -u)" = 0 ] || { echo "Run it as root: sudo sh $0 $*"; exit 1; }
command -v apt-get >/dev/null || { echo "This script is for Ubuntu or Debian (apt). On others, see apps/server/README.md."; exit 1; }
[ -f "$APP_SRC/apps/server/server.js" ] && [ -d "$APP_SRC/src" ] || { echo "Run it from an unzipped Research Board (src/ and apps/server/ beside each other)."; exit 1; }

say 'Packages'
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q curl unzip ufw ca-certificates debian-keyring debian-archive-keyring apt-transport-https gnupg >/dev/null

if ! command -v caddy >/dev/null; then
    say 'Caddy (HTTPS)'
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -q
    apt-get install -y -q caddy >/dev/null
fi

if [ ! -x "$BUN_DIR/bin/bun" ]; then
    say 'Bun (runs Research Board)'
    curl -fsSL https://bun.sh/install | BUN_INSTALL=$BUN_DIR bash >/dev/null
fi
"$BUN_DIR/bin/bun" --version >/dev/null

say 'Research Board'
id "$USER_NAME" >/dev/null 2>&1 || useradd --system --home-dir "$HOME_DIR" --shell /usr/sbin/nologin "$USER_NAME"
mkdir -p "$DATA"
chown -R "$USER_NAME:$USER_NAME" "$HOME_DIR"
chmod 700 "$HOME_DIR"
# the program: owned by root, so the service can't change its own code
if [ "$APP_SRC" != "$APP" ]; then
    rm -rf "$APP.new"
    mkdir -p "$APP.new/apps"
    cp -R "$APP_SRC/src" "$APP.new/src"
    cp -R "$APP_SRC/apps/server" "$APP.new/apps/server"
    [ -f "$APP_SRC/VERSION" ] && cp "$APP_SRC/VERSION" "$APP.new/"
    rm -rf "$APP.old"
    [ -d "$APP" ] && mv "$APP" "$APP.old"
    mv "$APP.new" "$APP"
    rm -rf "$APP.old"
fi
chown -R root:root "$APP"
chmod -R a+rX "$APP"

cat > /etc/systemd/system/research-board.service <<EOF
[Unit]
Description=Research Board server
After=network-online.target
Wants=network-online.target

[Service]
User=$USER_NAME
Group=$USER_NAME
WorkingDirectory=$APP
Environment=PORT=$PORT DATA=$DATA
ExecStart=$BUN_DIR/bin/bun $APP/apps/server/server.js --proxy
Restart=always
RestartSec=3
# it may write only its data folder
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$HOME_DIR
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable research-board >/dev/null 2>&1
systemctl restart research-board

say 'HTTPS address'
if [ -z "$DOMAIN" ]; then
    IP=$(curl -fsS -4 --max-time 10 https://api.ipify.org || true)
    [ -n "$IP" ] || IP=$(ip -4 route get 1.1.1.1 | sed -n 's/.* src \([0-9.]*\).*/\1/p')
    [ -n "$IP" ] || { echo "Couldn't find this server's public address: run it again with your domain: sudo sh $0 your.domain"; exit 1; }
    DOMAIN="$(echo "$IP" | tr . -).sslip.io"
fi
cat > /etc/caddy/Caddyfile <<EOF
# Research Board (apps/server/vps-setup.sh): HTTPS in front of the server on 127.0.0.1:$PORT
$DOMAIN {
    encode gzip
    request_body {
        max_size 500MB
    }
    reverse_proxy 127.0.0.1:$PORT
}
EOF
systemctl enable caddy >/dev/null 2>&1
systemctl reload caddy 2>/dev/null || systemctl restart caddy

say 'Firewall'
# the port SSH really listens on (so this never locks you out), plus web traffic for Caddy
SSH_PORTS=$(ss -tlnpH 2>/dev/null | awk '/sshd/ { n = split($4, a, ":"); print a[n] }' | sort -u)
for p in ${SSH_PORTS:-22}; do ufw allow "$p/tcp" >/dev/null; done
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status | sed 's/^/   /'

say 'Waiting for it to answer over HTTPS (the first certificate can take a minute)'
OK=
for i in $(seq 1 60); do
    if curl -fsS --max-time 5 "https://$DOMAIN/api/health" >/dev/null 2>&1; then OK=1; break; fi
    sleep 3
done

KEY=$(cat "$DATA/server-key.txt" 2>/dev/null || true)
echo
if [ -n "$OK" ]; then
    echo "Research Board is running. Connect devices (Settings > Sync with a server) to:"
else
    echo "Research Board is running, but https://$DOMAIN isn't answering yet. Check: journalctl -u caddy -n 50"
    echo "(a domain of your own must point at this server; ports 80 and 443 must be open at your provider too)"
    echo "Its address, once it answers:"
fi
echo "  https://$DOMAIN/"
echo "with the access key:  ${KEY:-(see $DATA/server-key.txt)}"
echo
echo "Logs: journalctl -u research-board -f      Restart: systemctl restart research-board"
echo "Update: copy a newer version here and run this script again (the data and key are kept)."
echo "Back up: $DATA"

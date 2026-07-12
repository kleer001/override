#!/usr/bin/env bash
# Local no-cache dev server. Usage: ./run.sh [port]   (default 8000)
# python's http.server sends no Cache-Control, so browsers serve STALE JS on
# reload; force no-store so every reload re-fetches during development.
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-8000}"
# Reclaim the port: kill any server already listening on it (a prior run).
# lsof exits 1 when nothing matches, which is the normal fresh-start case.
# SIGKILL, not SIGTERM: a suspended (Ctrl-Z'd) server ignores SIGTERM but still
# holds the port. Then wait for the socket to release so the bind can't race it.
EXISTING="$(lsof -ti "tcp:$PORT" -sTCP:LISTEN)" || EXISTING=""
if [ -n "$EXISTING" ]; then
  echo "override -> stopping previous server (pid $EXISTING) on $PORT"
  kill -9 $EXISTING
  for _ in $(seq 20); do
    lsof -ti "tcp:$PORT" -sTCP:LISTEN >/dev/null 2>&1 || break
    sleep 0.1
  done
fi
# Open the game in Firefox once the server has had a moment to bind.
( sleep 1; firefox "http://localhost:$PORT" ) &
exec python3 -c '
import http.server, socketserver, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", int(sys.argv[1])), H) as s:
    print(f"override -> http://localhost:{sys.argv[1]}  (Ctrl-C to stop)")
    s.serve_forever()
' "$PORT"

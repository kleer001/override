#!/usr/bin/env bash
# Launch the ASSAULT 2D scan-pattern sandbox (preview/scan.html).
# Same no-cache dev server as run.sh, but opens the scan preview.
# Usage: ./run-scan.sh [port]   (default 8001)
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-8001}"
# Reclaim the port: kill any server already listening on it (a prior run).
EXISTING="$(lsof -ti "tcp:$PORT" -sTCP:LISTEN)" || EXISTING=""
if [ -n "$EXISTING" ]; then
  echo "override -> stopping previous server (pid $EXISTING) on $PORT"
  kill -9 $EXISTING
  for _ in $(seq 20); do
    lsof -ti "tcp:$PORT" -sTCP:LISTEN >/dev/null 2>&1 || break
    sleep 0.1
  done
fi
# Open the scan sandbox once the server has had a moment to bind.
( sleep 1; firefox "http://localhost:$PORT/preview/scan.html" ) &
exec python3 -c '
import http.server, socketserver, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", int(sys.argv[1])), H) as s:
    print(f"override scan sandbox -> http://localhost:{sys.argv[1]}/preview/scan.html  (Ctrl-C to stop)")
    s.serve_forever()
' "$PORT"

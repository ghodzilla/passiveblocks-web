#!/bin/bash
# Idempotent install for the shared Sydney droplet.
# Copies this engine under /opt/hl-engine, installs its units and logrotate
# drop-in, and reloads systemd. It does not enable or start the service,
# does not create the user, and does not write a key or an env file.

set -euo pipefail
umask 027

SOURCE=$(cd "$(dirname "$0")/.." && pwd)
PREFIX=${PREFIX:-}

if [[ "$PREFIX" == *..* || "$PREFIX" == *" "* ]]; then
  echo "PREFIX must be a plain directory prefix." >&2
  exit 2
fi

root_path() {
  printf '%s%s' "$PREFIX" "$1"
}

OPT=$(root_path /opt/hl-engine)
APP=$(root_path /opt/hl-engine/app)
VENV=$(root_path /opt/hl-engine/.venv)
LIB=$(root_path /var/lib/hl-engine)
LOGDIR=$(root_path /var/log/hl-engine)
UNITDIR=$(root_path /etc/systemd/system)
ROTATEDIR=$(root_path /etc/logrotate.d)

if [[ -z "$PREFIX" && "$(id -u)" -ne 0 ]]; then
  echo "Run as root on the droplet. This script does not use sudo itself." >&2
  exit 1
fi

if [[ -z "$PREFIX" ]] && ! id hlengine >/dev/null 2>&1; then
  echo "User hlengine is missing. This script does not create users." >&2
  exit 1
fi

case "$APP" in
  /opt/hl-engine/app|"${PREFIX}/opt/hl-engine/app") ;;
  *)
    echo "refusing to replace ${APP}" >&2
    exit 2
    ;;
esac

mkdir -p "$APP" "$LIB" "$LOGDIR" "$UNITDIR" "$ROTATEDIR"

copy_app() {
  local staging
  staging=$(mktemp -d "${TMPDIR:-/tmp}/hl-engine-install.XXXXXX")
  tar -C "$SOURCE" \
    --exclude=.venv \
    --exclude=var \
    --exclude=__pycache__ \
    --exclude=.pytest_cache \
    --exclude=.ruff_cache \
    -cf - . | tar -C "$staging" -xf -
  # Replace the app tree only. The venv and the SQLite file stay put.
  rm -rf "$APP"
  mkdir -p "$APP"
  tar -C "$staging" -cf - . | tar -C "$APP" -xf -
  rm -rf "$staging"
  chmod 750 "$APP/ops/hl-engine-sim" "$APP/ops/pb-alert-fail" "$APP/ops/install.sh"
}

copy_app

install -m 0644 "$SOURCE/ops/systemd/hl-engine.slice" "$UNITDIR/hl-engine.slice"
install -m 0644 "$SOURCE/ops/systemd/hl-engine.service" "$UNITDIR/hl-engine.service"
install -m 0644 "$SOURCE/ops/systemd/pb-alert@.service" "$UNITDIR/pb-alert@.service"
install -m 0644 "$SOURCE/ops/logrotate/hl-engine" "$ROTATEDIR/hl-engine"

if [[ ! -e "$LOGDIR/hl-engine.log" ]]; then
  : > "$LOGDIR/hl-engine.log"
fi

if [[ -z "$PREFIX" ]]; then
  chown -R hlengine:hlengine "$OPT" "$LIB" "$LOGDIR"
  chmod 750 "$OPT" "$LIB" "$LOGDIR"
  chmod 640 "$LOGDIR/hl-engine.log"
  if [[ "${HL_INSTALL_SKIP_UV:-}" != "1" ]]; then
    if ! command -v uv >/dev/null 2>&1; then
      echo "uv is not on PATH. Put it on PATH for root. This script does not download it." >&2
      exit 1
    fi
    runuser -u hlengine -- env \
      UV_PROJECT_ENVIRONMENT=/opt/hl-engine/.venv \
      PYTHONDONTWRITEBYTECODE=1 \
      uv sync --frozen --directory /opt/hl-engine/app
  fi
  systemctl daemon-reload
else
  chmod 750 "$OPT" "$LIB" "$LOGDIR" || true
fi

echo "Installed under ${OPT}."
echo "SQLite directory ${LIB}. Logs ${LOGDIR}."
echo "The service is not enabled and not started."
echo "Live data stays refused. No env file was written."

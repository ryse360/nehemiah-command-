#!/usr/bin/env bash
# Installs and starts Orca (https://github.com/stablyai/orca) as a headless
# systemd service on a Debian/Ubuntu Linux server, following Orca's own
# headless-server guide:
# https://github.com/stablyai/orca/blob/main/docs/reference/headless-linux-server.md
#
# Usage:
#   sudo ./scripts/install-orca-headless.sh [--pairing-address <host-or-ip>] [--port <port>]

set -euo pipefail

PORT=6768
PAIRING_ADDRESS=""
INSTALL_DIR="/opt/orca"
BINARY_PATH="${INSTALL_DIR}/orca-linux.AppImage"
SERVICE_USER="orca"
SERVICE_FILE="/etc/systemd/system/orca-serve.service"
DOWNLOAD_URL="https://github.com/stablyai/orca/releases/latest/download/orca-linux.AppImage"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pairing-address)
      PAIRING_ADDRESS="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "${EUID}" -ne 0 ]]; then
  echo "This script must be run as root (sudo)." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script only supports Debian/Ubuntu (apt-get not found)." >&2
  exit 1
fi

echo "==> Installing prerequisites"
apt-get update
apt-get install -y curl file jq xvfb zlib1g-dev

if ! apt-get install -y libfuse2 2>/dev/null; then
  apt-get install -y libfuse2t64
fi

echo "==> Downloading Orca AppImage to ${BINARY_PATH}"
mkdir -p "${INSTALL_DIR}"
curl -fL "${DOWNLOAD_URL}" -o "${BINARY_PATH}"
chmod +x "${BINARY_PATH}"

if ! command -v Xvfb >/dev/null 2>&1; then
  echo "Warning: Xvfb not found on PATH after install; Orca will not be able to auto-start it." >&2
fi

echo "==> Creating dedicated service user '${SERVICE_USER}'"
if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "${SERVICE_USER}"
fi

chown root:root "${INSTALL_DIR}" "${BINARY_PATH}"
chmod 755 "${INSTALL_DIR}" "${BINARY_PATH}"

EXEC_START="${BINARY_PATH} serve --port ${PORT}"
if [[ -n "${PAIRING_ADDRESS}" ]]; then
  EXEC_START="${EXEC_START} --pairing-address ${PAIRING_ADDRESS}"
fi

echo "==> Writing ${SERVICE_FILE}"
cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=Orca runtime server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=/home/${SERVICE_USER}
Environment=LIBGL_ALWAYS_SOFTWARE=1
ExecStart=${EXEC_START}
StandardOutput=journal
StandardError=journal
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "==> Enabling and starting orca-serve.service"
systemctl daemon-reload
systemctl enable --now orca-serve.service

echo "==> Done. Tail logs with: journalctl -u orca-serve.service -f"

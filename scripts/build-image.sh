#!/usr/bin/env bash
# Builda il progetto (Angular) e poi l'immagine Docker, usando il Dockerfile
# alla radice del repo. Nessun push: l'immagine resta solo nel Docker
# daemon locale, pronta per "kind load docker-image" (vedi
# onepiece-infrastructure/helm/charts/user-frontend).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

IMAGE_NAME="one-piece-user-frontend"
IMAGE_TAG="${IMAGE_TAG:-local}"

log() { echo "[$(basename "$0")] $*"; }

require_cmd() {
  local cmd="$1" hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[$(basename "$0")] ERRORE: comando '$cmd' non trovato. $hint" >&2
    exit 1
  fi
}

require_cmd npm "installa Node.js (vedi Dockerfile per la versione usata in build)."
require_cmd docker "installa Docker Desktop (o il daemon Docker) e assicurati che sia in esecuzione."

log "installo le dipendenze (npm ci)..."
npm ci

log "build Angular (npm run build)..."
npm run build

log "build immagine Docker ${IMAGE_NAME}:${IMAGE_TAG}..."
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

log "fatto: ${IMAGE_NAME}:${IMAGE_TAG} disponibile nel Docker daemon locale."

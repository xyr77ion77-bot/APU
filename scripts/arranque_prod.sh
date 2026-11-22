#!/usr/bin/env bash
# Arranca el Visor CIV en modo producción (server standalone) desde la raíz del repo.
# Requiere haber corrido `npm run build`. Sirve en 0.0.0.0:<PORT> para acceso LAN.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .next/standalone/server.js ] || { echo "Falta el build: corre 'npm run build' primero." >&2; exit 1; }
[ -f db/custom.db ] || { echo "No se encuentra db/custom.db (la base de datos con el catálogo)." >&2; exit 1; }

export NODE_ENV=production
export DATABASE_URL="file:$PWD/db/custom.db"   # el standalone NO hereda el .env del repo de forma fiable
export HOSTNAME="${HOSTNAME:-0.0.0.0}"          # 0.0.0.0 = accesible desde el móvil/otras máquinas de la red
export PORT="${PORT:-3000}"

exec node .next/standalone/server.js

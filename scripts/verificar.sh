#!/bin/bash
# Corre todas las verificaciones del proyecto: tests del frontend, type-check, build,
# y los tests del backend. Sale con error al primer fallo.
set -euo pipefail

FRONT="$(cd "$(dirname "$0")/.." && pwd)"
BACK="$FRONT/../corvis-conciliation-core"
PY="$BACK/../.venv/bin/python3"

echo "== Frontend: tests =="
(cd "$FRONT" && npm test)

echo "== Frontend: type-check y build =="
(cd "$FRONT" && npx tsc --noEmit && npx vite build --outDir /tmp/verificar-dist >/dev/null)

echo "== Backend: tests =="
(cd "$BACK" && "$PY" -m pytest -q)

echo "== Todo OK =="

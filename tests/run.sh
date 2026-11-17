#!/usr/bin/env bash
# Corre los tests de UI del sitio. El sitio no tiene package.json a proposito:
# usa el @playwright/test que Node resuelva desde tests/ (node_modules de una
# carpeta padre) o, si no hay, el de PW_NODE_MODULES / ihtml-repo.
set -euo pipefail
cd "$(dirname "$0")/.."
CLI=$(node -e "try{process.stdout.write(require('path').dirname(require.resolve('@playwright/test/package.json',{paths:['$PWD/tests']}))+'/cli.js')}catch(e){}")
if [ -z "$CLI" ]; then
  NM="${PW_NODE_MODULES:-$HOME/Documentos/2025/ihtml-repo/node_modules}"
  [ -f "$NM/@playwright/test/cli.js" ] || { echo "No encuentro @playwright/test (exporta PW_NODE_MODULES)" >&2; exit 1; }
  export NODE_PATH="$NM"
  CLI="$NM/@playwright/test/cli.js"
fi
exec node "$CLI" test -c tests/playwright.config.cjs "$@"

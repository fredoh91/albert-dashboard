#!/usr/bin/env bash
# ============================================================
# deploy-albert.sh — build + redéploiement d'une appli React
# « Express tout-en-un » (statique + API servis par Node).
#
# Utilisation (sur le serveur Debian) :
#   ./deploy-albert.sh
#   APP_NAME=autre-app BASE_PATH=/autre-app/ PORT=3002 ./deploy-albert.sh
#
# Paramètres (avec valeurs par défaut) :
#   APP_NAME      nom affiché dans les logs                (albert-dashboard)
#   SRC           racine du projet                         (répertoire courant)
#   BASE_PATH     base Vite : "/" en racine, "/x/" en sous-répertoire
#   USE_RSYNC     "1" pour copier vers le docroot Apache   (0 pendant transition)
#   DOCROOT_DST   dossier docroot cible si USE_RSYNC=1
#   SYSTEMD_SVC   unité systemd à redémarrer               (albert-dashboard)
#   DO_NPM_CI     "1" pour relancer `npm ci` avant le build (0 par défaut)
# ============================================================
set -euo pipefail

APP_NAME="${APP_NAME:-albert-dashboard}"
SRC="${SRC:-$(pwd)}"
BASE_PATH="${BASE_PATH:-/albert-dashboard/}"
USE_RSYNC="${USE_RSYNC:-0}"
DOCROOT_DST="${DOCROOT_DST:-/production/www/clients/nam-pgs.ansm-intra.fr/home/www/albert-dashboard}"
SYSTEMD_SVC="${SYSTEMD_SVC:-albert-dashboard}"
DO_NPM_CI="${DO_NPM_CI:-0}"

cd "$SRC"
echo "==> [${APP_NAME}] répertoire : $SRC"

# 1. Dépendances (optionnel)
if [ "$DO_NPM_CI" = "1" ]; then
  echo "==> npm ci…"
  npm ci --no-audit --no-fund
fi

# 2. Build de production, préfixé pour être servi sous BASE_PATH
echo "==> build (VITE_BASE_PATH=${BASE_PATH})…"
VITE_BASE_PATH="$BASE_PATH" npm run build

# 3. Phase transitoire : copie rsync vers le docroot Apache (optionnelle)
if [ "$USE_RSYNC" = "1" ]; then
  echo "==> rsync client/dist/ -> $DOCROOT_DST"
  mkdir -p "$DOCROOT_DST"
  rsync -az --delete "$SRC/client/dist/" "$DOCROOT_DST/"
fi

# 4. Redémarrage du service Express (statique + API)
# `sudo` est requis : sans lui, systemd renvoie
# "Interactive authentication required." (D-Bus/polkit sans agent interactif).
if systemctl is-active --quiet "$SYSTEMD_SVC"; then
  echo "==> restart systemd : $SYSTEMD_SVC"
  sudo systemctl restart "$SYSTEMD_SVC"
else
  echo "!!> l'unité systemd '$SYSTEMD_SVC' n'est pas active — démarrage manuel :"
  echo "    cd $SRC/server && node server.js &"
fi

# 5. Vérifications rapides
echo "==> vérifications :"
PORT_NUM="${PORT:-3001}"
curl -s -o /dev/null -w "    statique  http://127.0.0.1:${PORT_NUM}/        → HTTP %{http_code}\n" \
  "http://127.0.0.1:${PORT_NUM}/" || true
curl -s -o /dev/null -w "    api       http://127.0.0.1:${PORT_NUM}/api/me → HTTP %{http_code}\n" \
  "http://127.0.0.1:${PORT_NUM}/api/me" || true

echo "==> OK : déploiement [${APP_NAME}] terminé."

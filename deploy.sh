#!/usr/bin/env bash
#
# Déploie le back-office YPYit sur le VPS nelima.
#
# On construit ici et on n'envoie que .output : l'image reste légère et le serveur
# n'a besoin ni des sources ni d'une installation npm.
#
set -euo pipefail

REMOTE="${REMOTE:-nelima}"
REMOTE_DIR="${REMOTE_DIR:-~/deployment}"

echo "==> Construction"
npm run build

echo "==> Envoi"
ssh "$REMOTE" "mkdir -p $REMOTE_DIR/backoffice && rm -rf $REMOTE_DIR/backoffice/.output"
COPYFILE_DISABLE=1 tar czf - .output | ssh "$REMOTE" "tar xzf - -C $REMOTE_DIR/backoffice"
scp -q Dockerfile "$REMOTE:$REMOTE_DIR/backoffice/Dockerfile"

echo "==> Reconstruction de l'image et redémarrage"
ssh "$REMOTE" "cd $REMOTE_DIR && docker compose build backoffice && docker compose up -d backoffice"

echo "==> Vérification externe"
sleep 5
curl -s -o /dev/null -w "connexion HTTP %{http_code}\n" --max-time 30 https://admin.nelima.ci/connexion

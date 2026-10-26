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
# Adresse publique vérifiée en fin de déploiement : celle de l'environnement visé.
# Staging : REMOTE=nelima-stg PUBLIC_URL=https://admin-stg.nelima.ci ./deploy.sh
PUBLIC_URL="${PUBLIC_URL:-https://admin.nelima.ci}"

# Une connexion morte sans signe de vie laissait ssh attendre indéfiniment, au point de bloquer
# un déploiement pendant des heures : elle est déclarée perdue après une minute de silence, et
# les envois sont retentés. Chaque tentative repart d'un dossier distant vidé.
SSH_OPTS=(-o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4)
ssh() { command ssh "${SSH_OPTS[@]}" "$@"; }
scp() { command scp "${SSH_OPTS[@]}" "$@"; }
retry() {
    local attempt
    for attempt in 1 2 3; do
        "$@" && return 0
        echo "    envoi interrompu, nouvelle tentative ($attempt/3)"
        sleep 5
    done
    return 1
}

echo "==> Construction"
npm run build

echo "==> Envoi"
send_output() {
    ssh "$REMOTE" "mkdir -p $REMOTE_DIR/backoffice && rm -rf $REMOTE_DIR/backoffice/.output" \
        && COPYFILE_DISABLE=1 tar czf - .output | ssh "$REMOTE" "tar xzf - -C $REMOTE_DIR/backoffice"
}
retry send_output
retry scp -q Dockerfile "$REMOTE:$REMOTE_DIR/backoffice/Dockerfile"

echo "==> Reconstruction de l'image et redémarrage"
ssh "$REMOTE" "cd $REMOTE_DIR && docker compose build backoffice && docker compose up -d backoffice"

echo "==> Vérification externe"
sleep 5
curl -s -o /dev/null -w "connexion HTTP %{http_code}\n" --max-time 30 "$PUBLIC_URL/connexion"

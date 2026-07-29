/**
 * Rétablit l'accès aux assets statiques après le build.
 *
 * Nitro génère ce lecteur d'assets :
 *
 *     const serverDir = dirname(fileURLToPath(import.meta.url));
 *     return readFile(resolve(serverDir, assets[id].path))   // path = "../public/_nuxt/…"
 *
 * Le chemin « ../public » suppose que ce code vive dans `.output/server/`. Or rollup le place
 * dans `.output/server/chunks/nitro/`, si bien qu'il cherche `.output/server/chunks/public`.
 * Résultat : tout le bundle client répond 500, la page est rendue en SSR mais ne s'hydrate
 * jamais — les champs ne réagissent plus et les boutons restent désactivés.
 *
 * Reproduit avec Nuxt 3.14 comme 3.17, avec nitropack 2.10 comme 2.12, et quelle que soit la
 * compatibilityDate. Le lien symbolique fait pointer le chemin attendu vers le vrai dossier,
 * sans toucher au bundle.
 *
 * À supprimer dès que la résolution amont est corrigée : le script échoue bruyamment si
 * `.output/public` disparaît, ce qui signalera le changement.
 */
import { existsSync, symlinkSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const publicDir = resolve('.output/public');
const expectedDir = resolve('.output/server/chunks/public');

if (!existsSync(publicDir)) {
    console.error('[assets] .output/public est introuvable — le build a-t-il abouti ?');
    process.exit(1);
}

if (existsSync(expectedDir)) {
    rmSync(expectedDir, { recursive: true, force: true });
}

// Lien relatif : l'image Docker ne partage pas l'arborescence de la machine de build.
symlinkSync('../../public', expectedDir, 'dir');
console.log('[assets] .output/server/chunks/public -> ../../public');

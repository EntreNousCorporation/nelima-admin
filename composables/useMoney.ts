/**
 * Mise en forme des nombres, en un seul endroit.
 *
 * `toLocaleString('fr-FR')` sépare les milliers par une **espace fine insécable** (U+202F), qui à
 * la taille de corps du portail ne se voit pratiquement pas : « 61 230 » se lisait « 61230 ». Trois
 * écrans tentaient déjà de la normaliser, avec une expression qui ne visait que l'espace ordinaire
 * et l'espace insécable ordinaire — donc jamais celle qu'Intl produit réellement.
 *
 * Le même piège existe côté serveur, où il est traité par `XofFormat` : c'est la locale qui décide
 * du séparateur, et il faut donc le normaliser après coup plutôt que l'espérer.
 */

/** Toutes les espaces qu'Intl peut poser entre les milliers, quelle que soit la version d'ICU. */
const THIN_SPACES = /[   ]/g;

/** Nombre entier, séparateur de milliers **visible**. */
export function fm(value?: number | null) {
    return Math.round(Number(value ?? 0)).toLocaleString('fr-FR').replace(THIN_SPACES, ' ');
}

/** Le même, suivi de l'unité. Le franc CFA n'a pas de subdivision : jamais de décimale. */
export function fcfa(value?: number | null) {
    return `${fm(value)} FCFA`;
}

/**
 * Forme compacte pour un chiffre clé, où la place manque.
 *
 * L'abrègement ne commence qu'au million : arrondir 500 F donnerait « 1k », soit le double de la
 * somme réelle. Sur un écran d'argent, un chiffre arrondi vers le haut est un chiffre faux, et
 * personne ne va vérifier.
 */
export function fmc(value?: number | null) {
    const amount = Math.round(Number(value ?? 0));
    if (amount >= 1_000_000) {
        return { value: (amount / 1_000_000).toFixed(1).replace('.', ','), unit: 'M FCFA' };
    }
    return { value: fm(amount), unit: 'FCFA' };
}

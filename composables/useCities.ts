/**
 * Référentiel des villes, servi par le backend.
 *
 * <p>La liste ne vit pas dans le front : une copie ici et une colonne libre là-bas, c'est
 * exactement ce qui a produit trois orthographes pour deux villes. Le serveur en est la seule
 * source, et il refuse ce qu'il ne connaît pas.
 */
export type City = {
    label: string;
    /** Région administrative, pour grouper la liste. Absente des villes reprises. */
    region?: string;
};

/**
 * Chargement unique par session de navigation.
 *
 * <p>Une centaine d'entrées qui ne bougent qu'à une livraison : les recharger à chaque ouverture
 * du formulaire ferait clignoter la liste sans jamais rien montrer de neuf. `useState` partage la
 * même promesse entre la création et la fiche, ouvertes sur le même écran.
 */
export function useCities() {
    const api = useApi();
    const cities = useState<City[]>('cities', () => []);
    const pending = useState<Promise<void> | null>('cities-pending', () => null);

    async function load() {
        if (cities.value.length) return;
        if (!pending.value) {
            pending.value = api<City[]>('/cities')
                .then((result) => { cities.value = result ?? []; })
                // Un échec ne laisse pas la promesse en place : la prochaine ouverture réessaie.
                .catch(() => { pending.value = null; });
        }
        await pending.value;
    }

    return { cities, load };
}

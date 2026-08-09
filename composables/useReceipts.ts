/**
 * Reçus d'encaissement de la plateforme, tous établissements confondus.
 *
 * <p>Réservé à l'équipe YPYit : la console interne agit sur toutes les écoles à la fois. Là où les
 * autres écrans du parc n'affichent que des agrégats — combien a été encaissé, par école, par mois —
 * cette source rend chaque reçu de façon nominative, avec le payeur. Le portail établissement, lui,
 * ne voit jamais que ses propres reçus.
 */
export type ReceiptChannel = 'ONLINE' | 'OFFLINE';

/**
 * Un reçu, tel que le renvoie le backend. `payerLabel` est le champ central de la vue : c'est la
 * personne qui a réglé, la seule information qui manquait jusqu'ici à la console.
 */
export type Receipt = {
    number: string;
    issuedAt: string;
    amount: number;
    payerLabel?: string;
    studentLabel?: string;
    studentRegistrationNumber?: string;
    studentClassName?: string;
    feeLabel?: string;
    channel?: ReceiptChannel;
    establishmentName?: string;
    paymentMethod?: string;
};

/** Enveloppe de pagination Spring. */
export type Page<T> = {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
};

export type ReceiptSearch = {
    page?: number;
    size?: number;
    keyword?: string;
    establishmentId?: string;
};

export function useReceipts() {
    const api = useApi();

    /**
     * Recherche paginée des reçus.
     *
     * <p>`keyword` et `establishmentId` sont filtrés côté serveur : la console n'a pas la liste
     * entière en mémoire, elle interroge le backend à chaque changement de filtre ou de page. Le
     * `keyword` cherche à la fois le numéro de reçu, l'élève, son matricule et le payeur. Un
     * `establishmentId` vide ne restreint rien. Le tri — date d'émission décroissante — est décidé
     * par le serveur.
     */
    function search({ page = 0, size = 20, keyword, establishmentId }: ReceiptSearch = {}) {
        return api<Page<Receipt>>('/admin/receipts', {
            query: {
                page,
                size,
                keyword: keyword?.trim() || undefined,
                establishmentId: establishmentId || undefined,
            },
        });
    }

    return { search };
}

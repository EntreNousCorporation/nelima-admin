/**
 * Parents de la plateforme, tous établissements confondus.
 *
 * <p>Réservé à l'équipe YPYit : la console interne agit sur toutes les écoles à la fois, et cette
 * liste croise des familles qui n'appartiennent pas au même établissement. Le portail établissement,
 * lui, ne voit jamais que ses propres parents.
 */
export type ContactType = 'EMAIL' | 'PHONE';

export type ParentContact = {
    id: string;
    type: ContactType;
    value: string;
    isPrimary: boolean;
    whatsApp: boolean;
};

/**
 * Enfant rattaché à un parent. `establishmentName` porte l'école de l'enfant : un même parent peut
 * en avoir dans plusieurs, et le filtre établissement ne masque jamais les autres.
 */
export type ParentChild = {
    id: string;
    firstName: string;
    lastName: string;
    registrationNumber: string;
    className?: string;
    levelLabel?: string;
    establishmentName?: string;
};

export type ParentListItem = {
    id: string;
    firstName: string;
    lastName: string;
    username?: string;
    contacts: ParentContact[];
    childrenCount: number;
    children: ParentChild[];
};

/** Enveloppe de pagination Spring. */
export type Page<T> = {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
};

export type ParentSearch = {
    page?: number;
    size?: number;
    keyword?: string;
    establishmentId?: string;
};

export function useParents() {
    const api = useApi();

    /**
     * Recherche paginée des parents.
     *
     * <p>`keyword` et `establishmentId` sont filtrés côté serveur : la console n'a pas la liste
     * entière en mémoire, elle interroge le backend à chaque changement de filtre ou de page.
     * Un `establishmentId` vide ne restreint rien.
     */
    function search({ page = 0, size = 20, keyword, establishmentId }: ParentSearch = {}) {
        return api<Page<ParentListItem>>('/admin/parents', {
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

/** Contact principal d'un parent : le marqué principal, sinon le premier venu. */
export function primaryContact(parent: ParentListItem): ParentContact | undefined {
    return parent.contacts?.find((contact) => contact.isPrimary) ?? parent.contacts?.[0];
}

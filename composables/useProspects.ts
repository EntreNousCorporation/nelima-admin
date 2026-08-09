/**
 * Demandes de démonstration venues du site public.
 *
 * <p>Réservées à YPYit : une demande porte le nom d'un directeur, son téléphone et l'effectif qu'il
 * annonce. Une école concurrente y lirait les prospects du marché.
 */
export type ProspectStatus = 'PENDING' | 'HANDLED' | 'DISMISSED';

export type Prospect = {
    id: string;
    schoolName: string;
    contactName: string;
    email: string;
    phone?: string;
    city?: string;
    studentCount?: number;
    message?: string;
    status: ProspectStatus;
    createdAt: string;
    handledAt?: string;
    handledNote?: string;
    sourcePage?: string;
    /** Formule que l'effectif déclaré appellerait. Prépare l'échange, n'engage rien. */
    suggestedPlan?: string;
};

export const PROSPECT_STATUSES: { value: ProspectStatus; label: string; tone: string }[] = [
    { value: 'PENDING', label: 'À rappeler', tone: 'warn' },
    { value: 'HANDLED', label: 'Traitée', tone: 'ok' },
    { value: 'DISMISSED', label: 'Écartée', tone: 'mute' },
];

export function prospectStatusLabel(status?: ProspectStatus | null) {
    return PROSPECT_STATUSES.find((s) => s.value === status)?.label ?? '—';
}

export function prospectStatusTone(status?: ProspectStatus | null) {
    return PROSPECT_STATUSES.find((s) => s.value === status)?.tone ?? 'mute';
}

export function useProspects() {
    const api = useApi();

    function all() {
        return api<Prospect[]>('/prospects');
    }

    function setStatus(id: string, status: ProspectStatus, note?: string) {
        return api<Prospect>(`/prospects/${id}/status`, { method: 'PUT', body: { status, note } });
    }

    return { all, setStatus };
}

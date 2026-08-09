/**
 * Abonnement des écoles à Nelima.
 *
 * Toutes ces routes sont réservées à YPYit : une école y lirait les tarifs consentis à ses
 * concurrentes et le chiffre d'affaires que la plateforme tire du parc.
 */

/**
 * Code d'une formule.
 *
 * <p>Une chaîne libre, et non une union fermée : la grille vit en base et YPYit y crée ses propres
 * formules. Figer les quatre paliers d'origine dans le type ferait échouer la compilation le jour
 * où quelqu'un en ajoute une depuis la console.
 */
export type SubscriptionPlan = string;

/** `LATE` et `PAID` sont déduits côté serveur, jamais stockés : une colonne périmée mentirait. */
export type InvoiceStatus = 'ISSUED' | 'PAID' | 'LATE' | 'CANCELLED';

export type Plan = {
    id: string;
    plan: SubscriptionPlan;
    label: string;
    description?: string;
    /** Nul pour le palier de tête : il n'a pas de plafond, son tarif se négocie. */
    maxStudents: number | null;
    price: number;
    active: boolean;
    position: number;
    /** Montrée sur nelima.ci. Une offre négociée reste interne. */
    isPublic: boolean;
    /** Mise en avant sur le site : une seule formule à la fois. */
    featured: boolean;
    /** Ce qui rend une formule indispensable — ou supprimable. */
    establishmentCount: number;
    invoiceCount: number;
};

export type PlanForm = {
    label: string;
    description?: string;
    maxStudents?: number | null;
    price: number;
    active?: boolean;
    position?: number;
    isPublic?: boolean;
    featured?: boolean;
};

export type SubscriptionInvoice = {
    id: string;
    number: string;
    establishmentId: string;
    establishmentName: string;
    plan: SubscriptionPlan;
    planLabel: string;
    amount: number;
    periodStart: string;
    periodEnd: string;
    issuedAt: string;
    dueAt: string;
    paidAt?: string;
    paymentMethod?: string;
    paymentReference?: string;
    cancelled: boolean;
    cancellationReason?: string;
    status: InvoiceStatus;
};

export type SubscriptionDue = {
    establishmentId: string;
    establishmentName: string;
    plan: SubscriptionPlan;
    planLabel: string;
    amount: number;
    periodStart: string;
    periodEnd: string;
    studentCount: number;
    /** Formule que l'effectif appellerait, quand elle diffère de celle qui est souscrite. */
    suggestedPlan?: SubscriptionPlan;
};

export const INVOICE_STATUSES: { value: InvoiceStatus; label: string; tone: string }[] = [
    { value: 'PAID', label: 'Payée', tone: 'ok' },
    { value: 'ISSUED', label: 'Émise', tone: 'info' },
    { value: 'LATE', label: 'En retard', tone: 'late' },
    { value: 'CANCELLED', label: 'Annulée', tone: 'mute' },
];

export function invoiceStatusLabel(status?: InvoiceStatus | null) {
    return INVOICE_STATUSES.find((s) => s.value === status)?.label ?? '—';
}

export function invoiceStatusTone(status?: InvoiceStatus | null) {
    return INVOICE_STATUSES.find((s) => s.value === status)?.tone ?? 'mute';
}

/**
 * Teinte de la formule. Un repère de plus dans un tableau, jamais un état.
 *
 * <p>Déduite du code plutôt que déclarée : la grille étant libre, une table figée laisserait toute
 * formule créée depuis la console sans couleur. Les quatre paliers d'origine gardent la leur.
 */
const PLAN_PALETTE = [
    'var(--brand-700)', 'var(--purple)', 'var(--success)', 'var(--warning)', 'var(--navy)',
];
const PLAN_FIXED: Record<string, string> = {
    DECOUVERTE: 'var(--text-muted)',
    STANDARD: 'var(--brand-700)',
    PRO: 'var(--purple)',
    ENTERPRISE: 'var(--success)',
};

export function planTone(plan?: SubscriptionPlan | null) {
    if (!plan) return 'var(--text-faint)';
    if (PLAN_FIXED[plan]) return PLAN_FIXED[plan];
    const sum = [...plan].reduce((total, char) => total + char.charCodeAt(0), 0);
    return PLAN_PALETTE[sum % PLAN_PALETTE.length];
}

/** Compatibilité de lecture : `PLAN_TONES[code]` reste écrit dans les gabarits. */
export const PLAN_TONES = new Proxy({} as Record<string, string>, {
    get: (_target, key: string) => planTone(key),
});

/**
 * Libellés des formules, tenus à jour par le premier écran qui charge la grille.
 *
 * <p>Tous les écrans n'appellent pas `/subscriptions/plans` — la vue du parc n'a que le code porté
 * par chaque école. Plutôt qu'une table figée, qui laisserait toute formule créée depuis la console
 * affichée en code brut, le cache est alimenté dès qu'une grille passe. Le code reste le repli :
 * mieux vaut « OFFRE_DE_LANCEMENT » qu'un tiret.
 */
const planLabels = reactive<Record<string, string>>({
    DECOUVERTE: 'Découverte',
    STANDARD: 'Standard',
    PRO: 'Pro',
    ENTERPRISE: 'Enterprise',
});

export function rememberPlans(plans: Plan[]) {
    plans.forEach((plan) => { planLabels[plan.plan] = plan.label; });
}

export const PLAN_LABELS = new Proxy({} as Record<string, string>, {
    get: (_target, key: string) => planLabels[key] ?? key,
});

export function useSubscriptions() {
    const api = useApi();

    async function plans(includeInactive = false) {
        const grid = await api<Plan[]>('/subscriptions/plans', { query: { includeInactive } });
        rememberPlans(grid);
        return grid;
    }

    function createPlan(body: PlanForm) {
        return api<Plan>('/subscriptions/plans', { method: 'POST', body });
    }

    function updatePlan(id: string, body: PlanForm) {
        return api<Plan>(`/subscriptions/plans/${id}`, { method: 'PUT', body });
    }

    function deletePlan(id: string) {
        return api(`/subscriptions/plans/${id}`, { method: 'DELETE' });
    }

    function subscribe(establishmentId: string, body: { plan: SubscriptionPlan; subscribedAt?: string }) {
        return api(`/subscriptions/establishments/${establishmentId}`, { method: 'PUT', body });
    }

    function invoices() {
        return api<SubscriptionInvoice[]>('/subscriptions/invoices');
    }

    function invoicesOf(establishmentId: string) {
        return api<SubscriptionInvoice[]>(`/subscriptions/invoices/establishment/${establishmentId}`);
    }

    function due() {
        return api<SubscriptionDue[]>('/subscriptions/due');
    }

    function issue(establishmentId: string) {
        return api<SubscriptionInvoice>(`/subscriptions/invoices/establishment/${establishmentId}`,
            { method: 'POST' });
    }

    function recordPayment(invoiceId: string,
                           body: { paidOn?: string; method?: string; reference?: string }) {
        return api<SubscriptionInvoice>(`/subscriptions/invoices/${invoiceId}/payment`,
            { method: 'POST', body });
    }

    function cancel(invoiceId: string, reason: string) {
        return api<SubscriptionInvoice>(`/subscriptions/invoices/${invoiceId}/cancellation`,
            { method: 'POST', body: { reason } });
    }

    return { plans, createPlan, updatePlan, deletePlan, subscribe, invoices, invoicesOf, due, issue, recordPayment, cancel };
}

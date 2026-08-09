<script setup lang="ts">
import { fm, fmc } from '~/composables/useMoney';
import {
    PLAN_LABELS, PLAN_TONES, type SubscriptionInvoice, type SubscriptionPlan,
} from '~/composables/useSubscriptions';

/**
 * Parc clients.
 *
 * Trois appels : `/dashboard/summary`, qui rend les mêmes agrégats qu'à une école mais sans portée
 * lorsqu'un administrateur l'appelle — donc à l'échelle du parc —, `/dashboard/platform`, qui ajoute
 * ce dont YPYit est seul à avoir besoin (sa commission, la ventilation par école, le contrat de
 * chacune), et les factures d'abonnement, d'où sort le revenu récurrent.
 *
 * <p>Les deux revenus ne se mélangent pas : l'abonnement est un montant annuel dû par l'école, la
 * commission un prélèvement sur les paiements en ligne des familles. Les additionner donnerait un
 * chiffre que personne ne pourrait rapprocher de quoi que ce soit.
 */
type MonthlyPoint = { month: string; expected: number; collected: number };

type Summary = {
    studentCount: number;
    collectedThisMonth: number;
    collectedPreviousMonth: number;
    expectedThisMonth: number;
    receiptsThisMonth: number;
    monthly: MonthlyPoint[];
    overdueAmount: number;
    overdueCount: number;
};

type SchoolRow = {
    id: string;
    name: string;
    active: boolean;
    studentCount: number;
    collectedThisMonth: number;
    expectedThisMonth: number;
    commissionThisMonth: number;
    overdueAmount: number;
    overdueCount: number;
    subscriptionPlan?: SubscriptionPlan;
    subscribedAt?: string;
    subscriptionAmount?: number;
};

type Platform = {
    schoolCount: number;
    activeSchoolCount: number;
    schoolCountBeforeThisMonth: number;
    studentCountBeforeThisMonth: number;
    commissionThisMonth: number;
    commissionPreviousMonth: number;
    onlineCollectedThisMonth: number;
    schools: SchoolRow[];
};

const request = useRequestFetch();

const { data, pending, error } = await useAsyncData('platform-overview', async () => {
    const [summary, platform, invoices] = await Promise.all([
        request('/api/v1/dashboard/summary') as Promise<Summary>,
        request('/api/v1/dashboard/platform') as Promise<Platform>,
        // Une console qui tombe faute de factures ne servirait plus à en émettre.
        (request('/api/v1/subscriptions/invoices') as Promise<SubscriptionInvoice[]>)
            .catch(() => [] as SubscriptionInvoice[]),
    ]);
    return { summary, platform, invoices };
});

const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
const year = new Date().getFullYear();

/* ---------------- Abonnements ---------------- */

/** Facturé sur l'année civile, annulations exclues : une facture annulée n'est pas un revenu. */
const billed = computed(() => (data.value?.invoices ?? [])
    .filter((invoice) => invoice.status !== 'CANCELLED'
        && new Date(invoice.periodStart).getFullYear() === year));

const billedTotal = computed(() => billed.value
    .reduce((total, invoice) => total + Number(invoice.amount ?? 0), 0));

const cashedTotal = computed(() => billed.value
    .filter((invoice) => invoice.status === 'PAID')
    .reduce((total, invoice) => total + Number(invoice.amount ?? 0), 0));

const lateInvoices = computed(() => billed.value.filter((invoice) => invoice.status === 'LATE'));

/**
 * Revenu récurrent, mois par mois.
 *
 * <p>Une facture est portée par son mois d'émission, et son règlement par le mois où il a été
 * constaté : c'est ce que le graphe compare — ce qui a été facturé, et ce qui est effectivement
 * rentré. La série couvre douze mois glissants.
 */
const recurringMonths = computed(() => {
    const months: { month: string; back: number; front: number }[] = [];
    const cursor = new Date();
    cursor.setDate(1);
    cursor.setMonth(cursor.getMonth() - 11);
    for (let index = 0; index < 12; index += 1) {
        months.push({
            month: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
            back: 0,
            front: 0,
        });
        cursor.setMonth(cursor.getMonth() + 1);
    }
    const slot = new Map(months.map((entry) => [entry.month, entry]));

    for (const invoice of data.value?.invoices ?? []) {
        if (invoice.cancelled) continue;
        const issued = slot.get((invoice.issuedAt ?? '').slice(0, 7));
        if (issued) issued.back += Number(invoice.amount ?? 0);
        const paid = invoice.paidAt ? slot.get(invoice.paidAt.slice(0, 7)) : undefined;
        if (paid) paid.front += Number(invoice.amount ?? 0);
    }
    return months;
});

/** Part de chaque palier dans le revenu récurrent, sur les montants figés à l'émission. */
const byPlan = computed(() => {
    const buckets = new Map<SubscriptionPlan, { amount: number; count: number }>();
    for (const invoice of billed.value) {
        const bucket = buckets.get(invoice.plan) ?? { amount: 0, count: 0 };
        bucket.amount += Number(invoice.amount ?? 0);
        bucket.count += 1;
        buckets.set(invoice.plan, bucket);
    }
    const total = billedTotal.value || 1;
    return [...buckets.entries()]
        .map(([plan, bucket]) => ({
            plan,
            label: PLAN_LABELS[plan],
            amount: bucket.amount,
            count: bucket.count,
            share: (bucket.amount / total) * 100,
        }))
        .sort((a, b) => b.amount - a.amount);
});

/**
 * Activité du parc.
 *
 * <p>Des faits datés, pas un journal : chaque ligne se relit dans la donnée dont elle sort — une
 * souscription porte sa date, une facture son émission et son règlement. Rien n'est stocké pour
 * l'occasion, comme pour la cloche du portail.
 */
const activity = computed(() => {
    const events: {
        at: string; school?: string; label: string; detail: string; icon: string; tone: string;
    }[] = [];

    for (const school of data.value?.platform.schools ?? []) {
        if (!school.subscribedAt) continue;
        events.push({
            at: school.subscribedAt, school: school.id, label: school.name,
            detail: school.subscriptionPlan
                ? `a souscrit en ${PLAN_LABELS[school.subscriptionPlan]}` : 'a souscrit',
            // Même vocabulaire que la maquette : l'étincelle marque l'arrivée d'un client,
            // la caisse un règlement, l'interdit une annulation.
            icon: 'sparkles', tone: 'var(--brand-700)',
        });
    }
    for (const invoice of data.value?.invoices ?? []) {
        if (invoice.cancelled) {
            events.push({
                at: invoice.issuedAt, school: invoice.establishmentId,
                label: invoice.establishmentName,
                detail: `facture ${invoice.number} annulée · ${invoice.cancellationReason ?? 'motif non précisé'}`,
                icon: 'ban', tone: 'var(--danger)',
            });
            continue;
        }
        events.push({
            at: invoice.issuedAt, school: invoice.establishmentId, label: invoice.establishmentName,
            detail: `facture ${invoice.number} émise · ${fm(invoice.amount)} F`,
            icon: 'receipt', tone: 'var(--navy)',
        });
        if (invoice.paidAt) {
            events.push({
                at: invoice.paidAt, school: invoice.establishmentId, label: invoice.establishmentName,
                detail: `facture ${invoice.number} réglée${invoice.paymentMethod ? ` par ${invoice.paymentMethod.toLowerCase()}` : ''} · ${fm(invoice.amount)} F`,
                icon: 'cash', tone: 'var(--success)',
            });
        }
    }
    return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
});

/**
 * Variation d'une grandeur, en pourcentage.
 *
 * <p>Nulle quand le point de comparaison est à zéro : une progression « infinie » ne veut rien
 * dire, et afficher « +100 % » sur un premier mois d'activité laisserait croire à une croissance
 * là où il n'y a qu'un début.
 */
function growth(now: number, before: number) {
    if (!before) return null;
    const delta = Math.round(((now - before) / before) * 1000) / 10;
    // Zéro est tu : la flèche verte d'un « +0 % » annoncerait une hausse qui n'a pas eu lieu.
    return delta === 0 ? null : delta;
}

/** Croissance du revenu récurrent : l'année civile en cours, rapportée à la précédente. */
const recurringGrowth = computed(() => {
    const previous = (data.value?.invoices ?? [])
        .filter((invoice) => invoice.status !== 'CANCELLED'
            && new Date(invoice.periodStart).getFullYear() === year - 1)
        .reduce((total, invoice) => total + Number(invoice.amount ?? 0), 0);
    return growth(billedTotal.value, previous);
});

const schoolGrowth = computed(() => growth(
    Number(data.value?.platform.schoolCount ?? 0),
    Number(data.value?.platform.schoolCountBeforeThisMonth ?? 0)));

const studentGrowth = computed(() => growth(
    Number(data.value?.summary.studentCount ?? 0),
    Number(data.value?.platform.studentCountBeforeThisMonth ?? 0)));

const collectedGrowth = computed(() => growth(
    Number(data.value?.summary.collectedThisMonth ?? 0),
    Number(data.value?.summary.collectedPreviousMonth ?? 0)));

/* ---------------- Scolarités ---------------- */

const recoveryRate = computed(() => {
    const expected = Number(data.value?.summary.expectedThisMonth ?? 0);
    if (!expected) return null;
    return ((data.value?.summary.collectedThisMonth ?? 0) / expected) * 100;
});

/**
 * Recouvrement d'une école : ce qui est rentré, rapporté à ce que l'échéancier prévoyait ce mois.
 *
 * <p>Ce n'est pas le score sur 100 de la maquette, qui composait des grandeurs sans rapport. C'est
 * une mesure, et une école peut la refaire elle-même sur son propre tableau de bord.
 */
function recoveryOf(school: SchoolRow) {
    const expected = Number(school.expectedThisMonth ?? 0);
    if (!expected) return null;
    return (Number(school.collectedThisMonth ?? 0) / expected) * 100;
}

const SEUIL_SURVEILLANCE = 70;

const watchlist = computed(() => (data.value?.platform.schools ?? [])
    .map((school) => ({ school, rate: recoveryOf(school) }))
    .filter((row): row is { school: SchoolRow; rate: number } =>
        row.rate !== null && row.rate < SEUIL_SURVEILLANCE)
    .sort((a, b) => a.rate - b.rate));

/** Écoles sans contrat : elles ne seront jamais facturées tant que rien n'est arrêté. */
const withoutPlan = computed(() => (data.value?.platform.schools ?? [])
    .filter((school) => !school.subscriptionPlan).length);

function openSchool(id: string) {
    return navigateTo(`/app/etablissements?ecole=${id}`);
}

function day(iso?: string) {
    return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—';
}
</script>

<template>
    <div>
        <PageHead
            title="Parc clients"
            :sub="`Nelima · ${data?.platform.schoolCount ?? 0} établissement${(data?.platform.schoolCount ?? 0) > 1 ? 's' : ''} · ${monthLabel}`"
        >
            <template #actions>
                <NuxtLink to="/app/etablissements" class="btn-primary">
                    <BoIcon name="plus" :size="16" />Nouveau partenaire
                </NuxtLink>
            </template>
        </PageHead>

        <p v-if="error" class="alert-danger mb-3.5" role="alert">
            Les chiffres du parc n'ont pas pu être chargés. Rechargez la page dans un instant.
        </p>

        <div class="grid-12 mb-3.5">
            <KpiCard
                class="c3" label="Revenu récurrent" icon="cash"
                :value="fmc(billedTotal).value" :unit="`${fmc(billedTotal).unit} / an`"
                :delta="recurringGrowth"
                :foot="billedTotal
                    ? `${fm(cashedTotal)} F encaissés · ${lateInvoices.length} en retard`
                    : 'aucun abonnement facturé cette année'"
                tip="Abonnements facturés sur l'année civile, annulations exclues. C'est le revenu contractuel du parc, distinct des commissions."
            />
            <KpiCard
                class="c3" label="Écoles clientes" icon="building"
                :value="String(data?.platform.schoolCount ?? 0)" :delta="schoolGrowth"
                :foot="`${data?.platform.activeSchoolCount ?? 0} active(s) · ${withoutPlan} sans formule · ${lateInvoices.length} en défaut`"
                tip="Établissements principaux du parc. Une antenne rattachée à un réseau n'est pas un client de plus."
            />
            <KpiCard
                class="c3" label="Élèves gérés" icon="students"
                :value="fm(data?.summary.studentCount)" :delta="studentGrowth"
                foot="sur l'ensemble du parc"
                tip="Volume d'élèves administrés dans Nelima. C'est lui qui appelle un palier d'abonnement, sans l'imposer : la formule retenue prime."
            />
            <KpiCard
                class="c3" label="Scolarités transitées" icon="percent"
                :value="fmc(data?.summary.collectedThisMonth).value"
                :unit="fmc(data?.summary.collectedThisMonth).unit" :delta="collectedGrowth"
                :foot="recoveryRate !== null
                    ? `${recoveryRate.toFixed(0)} % de l'attendu · ${fm(data?.platform.commissionThisMonth)} F de commission`
                    : 'aucune échéance ce mois'"
                tip="Frais de scolarité encaissés ce mois par l'ensemble des écoles. YPYit n'en perçoit que la commission, sur la seule part en ligne."
            >
                <template #chart>
                    <!-- Toujours présent, y compris sans échéance du mois : l'anneau vide dit
                         « rien à recouvrer », alors que son absence laisse croire à un bogue. -->
                    <StatDonut
                        :percent="recoveryRate ?? 0" :label="recoveryRate === null ? '—' : undefined"
                        :tone="recoveryRate === null ? 'var(--border-strong)'
                            : recoveryRate < 80 ? 'var(--warning-solid)' : 'var(--success-solid)'"
                    />
                </template>
            </KpiCard>
        </div>

        <div class="grid-12 mb-3.5">
            <UiCard
                class="c8"
                title="Revenu récurrent" sub="Abonnements facturés et réglés, mois par mois"
                tip="Barre claire : abonnements facturés, portés par leur mois d'émission. Barre pleine : règlements constatés."
            >
                <BarsCompare :points="recurringMonths" back-label="Facturé" front-label="Encaissé" />
            </UiCard>

            <UiCard
                class="c4" :pad="false"
                title="Répartition par formule" :sub="`${fm(billedTotal)} FCFA facturés en ${year}`"
                tip="Part de chaque palier dans le revenu récurrent, sur les montants figés à l'émission : changer un tarif ne réécrit pas ce qui a déjà été facturé."
            >
                <EmptyState
                    v-if="!byPlan.length"
                    title="Rien de facturé"
                    text="Renseignez la formule des écoles : leurs périodes apparaîtront dans Facturation."
                />
                <div v-else class="p-4 flex flex-col gap-3.5">
                    <div v-for="entry in byPlan" :key="entry.plan">
                        <div class="flex items-baseline justify-between mb-1.5">
                            <b class="text-[12.5px] font-bold" :style="{ color: PLAN_TONES[entry.plan] }">
                                {{ entry.label }} · {{ entry.count }} école(s)
                            </b>
                            <span class="nu text-[12.5px]" style="color: var(--navy)">
                                {{ fm(entry.amount) }} F
                            </span>
                        </div>
                        <div class="h-2 rounded-full overflow-hidden" style="background: var(--surface-sunken)">
                            <div
                                class="h-full rounded-full"
                                :style="{ width: `${entry.share}%`, background: PLAN_TONES[entry.plan] }"
                            />
                        </div>
                        <span class="text-[11.5px]" style="color: var(--text-faint)">
                            {{ entry.share.toFixed(0) }} % du revenu récurrent
                        </span>
                    </div>
                </div>
            </UiCard>
        </div>

        <div class="grid-12">
            <UiCard
                class="c7" :pad="false"
                title="Écoles à surveiller" :sub="`Recouvrement sous ${SEUIL_SURVEILLANCE} % ce mois`"
                tip="Encaissé rapporté à l'attendu de l'échéancier. Un recouvrement durablement bas fragilise l'école, et finit par fragiliser son abonnement."
            >
                <template #action>
                    <NuxtLink to="/app/etablissements" class="btn-secondary btn-sm">
                        Toutes les écoles
                    </NuxtLink>
                </template>

                <div
                    v-if="pending || watchlist.length" class="table-wrap"
                    style="border: 0; box-shadow: none; border-radius: 0"
                >
                    <table class="table">
                        <thead>
                            <tr>
                                <th>École</th>
                                <th>Formule</th>
                                <th class="r">Recouvrement</th>
                                <th class="r">Impayés</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <TableSkeleton v-if="pending" :columns="5" />
                            <tr
                                v-for="row in watchlist" v-else :key="row.school.id" class="cl"
                                @click="openSchool(row.school.id)"
                            >
                                <td>
                                    <div class="flex items-center gap-2.5">
                                        <AvatarBadge :name="row.school.name" :size="28" />
                                        <div class="nm min-w-0">
                                            <b>{{ row.school.name }}</b>
                                            <span>{{ row.school.studentCount }} élève(s)</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span
                                        v-if="row.school.subscriptionPlan" class="tag"
                                        :style="{ color: PLAN_TONES[row.school.subscriptionPlan] }"
                                    >{{ PLAN_LABELS[row.school.subscriptionPlan] }}</span>
                                    <span v-else class="text-[12px]" style="color: var(--warning)">
                                        à définir
                                    </span>
                                </td>
                                <td class="r">
                                    <div class="flex items-center gap-2.5 justify-end">
                                        <div
                                            class="h-1.5 w-16 rounded-full overflow-hidden"
                                            style="background: var(--surface-sunken)"
                                        >
                                            <div
                                                class="h-full rounded-full"
                                                :style="{ width: `${Math.min(100, row.rate)}%`,
                                                          background: 'var(--warning-solid)' }"
                                            />
                                        </div>
                                        <b class="nu text-[12px]" style="color: var(--warning)">
                                            {{ row.rate.toFixed(0) }} %
                                        </b>
                                    </div>
                                </td>
                                <td class="num" style="color: var(--danger)">
                                    {{ fm(row.school.overdueAmount) }} F
                                </td>
                                <td class="text-right">
                                    <BoIcon name="chevron-right" :size="16" style="color: var(--text-faint)" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <EmptyState
                    v-if="!pending && !watchlist.length"
                    title="Aucun compte à surveiller"
                    text="Aucune école du parc ne décroche sur son recouvrement ce mois-ci."
                />
            </UiCard>

            <UiCard
                class="c5" :pad="false"
                title="Activité du parc" sub="Souscriptions, émissions et règlements"
                tip="Des faits datés, relus depuis les contrats et les factures. Rien n'est journalisé pour cet écran."
            >
                <EmptyState
                    v-if="!activity.length"
                    title="Aucune activité"
                    text="Les souscriptions et les factures d'abonnement apparaîtront ici."
                />
                <div v-else class="lst">
                    <button
                        v-for="(event, index) in activity" :key="index"
                        class="flex items-center gap-2.5 w-full text-left"
                        @click="event.school && openSchool(event.school)"
                    >
                        <span
                            class="w-8 h-8 rounded-[10px] grid place-items-center shrink-0"
                            :style="{ color: event.tone,
                                       background: `color-mix(in srgb, ${event.tone} 12%, transparent)` }"
                        >
                            <BoIcon :name="event.icon" :size="16" />
                        </span>
                        <div class="nm flex-1 min-w-0">
                            <b>{{ event.label }}</b>
                            <span>{{ event.detail }}</span>
                        </div>
                        <span class="text-[11px] font-semibold shrink-0" style="color: var(--text-faint)">
                            {{ day(event.at) }}
                        </span>
                    </button>
                </div>
            </UiCard>
        </div>
    </div>
</template>

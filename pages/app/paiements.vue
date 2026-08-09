<script setup lang="ts">
import { fm, fmc } from '~/composables/useMoney';

/**
 * Paiements des scolarités, à l'échelle du parc.
 *
 * Ce que les écoles encaissent par Nelima, et ce que Nelima en retire. À ne pas confondre avec
 * l'onglet Facturation, qui porte sur ce que les écoles doivent à YPYit — deux flux d'argent
 * distincts, dans deux sens différents.
 */
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
};

type Platform = {
    schoolCount: number;
    activeSchoolCount: number;
    commissionThisMonth: number;
    commissionPreviousMonth: number;
    onlineCollectedThisMonth: number;
    schools: SchoolRow[];
};

type Summary = {
    collectedThisMonth: number;
    expectedThisMonth: number;
    collectedPreviousMonth: number;
    expectedPreviousMonth: number;
    overdueAmount: number;
    overdueCount: number;
};

const request = useRequestFetch();

const { data, pending, error } = await useAsyncData('platform-flows', async () => {
    const [summary, platform] = await Promise.all([
        request('/api/v1/dashboard/summary') as Promise<Summary>,
        request('/api/v1/dashboard/platform') as Promise<Platform>,
    ]);
    return { summary, platform };
});

/** La fiche école est unique : les écrans du parc y renvoient plutôt que de la dupliquer. */
function openSchool(id: string) {
    return navigateTo(`/app/etablissements?ecole=${id}`);
}

const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

/** Recouvrement du parc : ce qui est rentré rapporté à ce qui était attendu. */
const recoveryRate = computed(() => {
    const expected = Number(data.value?.summary.expectedThisMonth ?? 0);
    if (!expected) return null;
    return (Number(data.value?.summary.collectedThisMonth ?? 0) / expected) * 100;
});

/**
 * Écart de commission avec le mois précédent.
 *
 * Nul quand le mois précédent est à zéro : une progression « infinie » ne veut rien dire, et
 * afficher « +100 % » sur un premier mois d'activité serait trompeur.
 */
const commissionDelta = computed(() => {
    const previous = Number(data.value?.platform.commissionPreviousMonth ?? 0);
    if (!previous) return null;
    const current = Number(data.value?.platform.commissionThisMonth ?? 0);
    return Math.round(((current - previous) / previous) * 1000) / 10;
});

/** Écoles classées par volume traité : ce sont les comptes stratégiques du parc. */
const byVolume = computed(() => (data.value?.platform.schools ?? [])
    .slice()
    .sort((a, b) => Number(b.collectedThisMonth ?? 0) - Number(a.collectedThisMonth ?? 0))
    .slice(0, 10));

/**
 * Variation d'une grandeur, en pourcentage.
 *
 * <p>Nulle quand le point de comparaison est à zéro, et quand l'écart l'est aussi : une flèche
 * verte à « +0 % » annoncerait une hausse qui n'a pas eu lieu.
 */
function growth(now: number, before: number) {
    if (!before) return null;
    const delta = Math.round(((now - before) / before) * 1000) / 10;
    return delta === 0 ? null : delta;
}

const volumeDelta = computed(() => growth(
    Number(data.value?.summary.collectedThisMonth ?? 0),
    Number(data.value?.summary.collectedPreviousMonth ?? 0)));

/**
 * Tendance du recouvrement, en points de pourcentage.
 *
 * <p>Un taux se compare en points, pas en pourcentage de pourcentage : passer de 80 % à 76 %, c'est
 * « −4 points », pas « −5 % ». Le libellé de la carte le rappelle.
 */
const recoveryDelta = computed(() => {
    const expectedBefore = Number(data.value?.summary.expectedPreviousMonth ?? 0);
    if (!expectedBefore || recoveryRate.value === null) return null;
    const before = (Number(data.value?.summary.collectedPreviousMonth ?? 0) / expectedBefore) * 100;
    const delta = Math.round((recoveryRate.value - before) * 10) / 10;
    return delta === 0 ? null : delta;
});

/** Recouvrement d'une école : encaissé du mois rapporté à ce que l'échéancier prévoyait. */
function recoveryOf(school: SchoolRow) {
    const expected = Number(school.expectedThisMonth ?? 0);
    if (!expected) return null;
    return (Number(school.collectedThisMonth ?? 0) / expected) * 100;
}

/**
 * Écoles dont les impayés pèsent le plus.
 *
 * Le prototype classe par « santé du compte », un score composite. Le montant réellement dû dit la
 * même chose sans rien inventer, et se vérifie ligne à ligne.
 */
/**
 * Moyens de règlement.
 *
 * <p>Deux parts, et non la liste des opérateurs : le reçu ne retient que le canal — en ligne ou au
 * guichet. Ventiler par Wave, Orange Money ou espèces demanderait de le porter sur la pièce, ce qui
 * n'a pas été acté. La distinction qui compte pour YPYit est déjà là : seule la part en ligne
 * produit une commission.
 */
const channels = computed(() => {
    const total = Number(data.value?.summary.collectedThisMonth ?? 0);
    const online = Number(data.value?.platform.onlineCollectedThisMonth ?? 0);
    if (!total) return [];
    return [
        {
            label: 'En ligne', amount: online, share: (online / total) * 100,
            tone: 'var(--brand-600)', foot: 'commissionné',
        },
        {
            label: 'Au guichet', amount: total - online, share: ((total - online) / total) * 100,
            tone: 'var(--text-faint)', foot: 'encaissé par l\'école, sans commission',
        },
    ];
});

const atRisk = computed(() => (data.value?.platform.schools ?? [])
    .filter((school) => Number(school.overdueAmount ?? 0) > 0)
    .sort((a, b) => Number(b.overdueAmount ?? 0) - Number(a.overdueAmount ?? 0))
    .slice(0, 6));
</script>

<template>
    <div>
        <PageHead
            title="Paiements des scolarités"
            :sub="`Flux traité pour l'ensemble du parc · ${monthLabel}`"
        />

        <p v-if="error" class="alert-danger mb-3.5" role="alert">
            Les flux du parc n'ont pas pu être chargés.
        </p>

        <div class="grid-12 mb-3.5">
            <KpiCard
                class="c3" label="Volume traité" icon="cash"
                :value="fmc(data?.summary.collectedThisMonth).value"
                :unit="fmc(data?.summary.collectedThisMonth).unit"
                :delta="volumeDelta"
                :foot="`sur ${fm(data?.summary.expectedThisMonth)} attendus`"
                tip="Montant des scolarités encaissées ce mois par l'ensemble des écoles, guichet compris."
            />
            <KpiCard
                class="c3" label="Recouvrement du parc" icon="percent"
                :value="recoveryRate !== null ? recoveryRate.toFixed(1).replace('.', ',') : '—'"
                :unit="recoveryRate !== null ? '%' : undefined"
                :delta="recoveryDelta"
                :foot="recoveryDelta !== null ? 'points par rapport au mois dernier'
                    : recoveryRate !== null ? 'de l\'attendu du mois' : 'aucune échéance ce mois'"
                tip="Part des frais attendus réellement encaissée, toutes écoles confondues. Un parc sain se situe au-dessus de 80 %."
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
            <KpiCard
                class="c3" label="Reste à recouvrer" icon="alert"
                :value="fmc(data?.summary.overdueAmount).value"
                :unit="fmc(data?.summary.overdueAmount).unit"
                :foot="`${data?.summary.overdueCount ?? 0} échéance(s) dépassée(s)`"
                tip="Sommes dues par les familles sur l'ensemble des écoles clientes. C'est leur argent à recouvrer, pas celui de YPYit."
            />
            <KpiCard
                class="c3" label="Commissions Nelima" icon="receipt"
                :value="fmc(data?.platform.commissionThisMonth).value"
                :unit="fmc(data?.platform.commissionThisMonth).unit"
                :delta="commissionDelta"
                :foot="`sur ${fm(data?.platform.onlineCollectedThisMonth)} en ligne`"
                tip="Part revenant à YPYit sur les paiements en ligne. Prélevée à chaque transaction, en plus des abonnements."
            />
        </div>

        <div class="grid-12">
            <UiCard
                class="c7" :pad="false"
                title="Volume par école" sub="Scolarités encaissées ce mois"
                tip="Classement par montant transité. Le guichet y figure autant que le paiement en ligne."
            >
                <div class="table-wrap" style="border: 0; box-shadow: none; border-radius: 0">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>École</th>
                                <th class="r">Encaissé</th>
                                <th class="r">Attendu</th>
                                <th class="r">Recouvrement</th>
                                <th class="r">Commission</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <TableSkeleton v-if="pending" :columns="6" />
                            <tr
                                v-for="school in byVolume" v-else :key="school.id" class="cl"
                                @click="openSchool(school.id)"
                            >
                                <td>
                                    <div class="flex items-center gap-2.5">
                                        <AvatarBadge :name="school.name" :size="28" />
                                        <div class="nm min-w-0">
                                            <b>{{ school.name }}</b>
                                            <span>{{ school.studentCount }} élève(s)</span>
                                        </div>
                                    </div>
                                </td>
                                <td class="num">{{ fm(school.collectedThisMonth) }} F</td>
                                <td class="num" style="color: var(--text-faint)">
                                    {{ fm(school.expectedThisMonth) }} F
                                </td>
                                <td class="r">
                                    <div v-if="recoveryOf(school) !== null"
                                         class="flex items-center gap-2.5 justify-end">
                                        <div class="h-1.5 w-14 rounded-full overflow-hidden"
                                             style="background: var(--surface-sunken)">
                                            <div
                                                class="h-full rounded-full"
                                                :style="{ width: `${Math.min(100, recoveryOf(school)!)}%`,
                                                          background: recoveryOf(school)! < 70
                                                              ? 'var(--warning-solid)' : 'var(--success-solid)' }"
                                            />
                                        </div>
                                        <b class="nu text-[12px]" style="color: var(--text-muted)">
                                            {{ recoveryOf(school)!.toFixed(0) }} %
                                        </b>
                                    </div>
                                    <span v-else class="text-[12px]" style="color: var(--text-faint)">—</span>
                                </td>
                                <td class="num" style="color: var(--success)">
                                    {{ fm(school.commissionThisMonth) }} F
                                </td>
                                <td class="text-right">
                                    <BoIcon name="chevron-right" :size="16" style="color: var(--text-faint)" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <EmptyState
                    v-if="!pending && !byVolume.length"
                    title="Aucun encaissement"
                    text="Les scolarités encaissées par les écoles apparaîtront ici au fil du mois."
                />
            </UiCard>

            <div class="c5 flex flex-col gap-3.5 min-w-0">
            <UiCard
                :pad="false"
                title="Moyens de règlement"
                :sub="`${fm(data?.summary.collectedThisMonth)} FCFA traités ce mois`"
                tip="Le reçu ne retient que le canal. Seule la part en ligne passe par l'agrégateur, et elle seule produit une commission."
            >
                <EmptyState
                    v-if="!channels.length"
                    title="Aucun règlement"
                    text="La répartition apparaîtra dès le premier encaissement du mois."
                />
                <div v-else class="p-4 flex flex-col gap-3.5">
                    <div v-for="channel in channels" :key="channel.label">
                        <div class="flex items-baseline justify-between mb-1.5">
                            <b class="text-[12.5px] font-bold" style="color: var(--navy)">
                                {{ channel.label }}
                            </b>
                            <span class="nu text-[12.5px]" style="color: var(--navy)">
                                {{ fm(channel.amount) }} F
                            </span>
                        </div>
                        <div class="h-2 rounded-full overflow-hidden" style="background: var(--surface-sunken)">
                            <div
                                class="h-full rounded-full"
                                :style="{ width: `${channel.share}%`, background: channel.tone }"
                            />
                        </div>
                        <span class="text-[11.5px]" style="color: var(--text-faint)">
                            {{ channel.share.toFixed(0) }} % · {{ channel.foot }}
                        </span>
                    </div>
                </div>
            </UiCard>

            <UiCard
                :pad="false"
                title="Recouvrement le plus faible" sub="Écoles sous surveillance"
                tip="Classées par taux de recouvrement du mois. Un recouvrement durablement bas fragilise l'école, et finit par fragiliser son abonnement."
            >
                <EmptyState
                    v-if="!pending && !atRisk.length"
                    title="Aucune échéance ce mois"
                    text="Le recouvrement se mesure dès la première échéance du mois."
                />
                <div v-else class="lst">
                    <button
                        v-for="row in atRisk" :key="row.school.id"
                        class="flex items-center gap-2.5 w-full text-left"
                        @click="openSchool(row.school.id)"
                    >
                        <AvatarBadge :name="row.school.name" :size="30" />
                        <div class="nm flex-1 min-w-0">
                            <b>{{ row.school.name }}</b>
                            <span>
                                {{ Number(row.school.overdueAmount) > 0
                                    ? `${fm(row.school.overdueAmount)} F d'impayés`
                                    : 'aucun impayé' }}
                            </span>
                        </div>
                        <UiPill :tone="row.rate < 65 ? 'late' : row.rate < 80 ? 'warn' : 'ok'">
                            {{ row.rate.toFixed(0) }} %
                        </UiPill>
                    </button>
                </div>
            </UiCard>
            </div>
        </div>
    </div>
</template>

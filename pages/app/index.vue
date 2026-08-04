<script setup lang="ts">
/**
 * Parc clients.
 *
 * Deux appels : `/dashboard/summary`, qui rend les mêmes agrégats qu'à une école mais sans portée
 * lorsqu'un administrateur l'appelle — donc à l'échelle du parc —, et `/dashboard/platform`, qui
 * ajoute ce dont YPYit est seul à avoir besoin : sa commission, et la ventilation par école.
 */
type MonthlyPoint = { month: string; expected: number; collected: number };

type Summary = {
    studentCount: number;
    collectedThisMonth: number;
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

const request = useRequestFetch();

const { data, pending, error } = await useAsyncData('platform-overview', async () => {
    const [summary, platform] = await Promise.all([
        request('/api/v1/dashboard/summary') as Promise<Summary>,
        request('/api/v1/dashboard/platform') as Promise<Platform>,
    ]);
    return { summary, platform };
});

const keyword = ref('');
/**
 * Filtres du parc.
 *
 * Ils portent sur ce qui appelle une action de YPYit — une école qui accumule des impayés, une
 * école qui n'a rien encaissé du mois — et non sur le drapeau d'activité : rien ne permet encore
 * de suspendre un établissement, une bascule « actives / désactivées » ne trierait donc rien.
 */
const filter = ref<'all' | 'overdue' | 'idle'>('all');

const schools = computed(() => {
    const q = keyword.value.trim().toLowerCase();
    return (data.value?.platform.schools ?? []).filter((s) => {
        if (filter.value === 'overdue' && !(s.overdueCount > 0)) return false;
        if (filter.value === 'idle' && Number(s.collectedThisMonth ?? 0) > 0) return false;
        return !q || s.name.toLowerCase().includes(q);
    });
});

function xof(amount?: number | null) {
    return Math.round(amount ?? 0).toLocaleString('fr-FR').replace(/ | /g, ' ');
}

/** Au-delà du million, l'unité compacte évite de faire lire neuf chiffres d'un coup d'œil. */
function compact(amount?: number | null) {
    const value = Math.round(amount ?? 0);
    if (value >= 1_000_000) {
        return { value: (value / 1_000_000).toFixed(1).replace('.', ','), unit: 'M FCFA' };
    }
    return { value: xof(value), unit: 'FCFA' };
}

const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

const commission = computed(() => compact(data.value?.platform.commissionThisMonth));
const collected = computed(() => compact(data.value?.summary.collectedThisMonth));

/**
 * Écart de commission avec le mois précédent.
 *
 * Nul quand le mois précédent est à zéro : une progression « infinie » ne veut rien dire, et
 * afficher +100 % sur un premier mois d'activité serait trompeur.
 */
const deltaCommission = computed(() => {
    const previous = data.value?.platform.commissionPreviousMonth ?? 0;
    if (!previous) return null;
    return (((data.value?.platform.commissionThisMonth ?? 0) - previous) / previous) * 100;
});

/** Part des encaissements passée par l'agrégateur : c'est la seule qui produit une commission. */
const onlineShare = computed(() => {
    const total = data.value?.summary.collectedThisMonth ?? 0;
    if (!total) return null;
    return ((data.value?.platform.onlineCollectedThisMonth ?? 0) / total) * 100;
});

const recoveryRate = computed(() => {
    const expected = data.value?.summary.expectedThisMonth ?? 0;
    if (!expected) return null;
    return ((data.value?.summary.collectedThisMonth ?? 0) / expected) * 100;
});
</script>

<template>
    <div>
        <PageHead
            title="Parc clients"
            :sub="`${data?.platform.schoolCount ?? 0} établissement${(data?.platform.schoolCount ?? 0) > 1 ? 's' : ''} · ${monthLabel}`"
        >
            <template #actions>
                <NuxtLink to="/app/etablissements" class="btn-primary">Nouveau partenaire</NuxtLink>
            </template>
        </PageHead>

        <p v-if="error" class="alert-danger mb-4" role="alert">
            Les chiffres du parc n'ont pas pu être chargés. Rechargez la page dans un instant.
        </p>

        <div v-if="pending" class="grid-12">
            <div v-for="n in 4" :key="n" class="card p-4" style="grid-column: span 3">
                <div class="h-3 w-24 rounded animate-pulse" style="background: var(--surface-sunken)" />
                <div class="h-7 w-28 rounded animate-pulse mt-3" style="background: var(--surface-sunken)" />
            </div>
        </div>

        <template v-else>
            <div class="grid-12 mb-3.5">
                <div class="card p-4" style="grid-column: span 3">
                    <!-- La commission est le seul revenu de Nelima : elle ouvre la console, là où
                         une école voit d'abord ce qu'elle a encaissé. -->
                    <span class="kpi-label">Commission perçue · {{ monthLabel.split(' ')[0] }}</span>
                    <span class="kpi-value">{{ commission.value }}<small>{{ commission.unit }}</small></span>
                    <span class="kpi-foot">
                        <span
                            v-if="deltaCommission !== null"
                            class="delta" :class="deltaCommission >= 0 ? 'delta-up' : 'delta-down'"
                        >
                            {{ deltaCommission >= 0 ? '↗' : '↘' }}
                            {{ Math.abs(deltaCommission).toFixed(1).replace('.', ',') }} %
                        </span>
                        sur les paiements en ligne soldés
                    </span>
                </div>

                <div class="card p-4" style="grid-column: span 3">
                    <span class="kpi-label">Scolarités transitées</span>
                    <span class="kpi-value">{{ collected.value }}<small>{{ collected.unit }}</small></span>
                    <span class="kpi-foot">
                        <template v-if="onlineShare !== null">
                            dont {{ onlineShare.toFixed(0) }} % en ligne, le reste au guichet
                        </template>
                        <template v-else>aucun encaissement ce mois</template>
                    </span>
                </div>

                <div class="card p-4" style="grid-column: span 3">
                    <span class="kpi-label">Écoles clientes</span>
                    <span class="kpi-value">{{ data?.platform.schoolCount ?? 0 }}</span>
                    <span class="kpi-foot">
                        {{ data?.platform.activeSchoolCount ?? 0 }} active{{ (data?.platform.activeSchoolCount ?? 0) > 1 ? 's' : '' }}
                        · {{ xof(data?.summary.studentCount) }} élèves gérés
                    </span>
                </div>

                <div class="card p-4 flex items-start justify-between gap-3" style="grid-column: span 3">
                    <div class="min-w-0">
                        <span class="kpi-label">Recouvrement du parc</span>
                        <span class="kpi-value">
                            <template v-if="recoveryRate !== null">
                                {{ recoveryRate.toFixed(1).replace('.', ',') }}<small>%</small>
                            </template>
                            <template v-else>—</template>
                        </span>
                        <span class="kpi-foot">
                            {{ xof(data?.summary.overdueAmount) }} F en retard
                        </span>
                    </div>
                    <StatDonut
                        v-if="recoveryRate !== null"
                        :percent="recoveryRate"
                        :tone="recoveryRate < 80 ? 'var(--warning-solid)' : 'var(--success-solid)'"
                    />
                </div>
            </div>

            <div class="grid-12">
                <UiCard
                    style="grid-column: span 8"
                    title="Volume traité par la plateforme"
                    sub="Attendu selon les échéanciers de toutes les écoles, comparé à ce qui est rentré"
                >
                    <MonthlyBars :points="data?.summary.monthly ?? []" />
                </UiCard>

                <UiCard
                    style="grid-column: span 4" :pad="false"
                    title="Ce que la plateforme rapporte"
                    sub="Commission du mois, et sa part dans les flux"
                >
                    <dl class="kv p-4">
                        <dt>Commission du mois</dt>
                        <dd class="nu">{{ xof(data?.platform.commissionThisMonth) }} F</dd>
                        <dt>Mois précédent</dt>
                        <dd class="nu">{{ xof(data?.platform.commissionPreviousMonth) }} F</dd>
                        <dt>Encaissé en ligne</dt>
                        <dd class="nu">{{ xof(data?.platform.onlineCollectedThisMonth) }} F</dd>
                        <dt>Encaissé au guichet</dt>
                        <dd class="nu">
                            {{ xof((data?.summary.collectedThisMonth ?? 0)
                                - (data?.platform.onlineCollectedThisMonth ?? 0)) }} F
                        </dd>
                        <dt>Reçus émis</dt>
                        <dd class="nu">{{ data?.summary.receiptsThisMonth ?? 0 }}</dd>
                    </dl>
                    <!-- Le guichet ne rapporte rien : le rappeler ici évite de lire la commission
                         comme un pourcentage de la ligne du dessus. -->
                    <p class="px-4 pb-4 text-[12px] leading-relaxed" style="color: var(--text-faint)">
                        Seuls les paiements en ligne produisent une commission. Les règlements
                        reçus au guichet par les écoles n'en supportent aucune.
                    </p>
                </UiCard>

                <UiCard
                    style="grid-column: span 12" :pad="false"
                    title="Écoles du parc"
                    sub="Effectif, encaissements du mois et impayés, école par école"
                >
                    <template #action>
                        <NuxtLink to="/app/etablissements" class="btn-secondary btn-sm">
                            Gérer les partenaires
                        </NuxtLink>
                    </template>

                    <div class="tbar">
                        <label class="inp" style="flex: 0 1 280px">
                            <svg
                                class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" stroke-width="2" stroke-linecap="round"
                            >
                                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
                            </svg>
                            <input
                                v-model="keyword" type="search" class="w-full"
                                placeholder="Rechercher une école…" aria-label="Rechercher une école"
                            />
                        </label>
                        <button class="chip" :aria-pressed="filter === 'all'" @click="filter = 'all'">
                            Toutes
                        </button>
                        <button class="chip" :aria-pressed="filter === 'overdue'" @click="filter = 'overdue'">
                            Avec impayés
                        </button>
                        <button class="chip" :aria-pressed="filter === 'idle'" @click="filter = 'idle'">
                            Sans encaissement ce mois
                        </button>
                    </div>

                    <div class="table-wrap" style="border: 0; box-shadow: none; border-radius: 0">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Établissement</th>
                                    <th class="text-right">Élèves</th>
                                    <th class="text-right">Encaissé ce mois</th>
                                    <th class="text-right">Commission</th>
                                    <th class="text-right">Impayés</th>
                                    <th>État</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="school in schools" :key="school.id">
                                    <td>
                                        <div class="flex items-center gap-2.5">
                                            <AvatarBadge :name="school.name" :size="30" />
                                            <div class="nm min-w-0">
                                                <b>{{ school.name }}</b>
                                                <span>
                                                    {{ school.overdueCount }}
                                                    échéance{{ school.overdueCount > 1 ? 's' : '' }} en retard
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="num" style="color: var(--navy)">{{ school.studentCount }}</td>
                                    <td class="num" style="color: var(--navy)">
                                        {{ xof(school.collectedThisMonth) }} F
                                    </td>
                                    <td class="num" style="color: var(--success)">
                                        {{ xof(school.commissionThisMonth) }} F
                                    </td>
                                    <td class="num" :style="school.overdueAmount > 0
                                        ? 'color: var(--danger)' : 'color: var(--text-faint)'">
                                        {{ xof(school.overdueAmount) }} F
                                    </td>
                                    <td>
                                        <UiPill :tone="school.active ? 'ok' : 'mute'">
                                            {{ school.active ? 'Active' : 'Désactivée' }}
                                        </UiPill>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <EmptyState
                        v-if="!schools.length && (keyword || filter !== 'all')"
                        title="Aucun résultat"
                        text="Aucune école du parc ne correspond à ce filtre."
                    />
                    <EmptyState
                        v-else-if="!schools.length"
                        title="Aucune école cliente"
                        text="Créez un premier partenaire : son établissement et son compte de direction sont générés ensemble."
                    />

                    <template #footer>
                        <span class="text-[12px]" style="color: var(--text-faint)">
                            <b class="nu" style="color: var(--navy)">{{ schools.length }}</b>
                            école{{ schools.length > 1 ? 's' : '' }} affichée{{ schools.length > 1 ? 's' : '' }}
                        </span>
                        <span class="text-[12px]" style="color: var(--text-faint)">
                            Commission cumulée
                            <b class="nu" style="color: var(--success)">
                                {{ xof(schools.reduce((sum, s) => sum + (s.commissionThisMonth ?? 0), 0)) }} F
                            </b>
                        </span>
                    </template>
                </UiCard>
            </div>
        </template>
    </div>
</template>

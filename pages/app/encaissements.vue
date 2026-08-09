<script setup lang="ts">
import { useReceipts, type Receipt } from '~/composables/useReceipts';
import { fm } from '~/composables/useMoney';

/**
 * Reçus d'encaissement du parc, de façon nominative.
 *
 * <p>Les autres écrans de la console ne montrent que des agrégats — combien chaque école a encaissé,
 * mois par mois — jamais qui a payé. Cette vue liste chaque reçu tel qu'il a été émis, avec son
 * payeur, et se filtre par établissement. C'est le seul endroit de la console où l'on retrouve une
 * somme rattachée à une personne.
 */
const receipts = useReceipts();
const api = useApi();

const rows = ref<Receipt[]>([]);
const loading = ref(true);
const error = ref('');

const keyword = ref('');
const establishmentId = ref('');

/* ---- Pagination serveur ---- */
const page = ref(0);
const size = 20;
const totalPages = ref(0);
const totalElements = ref(0);

/** Établissements du parc, pour le filtre. Chargés une fois, l'échec laisse la recherche libre. */
const establishments = ref<{ id: string; name: string }[]>([]);

async function loadEstablishments() {
    try {
        const result = await api<{ content: { id: string; name: string }[] }>(
            '/establishments', { query: { size: 100 } });
        establishments.value = (result.content ?? [])
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    } catch {
        establishments.value = [];
    }
}

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const result = await receipts.search({
            page: page.value,
            size,
            keyword: keyword.value,
            establishmentId: establishmentId.value,
        });
        rows.value = result.content ?? [];
        totalPages.value = result.totalPages ?? 0;
        totalElements.value = result.totalElements ?? 0;
        // Une page vidée côté serveur ne doit pas laisser un écran blanc : on recule et on recharge.
        if (!rows.value.length && page.value > 0 && page.value >= totalPages.value) {
            page.value = Math.max(0, totalPages.value - 1);
            await load();
        }
    } catch {
        error.value = "La liste des encaissements n'a pas pu être chargée.";
        rows.value = [];
    } finally {
        loading.value = false;
    }
}

/**
 * La recherche part du serveur : chaque frappe repose la question au backend. Un léger délai évite
 * d'enchaîner un appel par caractère, et tout changement de filtre ramène à la première page —
 * rester en page 4 d'un résultat qui n'en a plus qu'une afficherait un vide trompeur.
 */
let debounce: ReturnType<typeof setTimeout> | undefined;
watch(keyword, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
        page.value = 0;
        load();
    }, 300);
});

watch(establishmentId, () => {
    page.value = 0;
    load();
});

function goTo(target: number) {
    if (target < 0 || target >= totalPages.value || target === page.value) return;
    page.value = target;
    load();
}

/** Date d'émission, en clair. Un reçu sans date affiche un tiret plutôt qu'« Invalid Date ». */
function issuedOn(receipt: Receipt) {
    if (!receipt.issuedAt) return '—';
    const date = new Date(receipt.issuedAt);
    return Number.isNaN(date.getTime())
        ? '—'
        : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Sous-libellé de l'élève : matricule et classe, sans doublon de séparateur si l'un manque. */
function studentMeta(receipt: Receipt) {
    return [receipt.studentRegistrationNumber, receipt.studentClassName].filter(Boolean).join(' · ');
}

/** Le reçu ne retient que le canal : en ligne (via l'agrégateur) ou au guichet de l'école. */
function isOnline(receipt: Receipt) {
    return receipt.channel === 'ONLINE';
}

const from = computed(() => (totalElements.value ? page.value * size + 1 : 0));
const to = computed(() => Math.min((page.value + 1) * size, totalElements.value));

const hasFilters = computed(() => Boolean(keyword.value.trim() || establishmentId.value));

onMounted(() => {
    loadEstablishments();
    load();
});
</script>

<template>
    <div>
        <PageHead
            title="Encaissements"
            :sub="`${totalElements} reçu${totalElements > 1 ? 's' : ''} émis sur l'ensemble du parc`"
        />

        <p v-if="error" class="alert-danger mb-3.5" role="alert">{{ error }}</p>

        <UiCard :pad="false">
            <div class="tbar">
                <label class="inp" style="flex: 0 1 300px">
                    <BoIcon name="search" :size="16" />
                    <input
                        v-model="keyword" type="search" class="w-full"
                        placeholder="Rechercher un reçu, un élève, un payeur…"
                        aria-label="Rechercher un encaissement"
                    />
                </label>
                <div class="flex-1" />
                <select
                    v-model="establishmentId" class="select"
                    style="flex: 0 0 auto; width: auto" aria-label="Filtrer par établissement"
                >
                    <option value="">Tous les établissements</option>
                    <option v-for="school in establishments" :key="school.id" :value="school.id">
                        {{ school.name }}
                    </option>
                </select>
            </div>

            <div class="table-wrap" style="border: 0; box-shadow: none; border-radius: 0">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>N° de reçu</th>
                            <th>Élève</th>
                            <th>Payeur</th>
                            <th>Établissement</th>
                            <th>Moyen</th>
                            <th class="r">Montant</th>
                        </tr>
                    </thead>
                    <tbody>
                        <TableSkeleton v-if="loading" :columns="7" />
                        <tr v-for="receipt in rows" v-else :key="receipt.number">
                            <td class="nu" style="color: var(--text-muted); white-space: nowrap">
                                {{ issuedOn(receipt) }}
                            </td>
                            <td class="nu">
                                <b style="color: var(--navy)">{{ receipt.number || '—' }}</b>
                            </td>
                            <td>
                                <div class="nm min-w-0">
                                    <b>{{ receipt.studentLabel || '—' }}</b>
                                    <span v-if="studentMeta(receipt)">{{ studentMeta(receipt) }}</span>
                                </div>
                            </td>
                            <td>
                                <div class="flex items-center gap-2.5">
                                    <AvatarBadge :name="receipt.payerLabel || '—'" :size="28" />
                                    <b class="text-[12.5px]" style="color: var(--navy)">
                                        {{ receipt.payerLabel || '—' }}
                                    </b>
                                </div>
                            </td>
                            <td>
                                <span v-if="receipt.establishmentName" class="tag" style="color: var(--brand-700)">
                                    {{ receipt.establishmentName }}
                                </span>
                                <span v-else class="text-[12px]" style="color: var(--text-faint)">—</span>
                            </td>
                            <td>
                                <UiPill :tone="isOnline(receipt) ? 'ok' : 'mute'">
                                    {{ isOnline(receipt) ? 'En ligne' : 'Guichet' }}
                                </UiPill>
                            </td>
                            <td class="num">{{ fm(receipt.amount) }} F</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <EmptyState
                v-if="!loading && !rows.length && hasFilters"
                title="Aucun encaissement"
                text="Modifiez la recherche ou le filtre établissement pour retrouver un reçu."
            />
            <EmptyState
                v-else-if="!loading && !rows.length"
                title="Aucun encaissement"
                text="Les reçus apparaîtront ici dès qu'une école aura encaissé ses premières scolarités."
            />

            <template #footer>
                <span class="text-[12px]" style="color: var(--text-faint)">
                    <template v-if="totalElements">
                        <b class="nu" style="color: var(--navy)">{{ from }}–{{ to }}</b>
                        sur {{ totalElements }} reçu{{ totalElements > 1 ? 's' : '' }}
                    </template>
                    <template v-else>Aucun encaissement</template>
                </span>
                <div v-if="totalPages > 1" class="flex items-center gap-2">
                    <button
                        class="btn-secondary" :disabled="page <= 0" @click="goTo(page - 1)"
                    >
                        <BoIcon name="chevron-left" :size="16" />
                        Précédent
                    </button>
                    <span class="nu text-[12px]" style="color: var(--text-muted)">
                        Page {{ page + 1 }} / {{ totalPages }}
                    </span>
                    <button
                        class="btn-secondary" :disabled="page >= totalPages - 1" @click="goTo(page + 1)"
                    >
                        Suivant
                        <BoIcon name="chevron-right" :size="16" />
                    </button>
                </div>
            </template>
        </UiCard>
    </div>
</template>

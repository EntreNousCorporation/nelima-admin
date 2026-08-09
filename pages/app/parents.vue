<script setup lang="ts">
import {
    useParents, primaryContact,
    type ParentListItem, type ParentChild,
} from '~/composables/useParents';

/**
 * Répertoire des parents du parc.
 *
 * <p>Une même famille peut avoir des enfants dans plusieurs écoles : la ligne porte donc le nom de
 * l'établissement à côté de chaque enfant, et le filtre établissement ne garde que les parents qui
 * en ont un là-bas, sans masquer leurs autres enfants ailleurs.
 */
const parents = useParents();
const api = useApi();

const rows = ref<ParentListItem[]>([]);
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
        const result = await parents.search({
            page: page.value,
            size,
            keyword: keyword.value,
            establishmentId: establishmentId.value,
        });
        rows.value = result.content ?? [];
        totalPages.value = result.totalPages ?? 0;
        totalElements.value = result.totalElements ?? 0;
        // Une page vidée par une suppression côté serveur ne doit pas laisser un écran blanc :
        // on recule d'une page et on recharge.
        if (!rows.value.length && page.value > 0 && page.value >= totalPages.value) {
            page.value = Math.max(0, totalPages.value - 1);
            await load();
        }
    } catch {
        error.value = "La liste des parents n'a pas pu être chargée.";
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

/** Nom complet, avec repli sur ce qui est renseigné. */
function fullName(parent: ParentListItem) {
    return [parent.firstName, parent.lastName].filter(Boolean).join(' ') || '—';
}

/** Établissements distincts d'un parent, dans l'ordre d'apparition de ses enfants. */
function schoolsOf(parent: ParentListItem) {
    return [...new Set((parent.children ?? [])
        .map((child) => child.establishmentName)
        .filter((name): name is string => Boolean(name)))];
}

function childName(child: ParentChild) {
    return [child.firstName, child.lastName].filter(Boolean).join(' ') || '—';
}

/** Classe de l'enfant, telle qu'affichable : le libellé de niveau vient compléter la classe. */
function childClass(child: ParentChild) {
    return child.className || child.levelLabel || '';
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
            title="Parents"
            :sub="`${totalElements} parent${totalElements > 1 ? 's' : ''} sur l'ensemble du parc`"
        />

        <p v-if="error" class="alert-danger mb-3.5" role="alert">{{ error }}</p>

        <UiCard :pad="false">
            <div class="tbar">
                <label class="inp" style="flex: 0 1 300px">
                    <BoIcon name="search" :size="16" />
                    <input
                        v-model="keyword" type="search" class="w-full"
                        placeholder="Rechercher un parent, un contact, un enfant…"
                        aria-label="Rechercher un parent"
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
                            <th>Parent</th>
                            <th>Contact principal</th>
                            <th class="r">Enfants</th>
                            <th>Scolarisés dans</th>
                        </tr>
                    </thead>
                    <tbody>
                        <TableSkeleton v-if="loading" :columns="4" />
                        <tr v-for="parent in rows" v-else :key="parent.id">
                            <td>
                                <div class="flex items-center gap-2.5">
                                    <AvatarBadge :name="fullName(parent)" :size="30" />
                                    <div class="nm min-w-0">
                                        <b>{{ fullName(parent) }}</b>
                                        <span v-if="parent.username">{{ parent.username }}</span>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <template v-if="primaryContact(parent)">
                                    <a
                                        v-if="primaryContact(parent)!.type === 'PHONE'"
                                        :href="`tel:${primaryContact(parent)!.value}`"
                                        class="flex items-center gap-2"
                                    >
                                        <BoIcon name="phone" :size="15" style="color: var(--text-faint)" />
                                        {{ primaryContact(parent)!.value }}
                                    </a>
                                    <a
                                        v-else :href="`mailto:${primaryContact(parent)!.value}`"
                                        class="flex items-center gap-2"
                                    >
                                        <BoIcon name="mail" :size="15" style="color: var(--text-faint)" />
                                        {{ primaryContact(parent)!.value }}
                                    </a>
                                </template>
                                <span v-else class="text-[12px]" style="color: var(--text-faint)">—</span>
                            </td>
                            <td class="num">{{ parent.childrenCount }}</td>
                            <td>
                                <div v-if="parent.children?.length" class="flex flex-col gap-1">
                                    <div
                                        v-for="child in parent.children" :key="child.id"
                                        class="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                                    >
                                        <b class="text-[12.5px]" style="color: var(--navy)">
                                            {{ childName(child) }}
                                        </b>
                                        <span
                                            v-if="child.establishmentName" class="tag"
                                            style="color: var(--brand-700)"
                                        >{{ child.establishmentName }}</span>
                                        <span
                                            v-if="childClass(child)" class="text-[11.5px]"
                                            style="color: var(--text-faint)"
                                        >{{ childClass(child) }}</span>
                                    </div>
                                </div>
                                <span v-else class="text-[12px]" style="color: var(--text-faint)">
                                    aucun enfant rattaché
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <EmptyState
                v-if="!loading && !rows.length && hasFilters"
                title="Aucun parent"
                text="Modifiez la recherche ou le filtre établissement pour retrouver une famille."
            />
            <EmptyState
                v-else-if="!loading && !rows.length"
                title="Aucun parent"
                text="Les familles apparaîtront ici dès qu'une école aura inscrit ses premiers élèves."
            />

            <template #footer>
                <span class="text-[12px]" style="color: var(--text-faint)">
                    <template v-if="totalElements">
                        <b class="nu" style="color: var(--navy)">{{ from }}–{{ to }}</b>
                        sur {{ totalElements }} parent{{ totalElements > 1 ? 's' : '' }}
                    </template>
                    <template v-else>Aucun parent</template>
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

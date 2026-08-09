<script setup lang="ts">
import { fm } from '~/composables/useMoney';

/**
 * Recherche de la console : une école, une facture.
 *
 * <p>Tout se joue côté client, sur deux listes déjà chargées par la barre. C'est délibéré : le parc
 * se compte en dizaines d'écoles et de factures, une route de recherche serait un aller-retour de
 * plus pour trier ce que le navigateur a déjà. Le jour où le parc grossit, la substitution se fait
 * ici seule — les écrans ne connaissent pas cette liste.
 */
type Hit = { kind: 'school' | 'invoice'; id: string; label: string; detail: string; to: string };

const open = ref(false);
const keyword = ref('');
const schools = ref<{ id: string; name: string; studentCount: number }[]>([]);
const invoices = ref<{ id: string; number: string; establishmentId: string;
    establishmentName: string; amount: number; status: string }[]>([]);
const field = ref<HTMLInputElement | null>(null);

async function load() {
    const api = useApi();
    // La barre reste utilisable même si l'une des deux sources tombe.
    const [parc, bills] = await Promise.allSettled([
        api<{ schools: typeof schools.value }>('/dashboard/platform'),
        api<typeof invoices.value>('/subscriptions/invoices'),
    ]);
    if (parc.status === 'fulfilled') schools.value = parc.value.schools ?? [];
    if (bills.status === 'fulfilled') invoices.value = bills.value ?? [];
}

const LIMITE = 8;

const hits = computed<Hit[]>(() => {
    const q = keyword.value.trim().toLowerCase();
    if (!q) return [];
    const found: Hit[] = [];
    for (const school of schools.value) {
        if (!school.name.toLowerCase().includes(q)) continue;
        found.push({
            kind: 'school', id: school.id, label: school.name,
            detail: `${school.studentCount} élève(s)`,
            to: `/app/etablissements?ecole=${school.id}`,
        });
    }
    for (const invoice of invoices.value) {
        const haystack = `${invoice.number} ${invoice.establishmentName}`.toLowerCase();
        if (!haystack.includes(q)) continue;
        found.push({
            kind: 'invoice', id: invoice.id, label: invoice.number,
            detail: `${invoice.establishmentName} · ${fm(invoice.amount)} F`,
            to: '/app/facturation',
        });
    }
    return found.slice(0, LIMITE);
});

function onKey(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open.value = true;
        nextTick(() => field.value?.focus());
        return;
    }
    if (event.key === 'Escape') close();
}

function close() {
    open.value = false;
    keyword.value = '';
}

async function go(hit: Hit) {
    close();
    await navigateTo(hit.to);
}

onMounted(() => {
    window.addEventListener('keydown', onKey);
    load();
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
    <div class="relative hidden md:block" style="flex: 0 1 340px">
        <label class="cs-inp">
            <BoIcon name="search" :size="16" />
            <input
                ref="field" v-model="keyword" type="search"
                placeholder="Rechercher une école, une facture…"
                aria-label="Rechercher une école ou une facture"
                @focus="open = true"
            />
            <span class="kbd">⌘K</span>
        </label>

        <template v-if="open && keyword">
            <div class="fixed inset-0 z-40" @click="close" />
            <div class="cs-menu" role="listbox">
                <p v-if="!hits.length" class="px-3 py-3 text-[12.5px]" style="color: var(--text-faint)">
                    Rien ne correspond à « {{ keyword }} ».
                </p>
                <button
                    v-for="hit in hits" :key="`${hit.kind}-${hit.id}`" role="option"
                    @click="go(hit)"
                >
                    <BoIcon :name="hit.kind === 'school' ? 'building' : 'receipt'" :size="16" />
                    <span class="min-w-0">
                        <b>{{ hit.label }}</b>
                        <em>{{ hit.detail }}</em>
                    </span>
                </button>
            </div>
        </template>
    </div>
</template>

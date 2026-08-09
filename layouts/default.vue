<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { fmc } from '~/composables/useMoney';

const auth = useAuthStore();
const route = useRoute();

/**
 * Coquille de la console interne : même barre bleu nuit et mêmes onglets que le portail
 * établissement, à deux marques près — la mention « Admin » et le bandeau « Console interne ».
 *
 * Les deux applications se ressemblent au point d'être confondues, et un administrateur doit voir
 * sans hésiter laquelle il manipule : ici, il agit sur toutes les écoles à la fois.
 */
const tabs = [
    { label: 'Parc clients', to: '/app', icon: 'chart-bar' },
    { label: 'Écoles', to: '/app/etablissements', icon: 'building' },
    { label: 'Parents', to: '/app/parents', icon: 'user' },
    { label: 'Facturation', to: '/app/facturation', icon: 'receipt' },
    { label: 'Encaissements', to: '/app/encaissements', icon: 'cash' },
    { label: 'Paiements', to: '/app/paiements', icon: 'wallet' },
    { label: 'Prospects', to: '/app/prospects', icon: 'megaphone' },
];

/** Un onglet reste souligné sur ses sous-écrans ; le parc fait exception, il est leur préfixe. */
function isCurrent(to: string) {
    return to === '/app' ? route.path === '/app' : route.path.startsWith(to);
}

const initials = computed(() => (auth.fullName ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join('') || '—');

/**
 * Revenu récurrent et écoles en défaut, portés par la barre.
 *
 * Ce sont les deux chiffres qu'un administrateur veut voir sans naviguer : ce que le parc rapporte,
 * et ce qui ne rentre pas. Chargés après le premier rendu, et leur échec ne fait rien tomber — la
 * console reste utilisable sans eux.
 */
const recurring = ref<number | null>(null);
const lateCount = ref(0);
const pendingProspects = ref(0);

async function loadHeadline() {
    try {
        const api = useApi();
        const invoices = await api<{ status: string; amount: number; periodStart: string }[]>(
            '/subscriptions/invoices');
        const year = new Date().getFullYear();
        recurring.value = invoices
            .filter((invoice) => invoice.status !== 'CANCELLED'
                && new Date(invoice.periodStart).getFullYear() === year)
            .reduce((total, invoice) => total + Number(invoice.amount ?? 0), 0);
        lateCount.value = invoices.filter((invoice) => invoice.status === 'LATE').length;
    } catch {
        recurring.value = null;
        lateCount.value = 0;
    }

    // Deuxième source, indépendante : une facturation en panne ne doit pas masquer les prospects.
    try {
        const api = useApi();
        const rows = await api<{ status: string }[]>('/prospects');
        pendingProspects.value = rows.filter((row) => row.status === 'PENDING').length;
    } catch {
        pendingProspects.value = 0;
    }
}

/* ---- Menu de compte ---- */
const accountOpen = ref(false);
watch(() => route.fullPath, () => { accountOpen.value = false; });

function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') accountOpen.value = false;
}

onMounted(() => {
    window.addEventListener('keydown', onKey);
    loadHeadline();
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

async function logout() {
    accountOpen.value = false;
    await $fetch('/api/auth/logout', { method: 'POST' });
    auth.clear();
    await navigateTo('/connexion');
}
</script>

<template>
    <div v-if="auth.isAuthenticated" class="min-h-screen flex flex-col">
        <header class="app-top">
            <NuxtLink to="/app" class="flex items-center gap-2.5 shrink-0">
                <NelimaMark :size="26" color="#fff" />
                <span class="text-[17px] font-black tracking-tight" style="font-family: Nunito, sans-serif">
                    Nelima
                </span>
                <em
                    class="hidden lg:inline not-italic text-[10px] font-bold uppercase pl-2.5 ml-px"
                    style="letter-spacing: .14em; color: var(--brand-300); border-left: 1px solid rgba(255,255,255,.2)"
                >Admin</em>
            </NuxtLink>

            <span class="adm-badge hidden lg:inline-flex">Console interne</span>

            <ConsoleSearch />

            <div class="flex-1" />

            <span
                v-if="recurring !== null"
                class="hidden lg:inline-flex items-center gap-2 h-[34px] px-2.5 rounded-lg text-[12.5px] font-semibold"
                style="background: rgba(31, 204, 133, .16); color: #7BE8B8"
                data-tip="Abonnements facturés sur l'année civile, annulations exclues"
                data-tip-pos="bottom"
            >
                <BoIcon name="trend-up" :size="15" />
                {{ fmc(recurring).value }} {{ fmc(recurring).unit }} / an
            </span>

            <NuxtLink
                v-if="pendingProspects" to="/app/prospects" class="ic-btn"
                :data-tip="`${pendingProspects} demande(s) de démonstration à rappeler`"
                data-tip-pos="bottom"
                :title="`${pendingProspects} demande(s) de démonstration à rappeler`"
            >
                <BoIcon name="megaphone" :size="19" />
                <i class="notif-badge">{{ pendingProspects > 9 ? '9+' : pendingProspects }}</i>
            </NuxtLink>

            <NuxtLink
                to="/app/facturation" class="ic-btn"
                :data-tip="`${lateCount} école(s) en défaut de paiement`" data-tip-pos="bottom"
                :title="`${lateCount} école(s) en défaut de paiement`"
            >
                <BoIcon name="bell" :size="19" />
                <i v-if="lateCount" class="notif-badge">{{ lateCount > 9 ? '9+' : lateCount }}</i>
            </NuxtLink>

            <div class="relative">
                <button
                    class="me" :aria-expanded="accountOpen" aria-haspopup="menu"
                    @click="accountOpen = !accountOpen"
                >
                    <span
                        class="w-[30px] h-[30px] rounded-full grid place-items-center text-[11px] font-bold shrink-0"
                        style="background: rgba(255,255,255,.16)"
                    >{{ initials }}</span>
                    <div class="hidden sm:block text-left">
                        <b>{{ auth.fullName }}</b>
                        <span>YPYit · Console</span>
                    </div>
                    <BoIcon name="chevron-down" :size="15" />
                </button>

                <template v-if="accountOpen">
                    <div class="fixed inset-0 z-40" @click="accountOpen = false" />
                    <div class="acc-menu" role="menu">
                        <div class="px-2.5 py-2">
                            <b class="block text-[13px] font-bold" style="color: var(--navy)">
                                {{ auth.fullName }}
                            </b>
                            <span class="block text-[11.5px]" style="color: var(--text-faint)">
                                YPYit · Console interne
                            </span>
                        </div>
                        <div class="acc-sep" />
                        <NuxtLink to="/app/reglages" role="menuitem">
                            <BoIcon name="settings" :size="16" />Réglages de la console
                        </NuxtLink>
                        <div class="acc-sep" />
                        <button role="menuitem" style="color: var(--danger)" @click="logout">
                            <BoIcon name="logout" :size="16" />Se déconnecter
                        </button>
                    </div>
                </template>
            </div>
        </header>

        <nav class="app-tabs">
            <NuxtLink
                v-for="tab in tabs" :key="tab.to" :to="tab.to"
                class="app-tab" :class="isCurrent(tab.to) ? 'app-tab-active' : ''"
                :aria-current="isCurrent(tab.to) ? 'page' : undefined"
            >
                <BoIcon :name="tab.icon" :size="16" :stroke-width="isCurrent(tab.to) ? 2 : 1.7" />
                {{ tab.label }}
            </NuxtLink>
        </nav>

        <main class="flex-1 w-full max-w-[1620px] mx-auto p-5">
            <slot />
        </main>
    </div>

    <div v-else class="min-h-screen"><slot /></div>
</template>

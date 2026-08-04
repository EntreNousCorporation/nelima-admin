<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

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
    { label: 'Parc clients', to: '/app', icon: 'M4 19V10M9.5 19V5M15 19v-7M20.5 19v-11' },
    { label: 'Écoles', to: '/app/etablissements', icon: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6' },
    { label: 'Paiement', to: '/app/paiement', icon: 'M3 8h18v10H3zM3 8l2-4h14l2 4M8 13h8' },
];

const initials = computed(() => (auth.fullName ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join('') || '—');

async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' });
    auth.clear();
    await navigateTo('/connexion');
}
</script>

<template>
    <div v-if="auth.isAuthenticated" class="min-h-screen flex flex-col">
        <header class="app-top">
            <NuxtLink to="/app" class="flex items-center gap-2.5 shrink-0">
                <NelimaMark :size="26" />
                <span class="text-[17px] font-black tracking-tight" style="font-family: Nunito, sans-serif">
                    Nelima
                </span>
                <em
                    class="not-italic text-[10px] font-bold uppercase pl-2.5 ml-px"
                    style="letter-spacing: .14em; color: var(--brand-300); border-left: 1px solid rgba(255,255,255,.2)"
                >Admin</em>
            </NuxtLink>

            <span
                class="hidden md:flex items-center h-[26px] px-2.5 rounded-md text-[11px] font-bold uppercase"
                style="letter-spacing: .08em; background: rgba(245,165,36,.18); color: #F5A524"
            >Console interne</span>

            <div class="flex-1" />

            <div class="flex items-center gap-2.5 pl-1">
                <span
                    class="w-8 h-8 rounded-full grid place-items-center text-[11px] font-bold shrink-0"
                    style="background: rgba(255,255,255,.16)"
                >{{ initials }}</span>
                <div class="hidden sm:block leading-tight">
                    <b class="block text-[12.5px] font-bold">{{ auth.fullName }}</b>
                    <span class="block text-[11px]" style="color: var(--brand-300)">YPYit</span>
                </div>
                <button
                    class="w-[34px] h-[34px] rounded-lg grid place-items-center shrink-0"
                    title="Se déconnecter" @click="logout"
                >
                    <svg
                        class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
                    >
                        <path d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />
                    </svg>
                </button>
            </div>
        </header>

        <nav class="app-tabs">
            <NuxtLink
                v-for="tab in tabs" :key="tab.to" :to="tab.to"
                class="app-tab" :class="route.path === tab.to ? 'app-tab-active' : ''"
                :aria-current="route.path === tab.to ? 'page' : undefined"
            >
                <svg
                    class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
                >
                    <path :d="tab.icon" />
                </svg>
                {{ tab.label }}
            </NuxtLink>
        </nav>

        <main class="flex-1 w-full max-w-[1620px] mx-auto p-5">
            <slot />
        </main>
    </div>

    <div v-else class="min-h-screen"><slot /></div>
</template>

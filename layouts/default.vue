<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

const auth = useAuthStore();
const route = useRoute();

/**
 * Le back-office reprend la coquille du portail établissement, à une différence près : la mention
 * « YPYit » sous la marque. Les deux applications se ressemblent au point d'être confondues, et un
 * administrateur doit voir sans hésiter laquelle il manipule — il agit ici sur toutes les écoles à
 * la fois.
 */
const navigation = [
    { label: 'Établissements', to: '/app', icon: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6' },
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
    <div v-if="auth.isAuthenticated" class="min-h-screen flex">
        <aside
            class="w-64 shrink-0 flex flex-col"
            style="background-color: var(--surface-raised); border-right: 1px solid var(--border)"
        >
            <div class="px-5 py-5 flex items-center gap-3">
                <NelimaMark :size="32" />
                <div class="min-w-0">
                    <p class="text-sm font-semibold leading-tight">Nelima</p>
                    <p class="text-xs" style="color: var(--text-muted)">Back-office YPYit</p>
                </div>
            </div>

            <nav class="flex-1 px-3 pb-4 space-y-1 overflow-y-auto">
                <NuxtLink
                    v-for="item in navigation"
                    :key="item.to"
                    :to="item.to"
                    class="nav-link"
                    :class="route.path === item.to ? 'nav-link-active' : ''"
                >
                    <svg
                        class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="1.8"
                        stroke-linecap="round" stroke-linejoin="round"
                    >
                        <path :d="item.icon" />
                    </svg>
                    {{ item.label }}
                </NuxtLink>
            </nav>

            <div class="px-3 py-4" style="border-top: 1px solid var(--border)">
                <div class="flex items-center gap-3 px-2">
                    <span
                        class="w-8 h-8 shrink-0 rounded-full grid place-items-center text-xs font-semibold"
                        style="background-color: var(--brand-50); color: var(--brand-700)"
                    >{{ initials }}</span>
                    <p class="text-sm font-medium truncate">{{ auth.fullName }}</p>
                </div>
                <button class="btn-ghost btn-sm w-full mt-2 justify-start" @click="logout">
                    <svg
                        class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
                    >
                        <path d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />
                    </svg>
                    Se déconnecter
                </button>
            </div>
        </aside>

        <main class="flex-1 min-w-0 overflow-x-auto">
            <div class="max-w-[1400px] px-8 py-7">
                <slot />
            </div>
        </main>
    </div>

    <div v-else class="min-h-screen"><slot /></div>
</template>

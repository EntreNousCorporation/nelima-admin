<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

const auth = useAuthStore();
const route = useRoute();

const navigation = [
    { label: 'Établissements', to: '/app' },
    { label: 'Paiement', to: '/app/paiement' },
];

async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' });
    auth.clear();
    await navigateTo('/connexion');
}
</script>

<template>
    <div v-if="auth.isAuthenticated" class="min-h-screen flex">
        <aside class="w-60 shrink-0 border-r border-black/10 dark:border-white/10 p-4 flex flex-col">
            <div class="mb-6">
                <p class="text-lg font-semibold">Nelima</p>
                <p class="text-sm opacity-70">Back-office YPYit</p>
            </div>
            <nav class="flex-1 space-y-1">
                <NuxtLink v-for="item in navigation" :key="item.to" :to="item.to"
                          class="block rounded px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                          :class="route.path === item.to ? 'bg-black/5 dark:bg-white/10 font-medium' : ''">
                    {{ item.label }}
                </NuxtLink>
            </nav>
            <div class="pt-4 border-t border-black/10 dark:border-white/10">
                <p class="text-sm font-medium">{{ auth.fullName }}</p>
                <button class="mt-2 text-sm underline opacity-70 hover:opacity-100" @click="logout">
                    Se déconnecter
                </button>
            </div>
        </aside>
        <main class="flex-1 p-8 overflow-x-auto"><slot /></main>
    </div>
    <div v-else class="min-h-screen"><slot /></div>
</template>

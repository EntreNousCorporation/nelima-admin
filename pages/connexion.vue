<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

definePageMeta({ layout: 'default' });

const auth = useAuthStore();
const username = ref('');
const password = ref('');
const error = ref('');
const submitting = ref(false);

async function submit() {
    error.value = '';
    submitting.value = true;
    try {
        // La réponse ne contient que le profil : le jeton reste scellé côté serveur.
        const { user } = await $fetch<{ user: any }>('/api/auth/login', {
            method: 'POST',
            body: { username: username.value, password: password.value },
        });
        auth.setUser(user);
        await navigateTo('/app');
    } catch (e: any) {
        error.value = e?.data?.statusMessage ?? 'Identifiant ou mot de passe incorrect';
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <div class="min-h-screen flex items-center justify-center p-6">
        <form class="w-full max-w-sm space-y-4" @submit.prevent="submit">
            <div class="mb-8">
                <h1 class="text-2xl font-semibold">Nelima</h1>
                <p class="opacity-70">Back-office YPYit</p>
            </div>

            <div class="space-y-1">
                <label for="username" class="text-sm">Identifiant</label>
                <input
                    id="username" v-model="username" type="text" autocomplete="username" required
                    class="w-full rounded border border-black/20 dark:border-white/20 bg-transparent px-3 py-2"
                />
            </div>

            <div class="space-y-1">
                <label for="password" class="text-sm">Mot de passe</label>
                <input
                    id="password" v-model="password" type="password" autocomplete="current-password" required
                    class="w-full rounded border border-black/20 dark:border-white/20 bg-transparent px-3 py-2"
                />
            </div>

            <p v-if="error" class="text-sm text-red-600" role="alert">{{ error }}</p>

            <button
                type="submit" :disabled="submitting || !username || !password"
                class="w-full rounded bg-nelima-600 px-4 py-2 text-white disabled:opacity-50"
            >
                {{ submitting ? 'Connexion…' : 'Se connecter' }}
            </button>
        </form>
    </div>
</template>

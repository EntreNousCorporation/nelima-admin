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
    <div class="min-h-screen grid lg:grid-cols-2">
        <AuthAside />

        <main class="flex items-center justify-center p-6">
            <form class="form-auth w-full max-w-sm" @submit.prevent="submit">
                <div class="lg:hidden flex items-center gap-3 mb-8">
                    <NelimaMark :size="32" />
                    <span class="text-lg font-semibold">Nelima</span>
                </div>

                <h1 class="text-2xl font-semibold tracking-tight">Back-office</h1>
                <p class="page-subtitle mb-8">Accès réservé à l'équipe YPYit.</p>

                <div class="space-y-4">
                    <div>
                        <label for="username" class="field-label">Identifiant</label>
                        <input
                            id="username" v-model="username" type="text"
                            autocomplete="username" required class="input"
                        />
                    </div>

                    <div>
                        <label for="password" class="field-label">Mot de passe</label>
                        <input
                            id="password" v-model="password" type="password"
                            autocomplete="current-password" required class="input"
                        />
                    </div>

                    <p v-if="error" class="alert-danger" role="alert">{{ error }}</p>

                    <button
                        type="submit" :disabled="submitting || !username || !password"
                        class="btn-primary w-full"
                    >
                        {{ submitting ? 'Connexion…' : 'Se connecter' }}
                    </button>
                </div>

                <p class="mt-6 text-sm">
                    <NuxtLink to="/connexion/oubli" style="color: var(--brand-700)">
                        Mot de passe oublié ?
                    </NuxtLink>
                </p>
            </form>
        </main>
    </div>
</template>

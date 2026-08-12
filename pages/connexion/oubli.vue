<script setup lang="ts">
definePageMeta({ layout: 'default' });

/**
 * Demande d'un nouveau lien de mot de passe.
 *
 * L'écran de connexion disait « contactez votre administrateur ». C'était exact — il n'existait
 * aucun autre recours —, et c'est ce que cette page remplace.
 */
const username = ref('');
const submitting = ref(false);
const done = ref(false);

async function submit() {
    submitting.value = true;
    try {
        await $fetch('/api/auth/forgot-password', {
            method: 'POST',
            body: { username: username.value },
        });
    } finally {
        // Toujours le même écran, compte connu ou non : la page ne doit pas dire qui a un compte.
        submitting.value = false;
        done.value = true;
    }
}
</script>

<template>
    <main class="min-h-screen flex items-center justify-center p-6">
        <div class="w-full max-w-sm">
            <div class="flex items-center gap-3 mb-8">
                <NelimaMark :size="32" />
                <span class="text-lg font-semibold">Nelima</span>
            </div>

            <template v-if="done">
                <h1 class="text-2xl font-semibold tracking-tight">Vérifiez votre courrier</h1>
                <p class="page-subtitle mb-8">
                    Si un compte existe pour <strong>{{ username }}</strong>, un lien de définition
                    de mot de passe vient de partir. Il est valable une heure.
                </p>
                <NuxtLink to="/connexion" class="btn-primary w-full text-center block">
                    Retour à la connexion
                </NuxtLink>
            </template>

            <form v-else @submit.prevent="submit">
                <h1 class="text-2xl font-semibold tracking-tight">Mot de passe oublié</h1>
                <p class="page-subtitle mb-8">
                    Indiquez l'adresse de connexion de votre compte.
                </p>

                <div class="space-y-4">
                    <div>
                        <label for="username" class="field-label">Identifiant</label>
                        <input
                            id="username" v-model="username" type="text"
                            autocomplete="username" required class="input"
                            placeholder="prenom.nom@ypy-it.com"
                        />
                    </div>

                    <button
                        type="submit" :disabled="submitting || !username"
                        class="btn-primary w-full"
                    >
                        {{ submitting ? 'Envoi…' : 'Recevoir un lien' }}
                    </button>
                </div>

                <p class="mt-8 text-xs" style="color: var(--text-faint)">
                    <NuxtLink to="/connexion" class="underline">Revenir à la connexion</NuxtLink>
                </p>
            </form>
        </div>
    </main>
</template>

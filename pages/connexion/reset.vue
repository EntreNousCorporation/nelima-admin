<script setup lang="ts">
definePageMeta({ layout: 'default' });

/**
 * Définition du mot de passe depuis le lien reçu par courriel.
 *
 * Cette page n'existait pas. Le courriel de bienvenue portait pourtant un lien vers
 * `/connexion/reset` — vers un site tiers, de surcroît —, si bien qu'un compte nouvellement
 * créé n'avait aucun moyen de définir son mot de passe : il ne se saisit nulle part ailleurs.
 */
const route = useRoute();
const username = String(route.query.username ?? '');
const token = String(route.query.token ?? '');

const password = ref('');
const confirmation = ref('');
const submitting = ref(false);
const error = ref('');
const done = ref(false);

/** La règle du serveur, énoncée avant la saisie plutôt que découverte au refus. */
const RULE = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[_!@#&()\-[\]{}:;',?/*~$^+=<>]).{6,16}$/;

const valid = computed(() => RULE.test(password.value));
const matches = computed(() => password.value.length > 0 && password.value === confirmation.value);
const linkIsComplete = computed(() => username.length > 0 && token.length > 0);

async function submit() {
    error.value = '';
    submitting.value = true;
    try {
        await $fetch('/api/auth/reset-password', {
            method: 'POST',
            body: { username, token, password: password.value },
        });
        done.value = true;
    } catch (e: any) {
        error.value = e?.data?.statusMessage ?? 'Ce lien n’est plus valable.';
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <div class="min-h-screen grid lg:grid-cols-2">
        <AuthAside />

        <main class="flex items-center justify-center p-6">
        <div class="w-full max-w-sm">
            <div class="lg:hidden flex items-center gap-3 mb-8">
                <NelimaMark :size="32" />
                <span class="text-lg font-semibold">Nelima</span>
            </div>

            <!-- Lien tronqué : le dire tout de suite plutôt que d'afficher un formulaire qui
                 échouera forcément à l'envoi. -->
            <template v-if="!linkIsComplete">
                <h1 class="text-2xl font-semibold tracking-tight">Lien incomplet</h1>
                <p class="page-subtitle mb-8">
                    Ouvrez le lien tel qu'il figure dans le courriel, sans le recopier à la main.
                </p>
                <NuxtLink to="/connexion/oubli" class="btn-primary w-full text-center block">
                    Recevoir un nouveau lien
                </NuxtLink>
            </template>

            <template v-else-if="done">
                <h1 class="text-2xl font-semibold tracking-tight">Mot de passe enregistré</h1>
                <p class="page-subtitle mb-8">
                    Vous pouvez maintenant vous connecter avec <strong>{{ username }}</strong>.
                </p>
                <NuxtLink to="/connexion" class="btn-primary w-full text-center block">
                    Aller à la connexion
                </NuxtLink>
            </template>

            <form v-else class="form-auth" @submit.prevent="submit">
                <h1 class="text-2xl font-semibold tracking-tight">Définir votre mot de passe</h1>
                <p class="page-subtitle mb-8">
                    Pour le compte <strong>{{ username }}</strong>.
                </p>

                <div class="space-y-4">
                    <div>
                        <label for="password" class="field-label">Nouveau mot de passe</label>
                        <input
                            id="password" v-model="password" type="password"
                            autocomplete="new-password" required minlength="6" maxlength="16"
                            class="input"
                        />
                        <p class="mt-1.5 text-xs" style="color: var(--text-faint)">
                            De 6 à 16 caractères, avec une minuscule, une majuscule, un chiffre et
                            un caractère spécial.
                        </p>
                    </div>

                    <div>
                        <label for="confirmation" class="field-label">Confirmer le mot de passe</label>
                        <input
                            id="confirmation" v-model="confirmation" type="password"
                            autocomplete="new-password" required class="input"
                        />
                        <p
                            v-if="confirmation && !matches"
                            class="mt-1.5 text-xs" style="color: var(--danger)"
                        >
                            Les deux saisies diffèrent.
                        </p>
                    </div>

                    <p v-if="error" class="alert-danger" role="alert">{{ error }}</p>

                    <button
                        type="submit" :disabled="submitting || !valid || !matches"
                        class="btn-primary w-full"
                    >
                        {{ submitting ? 'Enregistrement…' : 'Enregistrer' }}
                    </button>
                </div>

                <p class="mt-8 text-xs" style="color: var(--text-faint)">
                    Le lien est valable une heure. Passé ce délai,
                    <NuxtLink to="/connexion/oubli" class="underline">demandez-en un nouveau</NuxtLink>.
                </p>
            </form>
        </div>
        </main>
    </div>
</template>

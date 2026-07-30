<script setup lang="ts">
type ProviderConfig = {
    id: string;
    providerType: string;
    label: string;
    environment: string;
    active: boolean;
    settings?: Record<string, string>;
};

const api = useApi();
const configs = ref<ProviderConfig[]>([]);
const loading = ref(true);
const error = ref('');

const active = computed(() => configs.value.find((c) => c.active));

onMounted(async () => {
    try {
        // Ces routes appartiennent au starter PaySwitch et ne sont pas sous /api/v1 côté
        // backend ; le proxy les atteint par le même chemin relatif.
        configs.value = await api<ProviderConfig[]>('/payswitch/configs');
    } catch {
        error.value = "La configuration de paiement n'a pas pu être lue.";
    } finally {
        loading.value = false;
    }
});
</script>

<template>
    <div>
        <h1 class="page-title">Fournisseur de paiement</h1>
        <p class="mt-1 opacity-70 max-w-2xl">
            Un seul fournisseur est actif pour toute la plateforme. Les identifiants proviennent
            des variables d'environnement du serveur et sont réappliqués à chaque démarrage : ils
            ne se modifient pas depuis cette page.
        </p>

        <p v-if="error" class="alert-danger mt-4" role="alert">{{ error }}</p>
        <p v-if="loading" class="mt-6 opacity-70">Chargement…</p>

        <div v-else-if="!configs.length" class="mt-6 rounded border border-amber-500/40 bg-amber-500/10 p-4">
            <p class="font-medium">Aucun fournisseur configuré</p>
            <p class="text-sm mt-1 opacity-80">
                Aucun paiement en ligne n'est possible. Renseigner JEKO_API_KEY, JEKO_API_KEY_ID,
                JEKO_WEBHOOK_SECRET et JEKO_STORE_ID sur le serveur, puis redémarrer le backend.
            </p>
        </div>

        <div v-else class="mt-6 space-y-3">
            <div
                v-for="config in configs" :key="config.id" class="card-pad"
                :style="config.active
                    ? 'border-color: var(--brand-300); background-color: var(--brand-50)'
                    : ''"
            >
                <div class="flex items-center gap-3 flex-wrap">
                    <p class="font-medium">{{ config.providerType }}</p>
                    <!-- L'environnement est signalé, pas décoré : confondre un fournisseur d'essai
                         avec celui de production ferait passer de vrais paiements pour des tests. -->
                    <span
                        class="badge"
                        :class="config.environment === 'LIVE' ? 'badge-danger' : 'badge-neutral'"
                    >{{ config.environment }}</span>
                    <span v-if="config.active" class="badge badge-success">actif</span>
                </div>
                <p class="text-sm opacity-70 mt-1">{{ config.label }}</p>
                <p v-if="config.settings?.default_payment_method" class="text-sm opacity-70 mt-1">
                    Canal par défaut : {{ config.settings.default_payment_method }}
                </p>
            </div>

            <div v-if="active?.environment === 'LIVE'"
                 class="rounded border border-red-500/40 bg-red-500/10 p-4 text-sm">
                <p class="font-medium">Environnement LIVE</p>
                <p class="mt-1 opacity-90">
                    Toute initiation de paiement débite un compte réel. Vérifier qu'une transaction
                    de faible montant a bien confirmé le facteur de conversion des montants avant
                    d'ouvrir l'encaissement en ligne à un établissement.
                </p>
            </div>
        </div>
    </div>
</template>

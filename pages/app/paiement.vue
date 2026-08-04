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

/**
 * Taux de commission.
 *
 * Saisi en pourcentage à l'écran et transmis en fraction : demander « 0,02 » à un humain invite à
 * écrire « 2 », ce que le serveur refuserait. La conversion se fait ici, une bonne fois.
 */
const rate = ref<number | null>(null);
const rateDraft = ref<string>('');
const savingRate = ref(false);
const rateError = ref('');
const rateSaved = ref(false);

const rateChanged = computed(() => {
    const parsed = Number(rateDraft.value.replace(',', '.'));
    return Number.isFinite(parsed) && rate.value !== null
        && Math.abs(parsed / 100 - rate.value) > 1e-9;
});

/**
 * Groupage manuel plutôt que `toLocaleString` : le rendu serveur et le navigateur ne partagent pas
 * forcément les données ICU, et l'écart produit un avertissement d'hydratation sur un texte qui doit
 * simplement afficher un montant.
 */
function formatAmount(value: number) {
    return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

const example = computed(() => {
    const parsed = Number(rateDraft.value.replace(',', '.'));
    const rateApplied = Number.isFinite(parsed) ? parsed : 0;
    return formatAmount(50000 + Math.round(50000 * rateApplied / 100));
});

async function loadRate() {
    try {
        const current = await api<{ commissionRate: number }>('/platform-settings/billing');
        rate.value = current.commissionRate;
        rateDraft.value = String(Math.round(current.commissionRate * 10000) / 100).replace('.', ',');
    } catch {
        rateError.value = "Le taux de commission n'a pas pu être lu.";
    }
}

async function saveRate() {
    const parsed = Number(rateDraft.value.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
        rateError.value = 'Saisissez un pourcentage, par exemple 2 ou 2,5.';
        return;
    }

    savingRate.value = true;
    rateError.value = '';
    rateSaved.value = false;
    try {
        const saved = await api<{ commissionRate: number }>('/platform-settings/billing', {
            method: 'PUT',
            body: { commissionRate: parsed / 100 },
        });
        rate.value = saved.commissionRate;
        rateSaved.value = true;
    } catch (e: any) {
        // Le serveur borne la saisie : on reprend son message plutôt que d'en inventer un plus
        // vague, puisque lui seul connaît les bornes qu'il applique.
        rateError.value = e?.data?.debugMessage
            ?? "Le taux n'a pas pu être enregistré. Vérifiez la valeur saisie.";
    } finally {
        savingRate.value = false;
    }
}

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
    await loadRate();
});
</script>

<template>
    <div>
        <PageHead
            title="Paiement"
            sub="Commission de la plateforme et fournisseur d'encaissement en ligne"
        />

        <UiCard
            class="max-w-2xl mb-3.5"
            title="Commission Nelima"
            sub="Part prélevée sur chaque paiement en ligne, en plus du montant de la tranche"
        >
            <p class="text-[12.5px] mb-4 leading-relaxed" style="color: var(--text-muted)">
                Elle est annoncée au parent avant qu'il ne valide, et s'applique dès le paiement
                suivant — aucun redéploiement n'est nécessaire. Sans effet sur les encaissements
                reçus au guichet par les écoles.
            </p>

            <div class="flex items-end gap-3 flex-wrap">
                <div>
                    <label for="rate" class="field-label">Taux appliqué</label>
                    <div class="flex items-center gap-2">
                        <input
                            id="rate" v-model="rateDraft" type="text" inputmode="decimal"
                            class="input w-28 text-right" :disabled="rate === null"
                        />
                        <span class="text-sm font-semibold" style="color: var(--text-muted)">%</span>
                    </div>
                </div>
                <button
                    class="btn-primary" :disabled="savingRate || !rateChanged" @click="saveRate"
                >
                    {{ savingRate ? 'Enregistrement…' : 'Enregistrer' }}
                </button>
            </div>

            <!-- Exemple chiffré : un taux seul ne dit pas grand-chose, un montant si. -->
            <p v-if="rate !== null" class="text-xs mt-3" style="color: var(--text-faint)">
                Sur une tranche de 50 000 F, le parent réglera {{ example }} F.
            </p>

            <p v-if="rateError" class="alert-danger mt-3" role="alert">{{ rateError }}</p>
            <p v-else-if="rateSaved" class="alert-success mt-3">
                Taux enregistré. Il s'applique aux paiements à venir.
            </p>
        </UiCard>

        <p v-if="error" class="alert-danger mb-3.5" role="alert">{{ error }}</p>

        <UiCard
            class="max-w-2xl" :pad="false"
            title="Fournisseur d'encaissement"
            sub="Un seul est actif pour toute la plateforme"
        >
            <p v-if="loading" class="card-b text-[13px]" style="color: var(--text-faint)">
                Chargement…
            </p>

            <EmptyState
                v-else-if="!configs.length"
                title="Aucun fournisseur configuré"
                text="Aucun paiement en ligne n'est possible. Renseignez JEKO_API_KEY, JEKO_API_KEY_ID, JEKO_WEBHOOK_SECRET et JEKO_STORE_ID sur le serveur, puis redémarrez le backend."
            />

            <div v-else class="lst">
                <div v-for="config in configs" :key="config.id" class="flex items-center gap-3 flex-wrap">
                    <b class="text-[13px] font-extrabold" style="color: var(--navy)">
                        {{ config.providerType }}
                    </b>
                    <!-- L'environnement est signalé, pas décoré : confondre un fournisseur d'essai
                         avec celui de production ferait passer de vrais paiements pour des tests. -->
                    <UiPill :tone="config.environment === 'LIVE' ? 'late' : 'mute'">
                        {{ config.environment }}
                    </UiPill>
                    <UiPill v-if="config.active" tone="ok">Actif</UiPill>
                    <span class="w-full text-[12.5px]" style="color: var(--text-muted)">
                        {{ config.label }}
                        <template v-if="config.settings?.default_payment_method">
                            · canal par défaut : {{ config.settings.default_payment_method }}
                        </template>
                    </span>
                </div>
            </div>

            <div
                v-if="active?.environment === 'LIVE'" class="m-4 rounded-xl p-3.5"
                style="background: var(--danger-soft); border: 1px solid var(--danger)"
            >
                <b class="text-[13px]" style="color: var(--danger)">Environnement LIVE</b>
                <p class="text-[12.5px] mt-1 leading-relaxed" style="color: var(--text-muted)">
                    Toute initiation de paiement débite un compte réel. Vérifier qu'une transaction
                    de faible montant a bien confirmé le facteur de conversion des montants avant
                    d'ouvrir l'encaissement en ligne à un établissement.
                </p>
            </div>
        </UiCard>
    </div>
</template>

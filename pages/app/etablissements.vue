<script setup lang="ts">
type Establishment = {
    id: string;
    name: string;
    webSite?: string;
    active?: boolean;
};

const api = useApi();

const rows = ref<Establishment[]>([]);
const loading = ref(true);
const error = ref('');
const keyword = ref('');

const showForm = ref(false);
const saving = ref(false);
const formError = ref('');
const created = ref('');

const form = reactive({
    firstName: '',
    lastName: '',
    userEmail: '',
    name: '',
    webSite: '',
    contactEmail: '',
});

const complete = computed(() =>
    Boolean(form.firstName && form.lastName && form.userEmail && form.name && form.contactEmail));

const filtered = computed(() => {
    const q = keyword.value.trim().toLowerCase();
    if (!q) return rows.value;
    return rows.value.filter((r) => r.name.toLowerCase().includes(q));
});

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const result = await api<{ content: Establishment[] }>('/establishments', { query: { size: 100 } });
        rows.value = result.content ?? [];
    } catch {
        error.value = "La liste des établissements n'a pas pu être chargée.";
    } finally {
        loading.value = false;
    }
}

async function submit() {
    formError.value = '';
    created.value = '';
    saving.value = true;
    try {
        // Un seul appel crée l'établissement et son utilisateur racine, et déclenche l'email
        // de bienvenue avec le lien de définition du mot de passe.
        await api('/establishments', {
            method: 'POST',
            body: {
                firstName: form.firstName,
                lastName: form.lastName,
                contacts: [{ value: form.userEmail, type: 'EMAIL', isPrimary: true }],
                establishment: {
                    name: form.name,
                    webSite: form.webSite || undefined,
                    // Un partenaire créé ici est un établissement principal. Les antennes d'un
                    // même réseau se créeront rattachées à lui par `parent`. La liste filtre par
                    // défaut sur les principaux : un partenaire marqué non principal
                    // n'apparaîtrait nulle part.
                    isPrimary: true,
                    contacts: [{ value: form.contactEmail, type: 'EMAIL', isPrimary: true }],
                },
            },
        });
        created.value = `${form.name} créé. Un email de bienvenue a été envoyé à ${form.userEmail}.`;
        Object.assign(form, { firstName: '', lastName: '', userEmail: '', name: '', webSite: '', contactEmail: '' });
        showForm.value = false;
        await load();
    } catch (e: any) {
        formError.value = e?.response?.status === 409
            ? 'Un établissement porte déjà ce nom, ou cet email est déjà utilisé.'
            : "L'établissement n'a pas pu être créé.";
    } finally {
        saving.value = false;
    }
}

onMounted(load);
</script>

<template>
    <div>
        <PageHead
            title="Écoles clientes"
            :sub="`${rows.length} établissement${rows.length > 1 ? 's' : ''} partenaire${rows.length > 1 ? 's' : ''}`"
        >
            <template #actions>
                <button class="btn-primary" @click="showForm = !showForm">
                    {{ showForm ? 'Annuler' : 'Nouveau partenaire' }}
                </button>
            </template>
        </PageHead>

        <p v-if="created" class="alert-success mb-3.5">{{ created }}</p>

        <UiCard
            v-if="showForm" class="mb-3.5"
            title="Nouvel établissement partenaire"
            sub="L'établissement et son compte de direction sont créés ensemble"
        >
            <form @submit.prevent="submit">
                <p class="sec">Établissement</p>
                <div class="grid gap-3.5 sm:grid-cols-2">
                    <div>
                        <label class="field-label" for="name">Nom</label>
                        <input
                            id="name" v-model="form.name" type="text" required
                            placeholder="Groupe Scolaire…" class="input"
                        />
                    </div>
                    <div>
                        <label class="field-label" for="contactEmail">Email de contact</label>
                        <input id="contactEmail" v-model="form.contactEmail" type="email" required class="input" />
                    </div>
                    <div class="sm:col-span-2">
                        <label class="field-label" for="webSite">Site web (facultatif)</label>
                        <input id="webSite" v-model="form.webSite" type="url" placeholder="https://…" class="input" />
                    </div>
                </div>

                <p class="sec mt-5">Compte de direction</p>
                <div class="grid gap-3.5 sm:grid-cols-3">
                    <div>
                        <label class="field-label" for="firstName">Prénom</label>
                        <input id="firstName" v-model="form.firstName" type="text" required class="input" />
                    </div>
                    <div>
                        <label class="field-label" for="lastName">Nom</label>
                        <input id="lastName" v-model="form.lastName" type="text" required class="input" />
                    </div>
                    <div>
                        <label class="field-label" for="userEmail">Email de connexion</label>
                        <input id="userEmail" v-model="form.userEmail" type="email" required class="input" />
                    </div>
                </div>

                <!-- Le mot de passe n'est jamais saisi ici : le compte le définit lui-même depuis
                     le lien reçu par email. -->
                <p class="text-[12px] mt-3" style="color: var(--text-faint)">
                    Un email de bienvenue part à l'adresse de connexion, avec le lien de définition
                    du mot de passe. La direction se connecte ensuite sur le portail établissement.
                </p>

                <p v-if="formError" class="alert-danger mt-4" role="alert">{{ formError }}</p>

                <button type="submit" :disabled="saving || !complete" class="btn-primary mt-4">
                    {{ saving ? 'Création…' : 'Créer le partenaire' }}
                </button>
            </form>
        </UiCard>

        <p v-if="error" class="alert-danger mb-3.5" role="alert">{{ error }}</p>

        <UiCard :pad="false">
            <div class="tbar">
                <label class="inp" style="flex: 0 1 280px">
                    <svg
                        class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2" stroke-linecap="round"
                    >
                        <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
                    </svg>
                    <input
                        v-model="keyword" type="search" class="w-full"
                        placeholder="Rechercher une école…" aria-label="Rechercher une école"
                    />
                </label>
            </div>

            <div class="table-wrap" style="border: 0; box-shadow: none; border-radius: 0">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Établissement</th>
                            <th>Site web</th>
                            <th>État</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading">
                            <td colspan="3" class="py-8 text-center" style="color: var(--text-faint)">
                                Chargement…
                            </td>
                        </tr>
                        <tr v-for="row in filtered" v-else :key="row.id">
                            <td>
                                <div class="flex items-center gap-2.5">
                                    <AvatarBadge :name="row.name" :size="30" />
                                    <div class="nm min-w-0"><b>{{ row.name }}</b></div>
                                </div>
                            </td>
                            <td class="text-[12.5px]" style="color: var(--text-muted)">
                                <a v-if="row.webSite" :href="row.webSite" target="_blank" rel="noreferrer">
                                    {{ row.webSite }}
                                </a>
                                <span v-else>—</span>
                            </td>
                            <td>
                                <UiPill :tone="row.active === false ? 'mute' : 'ok'">
                                    {{ row.active === false ? 'Désactivée' : 'Active' }}
                                </UiPill>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <EmptyState
                v-if="!loading && !filtered.length && keyword"
                title="Aucun résultat"
                text="Aucune école partenaire ne porte ce nom."
            />
            <EmptyState
                v-else-if="!loading && !filtered.length"
                title="Aucun établissement partenaire"
                text="Créez le premier : son compte de direction est généré et invité par email dans la foulée."
            />

            <template #footer>
                <span class="text-[12px]" style="color: var(--text-faint)">
                    <b class="nu" style="color: var(--navy)">{{ filtered.length }}</b>
                    établissement{{ filtered.length > 1 ? 's' : '' }} affiché{{ filtered.length > 1 ? 's' : '' }}
                </span>
                <NuxtLink to="/app" class="btn-secondary btn-sm">Voir le parc</NuxtLink>
            </template>
        </UiCard>
    </div>
</template>

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
        <div class="page-header">
            <div>
                <h1 class="page-title">Établissements partenaires</h1>
                <p class="mt-1 opacity-70 max-w-2xl">
                    Créer un partenaire génère son établissement et son compte de direction, puis
                    lui envoie un email contenant le lien de définition de son mot de passe. Il se
                    connecte ensuite sur le portail établissement.
                </p>
            </div>
            <button class="btn-primary" @click="showForm = !showForm">
                {{ showForm ? 'Annuler' : 'Nouveau partenaire' }}
            </button>
        </div>

        <p v-if="created" class="alert-success mt-4">{{ created }}</p>

        <form v-if="showForm" class="card-pad mt-6"
              @submit.prevent="submit">
            <h2 class="section-title">Nouvel établissement partenaire</h2>

            <p class="text-sm opacity-70 mb-3">Établissement</p>
            <div class="grid gap-4 sm:grid-cols-2">
                <label class="field-label">Nom
                    <input v-model="form.name" type="text" required placeholder="Groupe Scolaire…"
                           class="input mt-1" />
                </label>
                <label class="field-label">Email de contact
                    <input v-model="form.contactEmail" type="email" required
                           class="input mt-1" />
                </label>
                <label class="text-sm sm:col-span-2">Site web (facultatif)
                    <input v-model="form.webSite" type="url" placeholder="https://…"
                           class="input mt-1" />
                </label>
            </div>

            <p class="text-sm opacity-70 mt-6 mb-3">Compte de direction</p>
            <div class="grid gap-4 sm:grid-cols-3">
                <label class="field-label">Prénom
                    <input v-model="form.firstName" type="text" required
                           class="input mt-1" />
                </label>
                <label class="field-label">Nom
                    <input v-model="form.lastName" type="text" required
                           class="input mt-1" />
                </label>
                <label class="field-label">Email de connexion
                    <input v-model="form.userEmail" type="email" required
                           class="input mt-1" />
                </label>
            </div>

            <p v-if="formError" class="alert-danger mt-4" role="alert">{{ formError }}</p>

            <button type="submit" :disabled="saving || !complete"
                    class="btn-primary mt-4">
                {{ saving ? 'Création…' : 'Créer le partenaire' }}
            </button>
        </form>

        <p v-if="error" class="alert-danger mt-4" role="alert">{{ error }}</p>

        <div class="mt-6 overflow-x-auto">
            <table class="table">
                <thead>
                    <tr>
                        <th>Établissement</th>
                        <th>Site web</th>
                        <th>État</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading"><td colspan="3" class="py-8 text-center" style="color: var(--text-muted)">Chargement…</td></tr>
                    <tr v-else-if="!rows.length">
                        <td colspan="3" class="py-8 text-center" style="color: var(--text-muted)">Aucun établissement partenaire.</td>
                    </tr>
                    <tr v-for="row in rows" :key="row.id" >
                        <td>{{ row.name }}</td>
                        <td>{{ row.webSite || '—' }}</td>
                        <td>{{ row.active === false ? 'Inactif' : 'Actif' }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

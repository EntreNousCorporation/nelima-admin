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
        <div class="flex items-start justify-between gap-4 flex-wrap">
            <div>
                <h1 class="text-2xl font-semibold">Établissements partenaires</h1>
                <p class="mt-1 opacity-70 max-w-2xl">
                    Créer un partenaire génère son établissement et son compte de direction, puis
                    lui envoie un email contenant le lien de définition de son mot de passe. Il se
                    connecte ensuite sur le portail établissement.
                </p>
            </div>
            <button class="rounded bg-nelima-600 px-4 py-2 text-white" @click="showForm = !showForm">
                {{ showForm ? 'Annuler' : 'Nouveau partenaire' }}
            </button>
        </div>

        <p v-if="created" class="mt-4 text-sm text-nelima-600">{{ created }}</p>

        <form v-if="showForm" class="mt-6 rounded border border-black/10 dark:border-white/15 p-4"
              @submit.prevent="submit">
            <h2 class="font-medium mb-4">Nouvel établissement partenaire</h2>

            <p class="text-sm opacity-70 mb-3">Établissement</p>
            <div class="grid gap-4 sm:grid-cols-2">
                <label class="text-sm">Nom
                    <input v-model="form.name" type="text" required placeholder="Groupe Scolaire…"
                           class="mt-1 w-full rounded border border-black/20 dark:border-white/20 bg-transparent px-3 py-2" />
                </label>
                <label class="text-sm">Email de contact
                    <input v-model="form.contactEmail" type="email" required
                           class="mt-1 w-full rounded border border-black/20 dark:border-white/20 bg-transparent px-3 py-2" />
                </label>
                <label class="text-sm sm:col-span-2">Site web (facultatif)
                    <input v-model="form.webSite" type="url" placeholder="https://…"
                           class="mt-1 w-full rounded border border-black/20 dark:border-white/20 bg-transparent px-3 py-2" />
                </label>
            </div>

            <p class="text-sm opacity-70 mt-6 mb-3">Compte de direction</p>
            <div class="grid gap-4 sm:grid-cols-3">
                <label class="text-sm">Prénom
                    <input v-model="form.firstName" type="text" required
                           class="mt-1 w-full rounded border border-black/20 dark:border-white/20 bg-transparent px-3 py-2" />
                </label>
                <label class="text-sm">Nom
                    <input v-model="form.lastName" type="text" required
                           class="mt-1 w-full rounded border border-black/20 dark:border-white/20 bg-transparent px-3 py-2" />
                </label>
                <label class="text-sm">Email de connexion
                    <input v-model="form.userEmail" type="email" required
                           class="mt-1 w-full rounded border border-black/20 dark:border-white/20 bg-transparent px-3 py-2" />
                </label>
            </div>

            <p v-if="formError" class="mt-4 text-sm text-red-600" role="alert">{{ formError }}</p>

            <button type="submit" :disabled="saving || !complete"
                    class="mt-4 rounded bg-nelima-600 px-4 py-2 text-white disabled:opacity-50">
                {{ saving ? 'Création…' : 'Créer le partenaire' }}
            </button>
        </form>

        <p v-if="error" class="mt-4 text-sm text-red-600" role="alert">{{ error }}</p>

        <div class="mt-6 overflow-x-auto">
            <table class="w-full text-sm border-collapse">
                <thead>
                    <tr class="text-left border-b border-black/10 dark:border-white/15">
                        <th class="py-2 pr-4 font-medium">Établissement</th>
                        <th class="py-2 pr-4 font-medium">Site web</th>
                        <th class="py-2 pr-4 font-medium">État</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading"><td colspan="3" class="py-6 opacity-70">Chargement…</td></tr>
                    <tr v-else-if="!rows.length">
                        <td colspan="3" class="py-6 opacity-70">Aucun établissement partenaire.</td>
                    </tr>
                    <tr v-for="row in rows" :key="row.id" class="border-b border-black/5 dark:border-white/10">
                        <td class="py-2 pr-4">{{ row.name }}</td>
                        <td class="py-2 pr-4">{{ row.webSite || '—' }}</td>
                        <td class="py-2 pr-4">{{ row.active === false ? 'Inactif' : 'Actif' }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

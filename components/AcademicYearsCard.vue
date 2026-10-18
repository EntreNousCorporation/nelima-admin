<script setup lang="ts">
/**
 * Années scolaires de la plateforme, communes à toutes les écoles.
 *
 * Seule l'équipe YPYit les définit : libellé, bornes, année en cours. Chaque école y pose ensuite
 * ses trimestres et clôture son année à son rythme ; rien de cela ne se règle ici.
 */
type AcademicYear = {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    active: boolean;
};

const api = useApi();
const years = ref<AcademicYear[]>([]);
const loading = ref(true);
const error = ref('');
const showForm = ref(false);
const editing = ref<AcademicYear | null>(null);
const saving = ref(false);
const form = reactive({ label: '', startDate: '', endDate: '', active: false });

async function load() {
    loading.value = true;
    try {
        years.value = await api<AcademicYear[]>('/academic-years');
    } catch {
        error.value = "Les années scolaires n'ont pas pu être chargées.";
    } finally {
        loading.value = false;
    }
}

function openCreate() {
    editing.value = null;
    // L'année qui suit la plus récente : c'est presque toujours celle qu'on vient déclarer.
    const latest = years.value[0];
    const start = latest ? Number(latest.label.slice(0, 4)) + 1 : new Date().getFullYear();
    Object.assign(form, {
        label: `${start}-${start + 1}`,
        startDate: `${start}-09-01`, endDate: `${start + 1}-07-31`, active: false,
    });
    error.value = '';
    showForm.value = true;
}

function openEdit(year: AcademicYear) {
    editing.value = year;
    Object.assign(form, { label: year.label, startDate: year.startDate, endDate: year.endDate, active: year.active });
    error.value = '';
    showForm.value = true;
}

async function save() {
    saving.value = true;
    error.value = '';
    try {
        const body = { ...form, periods: [] };
        if (editing.value) await api(`/academic-years/${editing.value.id}`, { method: 'PUT', body });
        else await api('/academic-years', { method: 'POST', body });
        showForm.value = false;
        await load();
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "L'année n'a pas pu être enregistrée.";
    } finally {
        saving.value = false;
    }
}

async function remove(year: AcademicYear) {
    error.value = '';
    try {
        await api(`/academic-years/${year.id}`, { method: 'DELETE' });
        await load();
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "L'année n'a pas pu être supprimée.";
    }
}

const day = (value: string) => value.split('-').reverse().join('/');

onMounted(load);
</script>

<template>
    <UiCard
        :pad="false" title="Années scolaires"
        sub="Communes à toutes les écoles ; chacune y pose ses trimestres et clôture la sienne"
    >
        <template #action>
            <button v-if="!showForm" class="btn-primary btn-sm" @click="openCreate">
                <BoIcon name="plus" :size="15" /> Nouvelle année
            </button>
        </template>

        <form v-if="showForm" class="card-b" style="border-bottom: 1px solid var(--border)" @submit.prevent="save">
            <div class="grid gap-3 sm:grid-cols-3">
                <div>
                    <label class="field-label" for="year-label">Libellé</label>
                    <input id="year-label" v-model="form.label" type="text" required placeholder="2027-2028" class="input" />
                </div>
                <div>
                    <label class="field-label" for="year-start">Début</label>
                    <input id="year-start" v-model="form.startDate" type="date" required class="input" />
                </div>
                <div>
                    <label class="field-label" for="year-end">Fin</label>
                    <input id="year-end" v-model="form.endDate" type="date" required class="input" />
                </div>
            </div>
            <label class="flex items-center gap-2 text-[12.5px] mt-3">
                <input v-model="form.active" type="checkbox" :disabled="editing?.active" />
                Année en cours
                <span style="color: var(--text-faint)">
                    — toutes les écoles y travaillent par défaut ; la précédente reste consultable
                </span>
            </label>
            <div class="flex gap-2 mt-3">
                <button type="submit" class="btn-primary btn-sm" :disabled="saving">
                    {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
                </button>
                <button type="button" class="btn-secondary btn-sm" @click="showForm = false">Annuler</button>
            </div>
        </form>

        <p v-if="error" class="alert-danger m-3" role="alert">{{ error }}</p>

        <table class="table">
            <thead>
                <tr><th>Année</th><th>Du</th><th>Au</th><th>Statut</th><th /></tr>
            </thead>
            <tbody>
                <TableSkeleton v-if="loading" :columns="5" />
                <tr v-for="year in years" v-else :key="year.id">
                    <td><b>{{ year.label }}</b></td>
                    <td>{{ day(year.startDate) }}</td>
                    <td>{{ day(year.endDate) }}</td>
                    <td><UiPill :tone="year.active ? 'ok' : 'mute'">{{ year.active ? 'En cours' : '—' }}</UiPill></td>
                    <td class="text-right">
                        <button class="btn-ghost btn-sm" @click="openEdit(year)">Modifier</button>
                        <button v-if="!year.active" class="btn-ghost btn-sm" @click="remove(year)">Supprimer</button>
                    </td>
                </tr>
            </tbody>
        </table>
    </UiCard>
</template>

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

/* ---- Écoles d'une année, et réouverture ---- */
type SchoolState = { establishmentId: string; name: string; status: 'OPEN' | 'CLOSED'; closedAt?: string | null; closedBy?: string | null };
const openedYear = ref<string | null>(null);
const schools = ref<SchoolState[]>([]);
const schoolsLoading = ref(false);
/** École dont la réouverture attend confirmation : rouvrir des comptes clôturés n'est pas anodin. */
const confirming = ref<string | null>(null);

async function toggleSchools(year: AcademicYear) {
    if (openedYear.value === year.id) {
        openedYear.value = null;
        return;
    }
    openedYear.value = year.id;
    confirming.value = null;
    await loadSchools(year.id);
}

async function loadSchools(yearId: string) {
    schoolsLoading.value = true;
    try {
        schools.value = await api<SchoolState[]>(`/academic-years/${yearId}/schools`);
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "Les écoles n'ont pas pu être chargées.";
    } finally {
        schoolsLoading.value = false;
    }
}

async function reopen(yearId: string, school: SchoolState) {
    error.value = '';
    try {
        await api(`/academic-years/${yearId}/schools/${school.establishmentId}/reopen`, { method: 'POST' });
        confirming.value = null;
        await loadSchools(yearId);
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "L'année n'a pas pu être rouverte.";
    }
}

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
                <template v-for="year in years" v-else :key="year.id">
                    <tr>
                        <td><b>{{ year.label }}</b></td>
                        <td>{{ day(year.startDate) }}</td>
                        <td>{{ day(year.endDate) }}</td>
                        <td><UiPill :tone="year.active ? 'ok' : 'mute'">{{ year.active ? 'En cours' : '—' }}</UiPill></td>
                        <td class="text-right">
                            <button class="btn-ghost btn-sm" @click="toggleSchools(year)">
                                {{ openedYear === year.id ? 'Masquer les écoles' : 'Écoles' }}
                            </button>
                            <button class="btn-ghost btn-sm" @click="openEdit(year)">Modifier</button>
                            <button v-if="!year.active" class="btn-ghost btn-sm" @click="remove(year)">Supprimer</button>
                        </td>
                    </tr>
                    <tr v-if="openedYear === year.id">
                        <td colspan="5" style="background: var(--surface-sunken)">
                            <p v-if="schoolsLoading" class="text-[12.5px]">Chargement…</p>
                            <p v-else-if="!schools.length" class="text-[12.5px]" style="color: var(--text-faint)">
                                Aucune école n'a encore travaillé sur cette année.
                            </p>
                            <div
                                v-for="school in schools" v-else :key="school.establishmentId"
                                class="flex flex-wrap items-center gap-2 py-1.5"
                            >
                                <b class="text-[12.5px] flex-1">{{ school.name }}</b>
                                <UiPill :tone="school.status === 'CLOSED' ? 'mute' : 'ok'">
                                    {{ school.status === 'CLOSED' ? 'Clôturée' : 'Ouverte' }}
                                </UiPill>
                                <span v-if="school.status === 'CLOSED'" class="text-[11.5px]" style="color: var(--text-faint)">
                                    le {{ school.closedAt ? new Date(school.closedAt).toLocaleDateString('fr-FR') : '—' }}
                                    <template v-if="school.closedBy"> par {{ school.closedBy }}</template>
                                </span>
                                <template v-if="school.status === 'CLOSED'">
                                    <button
                                        v-if="confirming !== school.establishmentId" class="btn-secondary btn-sm"
                                        @click="confirming = school.establishmentId"
                                    >Rouvrir</button>
                                    <template v-else>
                                        <span class="text-[12px] font-semibold" style="color: var(--danger)">
                                            L'école pourra de nouveau modifier {{ year.label }}.
                                        </span>
                                        <button class="btn-primary btn-sm" @click="reopen(year.id, school)">Confirmer</button>
                                        <button class="btn-ghost btn-sm" @click="confirming = null">Annuler</button>
                                    </template>
                                </template>
                            </div>
                        </td>
                    </tr>
                </template>
            </tbody>
        </table>
    </UiCard>
</template>

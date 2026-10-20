<script setup lang="ts">
/**
 * Groupes scolaires à plusieurs sites.
 *
 * Chaque site reste une école à part entière (élèves, classes, frais, caisse). Le groupe ne fait
 * que les relier : ses comptes « direction de groupe » passent d'un site à l'autre dans le portail
 * et disposent d'une vue « Tous les sites ». Les autres comptes ne voient que leur site.
 */
type Site = { id: string; name: string; city?: string | null };
type Member = { id: string; name: string; roleCode?: string | null; siteName: string; groupWide: boolean };
type Group = { id: string; name: string; sites: Site[]; members: Member[] };

const api = useApi();
const groups = ref<Group[]>([]);
const schools = ref<{ id: string; name: string }[]>([]);
const loading = ref(true);
const error = ref('');
const notice = ref('');

async function load() {
    loading.value = true;
    try {
        const [g, s] = await Promise.all([
            api<Group[]>('/admin/school-groups'),
            api<{ content: { id: string; name: string }[] }>('/establishments', { query: { size: 200 } }),
        ]);
        groups.value = g;
        schools.value = (s.content ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "Les groupes n'ont pas pu être chargés.";
    } finally {
        loading.value = false;
    }
}

/** Écoles déjà dans un autre groupe : on ne les propose pas, un site n'appartient qu'à un groupe. */
const takenBy = computed(() => {
    const map = new Map<string, string>();
    for (const g of groups.value) for (const s of g.sites) map.set(s.id, g.name);
    return map;
});

/* ---- Création et modification ---- */
const editing = ref<Group | null>(null);
const drawerOpen = ref(false);
const form = reactive({ name: '', establishmentIds: [] as string[] });
const saving = ref(false);
const schoolFilter = ref('');
const shownSchools = computed(() => {
    const q = schoolFilter.value.trim().toLowerCase();
    return schools.value.filter((s) => !q || s.name.toLowerCase().includes(q));
});

function openForm(group?: Group) {
    editing.value = group ?? null;
    form.name = group?.name ?? '';
    form.establishmentIds = group ? group.sites.map((s) => s.id) : [];
    schoolFilter.value = '';
    drawerOpen.value = true;
}

function toggleSchool(id: string) {
    form.establishmentIds = form.establishmentIds.includes(id)
        ? form.establishmentIds.filter((x) => x !== id) : [...form.establishmentIds, id];
}

async function save() {
    saving.value = true;
    try {
        const body = { name: form.name.trim(), establishmentIds: form.establishmentIds };
        if (editing.value) await api(`/admin/school-groups/${editing.value.id}`, { method: 'PUT', body });
        else await api('/admin/school-groups', { method: 'POST', body });
        drawerOpen.value = false;
        notice.value = `Groupe « ${body.name} » enregistré.`;
        error.value = '';
        await load();
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "Le groupe n'a pas pu être enregistré.";
    } finally {
        saving.value = false;
    }
}

/* ---- Direction de groupe ---- */
async function setGroupWide(member: Member, value: boolean) {
    try {
        await api(`/admin/users/${member.id}/group-wide`, { method: 'PUT', body: { groupWide: value } });
        member.groupWide = value;
        notice.value = value
            ? `${member.name} peut maintenant afficher tous les sites du groupe.`
            : `${member.name} ne voit plus que son site.`;
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "Le droit n'a pas pu être modifié.";
    }
}

/* ---- Dissolution ---- */
const dissolving = ref<string | null>(null);
async function dissolve(group: Group) {
    try {
        await api(`/admin/school-groups/${group.id}`, { method: 'DELETE' });
        dissolving.value = null;
        notice.value = `Groupe « ${group.name} » dissous : ses sites redeviennent des écoles indépendantes.`;
        await load();
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "Le groupe n'a pas pu être dissous.";
    }
}

onMounted(load);
</script>

<template>
    <div>
        <PageHead title="Groupes scolaires" sub="Écoles à plusieurs sites : chaque site garde ses élèves, ses frais et sa caisse">
            <template #actions>
                <button type="button" class="btn-primary" @click="openForm()"><BoIcon name="plus" :size="16" />Nouveau groupe</button>
            </template>
        </PageHead>

        <p v-if="error" class="alert-danger mb-4" role="alert">{{ error }}</p>
        <p v-if="notice" class="alert-success mb-4">{{ notice }}</p>

        <EmptyState
            v-if="!loading && !groups.length"
            title="Aucun groupe"
            text="Créez un groupe pour relier les sites d'un même groupe scolaire, puis désignez sa direction."
        />

        <div class="flex flex-col gap-3.5">
            <UiCard
                v-for="group in groups" :key="group.id" :title="group.name"
                :sub="`${group.sites.length} site${group.sites.length > 1 ? 's' : ''} · ${group.members.filter((m) => m.groupWide).length} direction(s) de groupe`"
                :pad="false"
            >
                <template #action>
                    <button type="button" class="btn-secondary btn-sm" @click="openForm(group)"><BoIcon name="edit" :size="14" />Modifier</button>
                    <button v-if="dissolving !== group.id" type="button" class="btn-ghost btn-sm" @click="dissolving = group.id">Dissoudre</button>
                    <template v-else>
                        <button type="button" class="btn-danger btn-sm" @click="dissolve(group)">Confirmer</button>
                        <button type="button" class="btn-ghost btn-sm" @click="dissolving = null">Garder</button>
                    </template>
                </template>
                <div class="px-4 py-3 flex flex-wrap gap-1.5" style="border-bottom: 1px solid var(--border)">
                    <UiPill v-for="site in group.sites" :key="site.id" tone="info">{{ site.name }}</UiPill>
                    <span v-if="!group.sites.length" class="text-[12.5px]" style="color: var(--text-faint)">Aucun site</span>
                </div>
                <div class="table-wrap" style="border: 0; box-shadow: none; border-radius: 0">
                    <table class="table">
                        <thead>
                            <tr><th>Compte</th><th>Site</th><th>Rôle</th><th class="text-right">Direction de groupe</th></tr>
                        </thead>
                        <tbody>
                            <tr v-for="member in group.members" :key="member.id">
                                <td><b class="text-[13px]">{{ member.name }}</b></td>
                                <td class="text-[12.5px]" style="color: var(--text-muted)">{{ member.siteName }}</td>
                                <td class="text-[12.5px]" style="color: var(--text-muted)">{{ member.roleCode ?? '—' }}</td>
                                <td class="text-right">
                                    <UiSwitch :model-value="member.groupWide" @update:model-value="(v: boolean) => setGroupWide(member, v)" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p v-if="!group.members.length" class="px-4 py-3 text-[12.5px]" style="color: var(--text-faint)">
                    Aucun compte dans ces sites pour l'instant.
                </p>
            </UiCard>
        </div>

        <SideDrawer
            v-if="drawerOpen" :title="editing ? editing.name : 'Nouveau groupe'"
            sub="Une école ne peut appartenir qu'à un groupe ; retirée, elle redevient indépendante"
            @close="drawerOpen = false"
        >
            <label class="field-label" for="group-name">Nom du groupe</label>
            <input id="group-name" v-model="form.name" class="input mb-4" maxlength="120" placeholder="Ex. Groupe scolaire Dubass" />

            <label class="field-label" for="group-filter">Sites ({{ form.establishmentIds.length }})</label>
            <input id="group-filter" v-model="schoolFilter" type="search" class="input mb-2" placeholder="Filtrer les écoles…" />
            <div class="rounded-lg overflow-hidden" style="border: 1px solid var(--border); max-height: 420px; overflow-y: auto">
                <label
                    v-for="school in shownSchools" :key="school.id"
                    class="flex items-center gap-2.5 px-3 py-2 text-[13px] cursor-pointer"
                    style="border-bottom: 1px solid var(--border)"
                    :style="takenBy.has(school.id) && takenBy.get(school.id) !== editing?.name ? 'opacity: .5; cursor: not-allowed' : ''"
                >
                    <input
                        type="checkbox" :checked="form.establishmentIds.includes(school.id)"
                        :disabled="takenBy.has(school.id) && takenBy.get(school.id) !== editing?.name"
                        @change="toggleSchool(school.id)"
                    />
                    <span class="flex-1">{{ school.name }}</span>
                    <span v-if="takenBy.has(school.id) && takenBy.get(school.id) !== editing?.name" class="text-[11.5px]" style="color: var(--text-faint)">
                        {{ takenBy.get(school.id) }}
                    </span>
                </label>
            </div>
            <template #footer>
                <button type="button" class="btn-secondary" @click="drawerOpen = false">Annuler</button>
                <button type="button" class="btn-primary" :disabled="saving || !form.name.trim()" @click="save">
                    <BoIcon name="check" :size="16" />Enregistrer
                </button>
            </template>
        </SideDrawer>
    </div>
</template>

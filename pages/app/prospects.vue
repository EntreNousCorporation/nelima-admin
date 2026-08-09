<script setup lang="ts">
import {
    PROSPECT_STATUSES, prospectStatusLabel, prospectStatusTone,
    type Prospect, type ProspectStatus,
} from '~/composables/useProspects';
import { PLAN_LABELS, PLAN_TONES } from '~/composables/useSubscriptions';

/**
 * Demandes de démonstration déposées depuis le site public.
 *
 * <p>C'est le pendant du formulaire de nelima.ci. La demande est enregistrée plutôt qu'envoyée par
 * courriel : une boîte mail ne dit pas ce qui a déjà été rappelé, et une demande y disparaît sous
 * le reste du courrier.
 *
 * <p>Le suivi tient en trois états. Aucun tunnel de vente, aucune probabilité de conversion : ce
 * qui compte ici est de n'oublier personne, et une colonne de plus qui n'est jamais remplie ne
 * ferait que salir la liste.
 */
const prospects = useProspects();

const rows = ref<Prospect[]>([]);
const loading = ref(true);
const error = ref('');
const notice = ref('');

const filter = ref<ProspectStatus | ''>('PENDING');
const keyword = ref('');

const filtered = computed(() => {
    const q = keyword.value.trim().toLowerCase();
    return rows.value.filter((row) => {
        if (filter.value && row.status !== filter.value) return false;
        if (!q) return true;
        return `${row.schoolName} ${row.contactName} ${row.city ?? ''}`.toLowerCase().includes(q);
    });
});

const pendingCount = computed(() => rows.value.filter((row) => row.status === 'PENDING').length);

/** Demandes de la semaine : c'est le rythme auquel le site convertit, pas un total cumulé. */
const thisWeek = computed(() => {
    const since = Date.now() - 7 * 24 * 3600 * 1000;
    return rows.value.filter((row) => new Date(row.createdAt).getTime() >= since).length;
});

const totalStudents = computed(() => rows.value
    .filter((row) => row.status !== 'DISMISSED')
    .reduce((total, row) => total + Number(row.studentCount ?? 0), 0));

async function load() {
    loading.value = true;
    error.value = '';
    try {
        rows.value = await prospects.all();
    } catch {
        error.value = "Les demandes n'ont pas pu être chargées.";
    } finally {
        loading.value = false;
    }
}

/* ---- Fiche ---- */
const opened = ref<Prospect | null>(null);
const note = ref('');
const saving = ref(false);

function open(row: Prospect) {
    opened.value = row;
    note.value = row.handledNote ?? '';
}

async function mark(status: ProspectStatus) {
    if (!opened.value) return;
    saving.value = true;
    error.value = '';
    try {
        const updated = await prospects.setStatus(opened.value.id, status, note.value || undefined);
        notice.value = `${updated.schoolName} — ${prospectStatusLabel(status).toLowerCase()}.`;
        opened.value = null;
        await load();
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "Le statut n'a pas pu être enregistré.";
    } finally {
        saving.value = false;
    }
}

function day(iso?: string) {
    return iso ? new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }) : '—';
}

onMounted(load);
</script>

<template>
    <div>
        <PageHead
            title="Prospects"
            :sub="`Demandes de démonstration reçues depuis nelima.ci · ${pendingCount} à rappeler`"
        />

        <p v-if="error" class="alert-danger mb-3.5" role="alert">{{ error }}</p>
        <p v-if="notice" class="alert-success mb-3.5" role="status" @click="notice = ''">
            {{ notice }}
        </p>

        <div class="grid-12 mb-3.5">
            <KpiCard
                class="c4" label="À rappeler" icon="megaphone"
                :value="String(pendingCount)"
                :value-tone="pendingCount ? 'var(--warning)' : undefined"
                foot="demandes sans suite donnée"
                tip="Une demande reste ici tant que personne ne l'a marquée traitée ou écartée. C'est la seule liste à vider."
            />
            <KpiCard
                class="c4" label="Cette semaine" icon="calendar"
                :value="String(thisWeek)"
                foot="demandes reçues sur sept jours"
                tip="Le rythme auquel le site convertit. Un total cumulé ne dirait rien de la semaine en cours."
            />
            <KpiCard
                class="c4" label="Élèves représentés" icon="students"
                :value="String(totalStudents)"
                foot="effectifs déclarés, hors demandes écartées"
                tip="Effectifs annoncés par les écoles elles-mêmes. Approximatifs par nature : ils préparent l'échange, ils ne facturent rien."
            />
        </div>

        <UiCard :pad="false">
            <div class="tbar">
                <label class="inp" style="flex: 0 1 280px">
                    <BoIcon name="search" :size="16" />
                    <input
                        v-model="keyword" type="search" class="w-full"
                        placeholder="École, contact, ville…" aria-label="Rechercher une demande"
                    />
                </label>
                <button
                    v-for="status in PROSPECT_STATUSES" :key="status.value" class="chip"
                    :aria-pressed="filter === status.value" @click="filter = status.value"
                >{{ status.label }}</button>
                <button class="chip" :aria-pressed="!filter" @click="filter = ''">Toutes</button>
            </div>

            <div class="table-wrap" style="border: 0; box-shadow: none; border-radius: 0">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Établissement</th>
                            <th>Contact</th>
                            <th class="r">Élèves</th>
                            <th>Formule appelée</th>
                            <th>Reçue le</th>
                            <th>Statut</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <TableSkeleton v-if="loading" :columns="7" />
                        <tr v-for="row in filtered" v-else :key="row.id" class="cl" @click="open(row)">
                            <td>
                                <div class="flex items-center gap-2.5">
                                    <AvatarBadge :name="row.schoolName" :size="30" />
                                    <div class="nm min-w-0">
                                        <b>{{ row.schoolName }}</b>
                                        <span>{{ row.city ?? 'ville non précisée' }}</span>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <div class="nm min-w-0">
                                    <b>{{ row.contactName }}</b>
                                    <span>{{ row.phone ?? row.email }}</span>
                                </div>
                            </td>
                            <td class="num">{{ row.studentCount ?? '—' }}</td>
                            <td>
                                <!-- Le palier que l'effectif appellerait, pour préparer l'échange.
                                     Il n'engage rien : la formule se négocie. -->
                                <span
                                    v-if="row.suggestedPlan" class="tag"
                                    :style="{ color: PLAN_TONES[row.suggestedPlan] }"
                                >{{ PLAN_LABELS[row.suggestedPlan] }}</span>
                                <span v-else class="text-[12px]" style="color: var(--text-faint)">
                                    —
                                </span>
                            </td>
                            <td class="text-[12.5px]" style="color: var(--text-muted)">
                                {{ day(row.createdAt) }}
                            </td>
                            <td>
                                <UiPill :tone="prospectStatusTone(row.status)">
                                    {{ prospectStatusLabel(row.status) }}
                                </UiPill>
                            </td>
                            <td class="text-right">
                                <BoIcon name="chevron-right" :size="16" style="color: var(--text-faint)" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <EmptyState
                v-if="!loading && !filtered.length && (keyword || filter)"
                title="Aucune demande"
                text="Modifiez les filtres pour retrouver une demande."
            />
            <EmptyState
                v-else-if="!loading && !filtered.length"
                title="Aucune demande reçue"
                text="Les demandes déposées sur nelima.ci apparaîtront ici, et un courriel vous préviendra."
            />

            <template #footer>
                <span class="text-[12px]" style="color: var(--text-faint)">
                    <b class="nu" style="color: var(--navy)">{{ filtered.length }}</b>
                    demande{{ filtered.length > 1 ? 's' : '' }} affichée{{ filtered.length > 1 ? 's' : '' }}
                </span>
                <span class="text-[12px]" style="color: var(--text-faint)">
                    Une demande écartée est conservée : elle dit ce qui a été vu et refusé
                </span>
            </template>
        </UiCard>

        <!-- ============ Fiche demande ============ -->
        <SideDrawer
            v-if="opened" :title="opened.schoolName"
            :sub="`${opened.city ?? 'ville non précisée'} · reçue le ${day(opened.createdAt)}`"
            @close="opened = null"
        >
            <template #avatar>
                <AvatarBadge :name="opened.schoolName" :size="44" />
            </template>

            <div class="flex gap-2 flex-wrap mb-4">
                <UiPill :tone="prospectStatusTone(opened.status)">
                    {{ prospectStatusLabel(opened.status) }}
                </UiPill>
                <span
                    v-if="opened.suggestedPlan" class="tag"
                    :style="{ color: PLAN_TONES[opened.suggestedPlan] }"
                >{{ PLAN_LABELS[opened.suggestedPlan] }} appelée</span>
            </div>

            <p class="sec">Contact</p>
            <dl class="kv mb-5">
                <dt>Personne</dt>
                <dd>{{ opened.contactName }}</dd>
                <dt>Courriel</dt>
                <dd><a :href="`mailto:${opened.email}`">{{ opened.email }}</a></dd>
                <dt>Téléphone</dt>
                <dd>
                    <a v-if="opened.phone" :href="`tel:${opened.phone.replace(/\s/g, '')}`">
                        {{ opened.phone }}
                    </a>
                    <span v-else style="color: var(--text-faint)">—</span>
                </dd>
                <dt>Effectif déclaré</dt>
                <dd class="nu">{{ opened.studentCount ?? '—' }}</dd>
                <dt>Page d'origine</dt>
                <dd>{{ opened.sourcePage ?? '—' }}</dd>
            </dl>

            <template v-if="opened.message">
                <p class="sec">Ce que l'école demande</p>
                <p
                    class="text-[13px] leading-relaxed mb-5"
                    style="color: var(--text-muted); white-space: pre-line"
                >{{ opened.message }}</p>
            </template>

            <p class="sec">Suivi</p>
            <div>
                <label class="field-label" for="note">Note de rappel</label>
                <textarea
                    id="note" v-model="note" class="input" rows="3"
                    placeholder="Rappelée le 6, démonstration fixée au 12…"
                />
                <p class="text-[12px] mt-1" style="color: var(--text-faint)">
                    Elle reste attachée à la demande. Une note vague ne dira rien dans trois mois.
                </p>
            </div>

            <p
                v-if="opened.handledAt" class="text-[12px] mt-3"
                style="color: var(--text-faint)"
            >Dernier traitement : {{ day(opened.handledAt) }}</p>

            <template #footer>
                <button
                    v-if="opened.status !== 'HANDLED'" class="btn-primary" :disabled="saving"
                    @click="mark('HANDLED')"
                ><BoIcon name="check" :size="16" />Marquer traitée</button>
                <button
                    v-if="opened.status !== 'PENDING'" class="btn-secondary" :disabled="saving"
                    @click="mark('PENDING')"
                >Remettre à rappeler</button>
                <button
                    v-if="opened.status !== 'DISMISSED'" class="btn-secondary" :disabled="saving"
                    @click="mark('DISMISSED')"
                ><BoIcon name="ban" :size="16" />Écarter</button>
                <NuxtLink to="/app/etablissements" class="btn-secondary">
                    <BoIcon name="plus" :size="16" />Créer le partenaire
                </NuxtLink>
            </template>
        </SideDrawer>
    </div>
</template>

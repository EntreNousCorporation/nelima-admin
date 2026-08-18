<script setup lang="ts">
import {
    PLAN_LABELS, PLAN_TONES, invoiceStatusLabel, invoiceStatusTone,
    type InvoiceStatus, type SubscriptionPlan,
} from '~/composables/useSubscriptions';
import { fm, fmc } from '~/composables/useMoney';

type Establishment = {
    id: string;
    name: string;
    webSite?: string;
    city?: string;
    active?: boolean;
    /** Antennes rattachées. L'établissement principal compte pour un site, elles s'y ajoutent. */
    subsidiaries?: unknown[];
};

/** Contacts et direction : ils ne voyagent pas dans la liste, la fiche va les chercher. */
type EstablishmentDetail = Establishment & {
    shortName?: string;
    accreditationNumber?: string;
    /** L'`id` du contact est indispensable : c'est par lui que le PUT met à jour l'existant au lieu
     *  d'en créer un doublon (contrainte d'unicité applicative sur le contact). */
    contacts?: { id?: string; type: string; value: string; isPrimary?: boolean }[];
    /** L'`id` sert au renvoi du lien d'activation : c'est ce compte-là qui l'a reçu. */
    principal?: { id?: string; firstName?: string; lastName?: string };
};

/** Agrégats servis par la console : effectif, encaissements du mois, impayés. */
type SchoolRow = {
    subscriptionPlan?: SubscriptionPlan;
    subscribedAt?: string;
    subscriptionAmount?: number;
    id: string;
    studentCount: number;
    collectedThisMonth: number;
    commissionThisMonth: number;
    overdueAmount: number;
    overdueCount: number;
    expectedThisMonth: number;
    collectedPreviousMonth: number;
};

const api = useApi();
const subscriptions = useSubscriptions();

const stats = ref<Record<string, SchoolRow>>({});
const plans = ref<{ plan: SubscriptionPlan; label: string; price: number; maxStudents: number | null }[]>([]);

/** Fiche ouverte en tiroir. C'est là que se règle l'abonnement. */
const opened = ref<Establishment | null>(null);
const openedInvoices = ref<
    { number: string; amount: number; periodStart: string; status: string }[]>([]);
const openedDetail = ref<EstablishmentDetail | null>(null);

/** Adresse de contact de l'établissement, et non celle de son compte de direction. */
const contactEmail = computed(() => openedDetail.value?.contacts
    ?.find((contact) => contact.type === 'EMAIL' && contact.isPrimary)?.value
    ?? openedDetail.value?.contacts?.find((contact) => contact.type === 'EMAIL')?.value);

const principal = computed(() => {
    const person = openedDetail.value?.principal;
    if (!person) return null;
    return [person.firstName, person.lastName].filter(Boolean).join(' ') || null;
});
/**
 * Renvoi du courriel de bienvenue et de son lien de définition de mot de passe.
 *
 * <p>Le premier courriel se perd — filtre anti-pourriel, adresse mal saisie, lien laissé expirer.
 * Sans ce bouton, la seule issue était de supprimer l'établissement et de le recréer.
 */
const resending = ref(false);
const resendMessage = ref('');

async function resendActivation() {
    const school = opened.value;
    const userId = openedDetail.value?.principal?.id;
    if (!school || !userId) return;

    resending.value = true;
    resendMessage.value = '';
    try {
        await api(`/establishments/${school.id}/users/${userId}/resend-activation`, { method: 'POST' });
        resendMessage.value = 'Lien renvoyé. Le précédent ne vaut plus.';
    } catch {
        resendMessage.value = "Le renvoi a échoué. Réessayez dans un instant.";
    } finally {
        resending.value = false;
    }
}

const planDraft = ref<SubscriptionPlan | ''>('');
const subscribedAtDraft = ref('');
const cityDraft = ref('');
const savingPlan = ref(false);

/* Identité de l'école, éditée indépendamment de l'abonnement. */
const nameDraft = ref('');
const shortNameDraft = ref('');
const accreditationDraft = ref('');
const webSiteDraft = ref('');
const phoneDraft = ref('');
const emailDraft = ref('');
const savingSchool = ref(false);

/**
 * Contact principal d'un type donné, tel qu'il est enregistré.
 *
 * <p>On le retrouve pour réutiliser son `id` au moment d'enregistrer : c'est ce qui distingue une
 * mise à jour d'une création, et évite le doublon que la contrainte d'unicité applicative refuse.
 *
 * <p>Le type est `PHONE_NUMBER`, jamais `PHONE` : c'est le nom de la valeur d'énumération côté
 * serveur. Écrit `PHONE`, il ne correspondait à aucun contact en lecture — le téléphone restait
 * vide sans rien signaler — et faisait échouer l'enregistrement, Jackson refusant une valeur
 * d'énumération inconnue par un 400 « La requête est mal formée. ».
 */
function primaryContact(type: 'EMAIL' | 'PHONE_NUMBER') {
    const contacts = openedDetail.value?.contacts ?? [];
    return contacts.find((contact) => contact.type === type && contact.isPrimary)
        ?? contacts.find((contact) => contact.type === type);
}

function statOf(id: string) {
    return stats.value[id] ?? {
        id, studentCount: 0, collectedThisMonth: 0, commissionThisMonth: 0,
        overdueAmount: 0, overdueCount: 0, expectedThisMonth: 0, collectedPreviousMonth: 0,
    };
}

/**
 * Recouvrement de l'école : encaissé du mois rapporté à ce que l'échéancier prévoyait.
 *
 * <p>Nul quand rien n'était attendu — une école sans échéance ce mois n'est ni bonne ni mauvaise
 * élève, et lui donner 100 % la ferait passer devant celles qui recouvrent vraiment.
 */
function recoveryOf(id: string) {
    const expected = Number(statOf(id).expectedThisMonth ?? 0);
    if (!expected) return null;
    return (Number(statOf(id).collectedThisMonth ?? 0) / expected) * 100;
}

/**
 * Consommation du palier souscrit.
 *
 * <p>Enterprise n'a pas de plafond : la barre n'aurait rien à remplir, on ne l'affiche pas.
 */
const palier = computed(() => {
    if (!opened.value) return null;
    const plan = plans.value.find((entry) => entry.plan === statOf(opened.value!.id).subscriptionPlan);
    if (!plan?.maxStudents) return null;
    const students = Number(statOf(opened.value.id).studentCount ?? 0);
    return { cap: plan.maxStudents, used: (students / plan.maxStudents) * 100 };
});

/** Dernière facture de l'école : c'est son statut que porte la pastille d'en-tête. */
const lastInvoice = computed(() => openedInvoices.value[0] ?? null);

const currentPlan = computed(() =>
    plans.value.find((entry) => entry.plan === statOf(opened.value?.id ?? '').subscriptionPlan) ?? null);

const contactPhone = computed(() => openedDetail.value?.contacts
    ?.find((contact) => contact.type === 'PHONE_NUMBER')?.value);

const shortMonth = new Date().toLocaleDateString('fr-FR', { month: 'long' });

/**
 * Tendance des encaissements de l'école, d'un mois sur l'autre.
 *
 * <p>Nulle quand le mois précédent est à zéro : une progression « infinie » ne veut rien dire, et
 * un écart nul se tait plutôt que d'afficher une flèche verte à +0 %.
 */
const collectedTrend = computed(() => {
    const before = Number(statOf(opened.value?.id ?? '').collectedPreviousMonth ?? 0);
    if (!before) return null;
    const now = Number(statOf(opened.value?.id ?? '').collectedThisMonth ?? 0);
    const delta = Math.round(((now - before) / before) * 1000) / 10;
    return delta === 0 ? null : delta;
});

/**
 * Prochaine facture d'abonnement.
 *
 * <p>Les périodes courent de douze mois à compter de la souscription. Tant que la période ouverte
 * n'a pas sa facture, la prochaine, c'est elle : le dire « à émettre » évite d'annoncer une date
 * lointaine alors que l'école est déjà facturable aujourd'hui.
 */
const nextInvoice = computed(() => {
    const since = statOf(opened.value?.id ?? '').subscribedAt;
    if (!since || !currentPlan.value) return '—';

    const start = new Date(since);
    const today = new Date();
    while (new Date(start.getFullYear() + 1, start.getMonth(), start.getDate()) <= today) {
        start.setFullYear(start.getFullYear() + 1);
    }
    const periodStart = start.toISOString().slice(0, 10);
    const issued = openedInvoices.value.some((invoice) => invoice.periodStart === periodStart
        && invoice.status !== 'CANCELLED');
    if (!issued) return 'à émettre';

    start.setFullYear(start.getFullYear() + 1);
    return start.toLocaleDateString('fr-FR');
});

/* ---- Édition ---- */
const editing = ref(false);

function cancelEdit() {
    editing.value = false;
    if (opened.value) resetDrafts(opened.value.id);
}

/** Les brouillons repartent toujours de l'état enregistré : une saisie abandonnée ne survit pas. */
function resetDrafts(id: string) {
    planDraft.value = statOf(id).subscriptionPlan ?? '';
    subscribedAtDraft.value = statOf(id).subscribedAt ?? new Date().toISOString().slice(0, 10);
    resetSchoolDrafts();
}

/**
 * Brouillons d'identité de l'école.
 *
 * <p>À l'ouverture, le détail n'est pas encore arrivé : la liste amorce ce qu'elle sait (nom, site,
 * ville), et cet appel est rejoué une fois le détail chargé pour compléter nom court, agrément et
 * contacts. La ville venait du tableau de bord du parc, faute d'être servie par la fiche ; elle
 * l'est depuis, et se lit là où on la modifie.
 */
function resetSchoolDrafts() {
    const detail = openedDetail.value;
    nameDraft.value = detail?.name ?? opened.value?.name ?? '';
    cityDraft.value = detail?.city ?? opened.value?.city ?? '';
    shortNameDraft.value = detail?.shortName ?? '';
    accreditationDraft.value = detail?.accreditationNumber ?? '';
    webSiteDraft.value = detail?.webSite ?? opened.value?.webSite ?? '';
    phoneDraft.value = primaryContact('PHONE_NUMBER')?.value ?? '';
    emailDraft.value = primaryContact('EMAIL')?.value ?? '';
}

async function openSchool(row: Establishment) {
    opened.value = row;
    // Une école sans contrat s'ouvre directement en édition : c'est la seule chose à y faire.
    editing.value = !statOf(row.id).subscriptionPlan;
    resetDrafts(row.id);
    openedInvoices.value = [];
    openedDetail.value = null;
    // Deux appels indépendants : l'un ne doit pas priver la fiche de l'autre.
    const [invoices, detail] = await Promise.allSettled([
        subscriptions.invoicesOf(row.id),
        api<EstablishmentDetail>(`/establishments/${row.id}`),
    ]);
    if (invoices.status === 'fulfilled') openedInvoices.value = invoices.value;
    if (detail.status === 'fulfilled') {
        openedDetail.value = detail.value;
        // Le détail complète ce que la liste ne portait pas : nom court, agrément, contacts.
        resetSchoolDrafts();
    }
}

async function savePlan() {
    if (!opened.value || !planDraft.value) return;
    savingPlan.value = true;
    error.value = '';
    try {
        await subscriptions.subscribe(opened.value.id, {
            plan: planDraft.value,
            subscribedAt: subscribedAtDraft.value || undefined,
        });
        created.value = `Abonnement de ${opened.value.name} enregistré.`;
        opened.value = null;
        editing.value = false;
        await load();
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "La formule n'a pas pu être enregistrée.";
    } finally {
        savingPlan.value = false;
    }
}

/**
 * Enregistrement de l'identité de l'école, indépendamment de l'abonnement.
 *
 * <p>Le PUT est un patch : les champs vides ne sont pas envoyés, donc rien n'est effacé par
 * omission. Les contacts, eux, repartent avec l'`id` du contact existant — c'est ce qui les fait
 * mettre à jour plutôt que dupliquer, la contrainte d'unicité applicative refusant le doublon. On
 * conserve leur `isPrimary` : le principal reste principal. Un contact vide n'est pas envoyé.
 */
async function saveSchool() {
    if (!opened.value) return;
    savingSchool.value = true;
    error.value = '';
    try {
        const contacts: {
            id?: string; value: string; type: 'EMAIL' | 'PHONE_NUMBER'; isPrimary?: boolean;
        }[] = [];
        const phone = primaryContact('PHONE_NUMBER');
        const email = primaryContact('EMAIL');
        if (phoneDraft.value.trim()) {
            contacts.push({
                id: phone?.id,
                value: phoneDraft.value.trim(),
                type: 'PHONE_NUMBER',
                isPrimary: phone?.isPrimary ?? true,
            });
        }
        if (emailDraft.value.trim()) {
            contacts.push({
                id: email?.id,
                value: emailDraft.value.trim(),
                type: 'EMAIL',
                isPrimary: email?.isPrimary ?? true,
            });
        }
        await api(`/establishments/${opened.value.id}`, {
            method: 'PUT',
            body: {
                name: nameDraft.value.trim() || undefined,
                shortName: shortNameDraft.value.trim() || undefined,
                accreditationNumber: accreditationDraft.value.trim() || undefined,
                city: cityDraft.value.trim() || undefined,
                webSite: webSiteDraft.value.trim() || undefined,
                contacts: contacts.length ? contacts : undefined,
            },
        });
        created.value = `Les informations de ${nameDraft.value.trim() || opened.value.name} ont été enregistrées.`;
        // Recharge la liste, puis le détail : la fiche ouverte doit refléter ce qui vient d'être écrit.
        const id = opened.value.id;
        await load();
        opened.value = rows.value.find((row) => row.id === id) ?? opened.value;
        const detail = await api<EstablishmentDetail>(`/establishments/${id}`).catch(() => null);
        if (detail) openedDetail.value = detail;
        resetSchoolDrafts();
        editing.value = false;
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "Les informations de l'école n'ont pas pu être enregistrées.";
    } finally {
        savingSchool.value = false;
    }
}

/** Un établissement principal est un site ; ses antennes s'y ajoutent. */
function sites(row: Establishment) {
    return 1 + (row.subsidiaries?.length ?? 0);
}

function sitesLabel(row: Establishment) {
    const count = sites(row);
    return `${count} site${count > 1 ? 's' : ''}`;
}

/**
 * Ligne d'identité sous le nom : ville, sites, ancienneté du client.
 *
 * <p>Ce que porte la maquette, dans cet ordre. La ville tombe quand elle n'est pas renseignée
 * plutôt que d'afficher un tiret : une école sans ville n'a pas un défaut à signaler.
 *
 * <p>L'ancienneté s'écrit au mois et non au jour : sur un contrat annuel, savoir qu'une école est
 * cliente depuis septembre 2022 suffit — le quantième n'apprend rien et allonge la ligne.
 */
function rowSub(row: Establishment) {
    const parts = [row.city, sitesLabel(row)].filter(Boolean);
    const since = statOf(row.id).subscribedAt;
    parts.push(since ? `client depuis ${month(since)}` : 'sans abonnement');
    return parts.join(' · ');
}

function month(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

function day(iso?: string) {
    return iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';
}

const rows = ref<Establishment[]>([]);
const allInvoices = ref<{ establishmentId: string; status: string }[]>([]);
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
    city: '',
    webSite: '',
    contactEmail: '',
});

const complete = computed(() => Boolean(form.firstName && form.lastName && form.userEmail
    && form.name && form.city && form.contactEmail));

/**
 * Filtres du tableau.
 *
 * <p>La maquette proposait « en essai » et « suspendues » : ni l'un ni l'autre n'existe — aucune
 * période d'essai n'a été actée, et rien ne permet de suspendre un établissement. Restent les
 * états qui appellent une action : une école sans contrat, une école qui accumule des impayés,
 * une école qui décroche sur son recouvrement.
 */
const state = ref<'all' | 'noplan' | 'late' | 'overdue' | 'watch'>('all');
const planFilter = ref<SubscriptionPlan | 'all'>('all');

const filtered = computed(() => {
    const q = keyword.value.trim().toLowerCase();
    return rows.value.filter((row) => {
        const stat = statOf(row.id);
        if (planFilter.value !== 'all' && stat.subscriptionPlan !== planFilter.value) return false;
        if (state.value === 'noplan' && stat.subscriptionPlan) return false;
        if (state.value === 'late' && !lateSchools.value.has(row.id)) return false;
        if (state.value === 'overdue' && !(Number(stat.overdueAmount ?? 0) > 0)) return false;
        if (state.value === 'watch') {
            const rate = recoveryOf(row.id);
            if (rate === null || rate >= 70) return false;
        }
        return !q || row.name.toLowerCase().includes(q);
    });
});

/**
 * Écoles en défaut sur leur abonnement.
 *
 * <p>« En retard » se déduit côté serveur de l'échéance et du règlement : la console n'a qu'à
 * relever les factures qui portent ce statut, sans le recalculer et risquer de diverger.
 */
const lateSchools = computed(() => new Set(allInvoices.value
    .filter((invoice) => invoice.status === 'LATE')
    .map((invoice) => invoice.establishmentId)));

/** Valeur annuelle du portefeuille affiché : c'est ce que le pied de tableau totalise. */
const shownValue = computed(() => filtered.value
    .reduce((total, row) => total + Number(statOf(row.id).subscriptionAmount ?? 0), 0));

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const [result, platform, grid, invoices] = await Promise.all([
            api<{ content: Establishment[] }>('/establishments', { query: { size: 100 } }),
            api<{ schools: SchoolRow[] }>('/dashboard/platform'),
            subscriptions.plans(),
            // Le filtre « en défaut » en dépend, la liste doit rester lisible sans.
            subscriptions.invoices().catch(() => []),
        ]);
        rows.value = result.content ?? [];
        stats.value = Object.fromEntries((platform.schools ?? []).map((row) => [row.id, row]));
        plans.value = grid;
        allInvoices.value = invoices;
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
                    city: form.city || undefined,
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
        Object.assign(form, {
            firstName: '', lastName: '', userEmail: '', name: '', city: '', webSite: '', contactEmail: '',
        });
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

/**
 * Ouverture directe d'une fiche depuis un autre écran.
 *
 * <p>Le tableau de bord renvoie ici avec `?ecole=<id>` plutôt que d'embarquer son propre tiroir :
 * une seule fiche à maintenir, et l'URL reste partageable entre deux administrateurs.
 */
const route = useRoute();

onMounted(async () => {
    await load();
    const wanted = String(route.query.ecole ?? '');
    const row = wanted ? rows.value.find((entry) => entry.id === wanted) : undefined;
    if (row) await openSchool(row);
});
</script>

<template>
    <div>
        <PageHead
            title="Écoles clientes"
            :sub="`${rows.length} établissement${rows.length > 1 ? 's' : ''} · ${fm(
                Object.values(stats).reduce((sum, row) => sum + Number(row.studentCount ?? 0), 0),
            )} élèves gérés`"
        >
            <template #actions>
                <button class="btn-primary" @click="showForm = !showForm">
                    <BoIcon :name="showForm ? 'close' : 'plus'" :size="16" />
                    {{ showForm ? 'Annuler' : 'Ajouter une école' }}
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
                        <label class="field-label field-label--required" for="newCity">Ville</label>
                        <CitySelect id="newCity" v-model="form.city" required />
                    </div>
                    <div>
                        <label class="field-label" for="contactEmail">Email de contact</label>
                        <input id="contactEmail" v-model="form.contactEmail" type="email" required class="input" />
                    </div>
                    <div>
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
                    <BoIcon name="search" :size="16" />
                    <input
                        v-model="keyword" type="search" class="w-full"
                        placeholder="Rechercher une école…" aria-label="Rechercher une école"
                    />
                </label>
                <button class="chip" :aria-pressed="state === 'all'" @click="state = 'all'">
                    Toutes
                </button>
                <button class="chip" :aria-pressed="state === 'noplan'" @click="state = 'noplan'">
                    Sans formule
                </button>
                <button class="chip" :aria-pressed="state === 'late'" @click="state = 'late'">
                    En défaut
                </button>
                <button class="chip" :aria-pressed="state === 'overdue'" @click="state = 'overdue'">
                    Avec impayés
                </button>
                <button class="chip" :aria-pressed="state === 'watch'" @click="state = 'watch'">
                    À surveiller
                </button>
                <div class="flex-1" />
                <select v-model="planFilter" class="select" style="flex: 0 0 auto; width: auto"
                        aria-label="Filtrer par formule">
                    <option value="all">Toutes les formules</option>
                    <option v-for="plan in plans" :key="plan.plan" :value="plan.plan">
                        {{ plan.label }}
                    </option>
                </select>
            </div>

            <div class="table-wrap" style="border: 0; box-shadow: none; border-radius: 0">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Établissement</th>
                            <th>Formule</th>
                            <th class="r">Élèves</th>
                            <th class="r">Abonnement</th>
                            <th class="r">Scolarités du mois</th>
                            <th class="r">Recouvrement</th>
                            <th class="r">Impayés</th>
                            <th>État</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <TableSkeleton v-if="loading" :columns="9" />
                        <tr v-for="row in filtered" v-else :key="row.id" class="cl" @click="openSchool(row)">
                            <td>
                                <div class="flex items-center gap-2.5">
                                    <AvatarBadge :name="row.name" :size="30" />
                                    <div class="nm min-w-0">
                                        <b>{{ row.name }}</b>
                                        <span>{{ rowSub(row) }}</span>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span
                                    v-if="statOf(row.id).subscriptionPlan" class="tag"
                                    :style="{ color: PLAN_TONES[statOf(row.id).subscriptionPlan] }"
                                >{{ PLAN_LABELS[statOf(row.id).subscriptionPlan!] }}</span>
                                <!-- Sans formule, l'école ne peut pas être facturée : le dire ici
                                     évite de chercher pourquoi elle n'apparaît jamais à facturer. -->
                                <span v-else class="text-[12px]" style="color: var(--warning)">
                                    à définir
                                </span>
                            </td>
                            <td class="num">{{ statOf(row.id).studentCount }}</td>
                            <td class="num">
                                {{ statOf(row.id).subscriptionAmount
                                    ? `${fm(statOf(row.id).subscriptionAmount)} F` : '—' }}
                            </td>
                            <td class="num">{{ fm(statOf(row.id).collectedThisMonth) }} F</td>
                            <td class="r">
                                <div v-if="recoveryOf(row.id) !== null"
                                     class="flex items-center gap-2.5 justify-end">
                                    <div class="h-1.5 w-14 rounded-full overflow-hidden"
                                         style="background: var(--surface-sunken)">
                                        <div
                                            class="h-full rounded-full"
                                            :style="{ width: `${Math.min(100, recoveryOf(row.id)!)}%`,
                                                      background: recoveryOf(row.id)! < 70
                                                          ? 'var(--warning-solid)' : 'var(--success-solid)' }"
                                        />
                                    </div>
                                    <b class="nu text-[12px]"
                                       :style="{ color: recoveryOf(row.id)! < 70
                                           ? 'var(--warning)' : 'var(--text-muted)' }">
                                        {{ recoveryOf(row.id)!.toFixed(0) }} %
                                    </b>
                                </div>
                                <span v-else class="text-[12px]" style="color: var(--text-faint)">—</span>
                            </td>
                            <td
                                class="num"
                                :style="Number(statOf(row.id).overdueAmount) > 0
                                    ? 'color: var(--danger)' : 'color: var(--text-faint)'"
                            >
                                {{ Number(statOf(row.id).overdueAmount) > 0
                                    ? `${fm(statOf(row.id).overdueAmount)} F` : '—' }}
                            </td>
                            <td>
                                <UiPill :tone="row.active === false ? 'mute' : 'ok'">
                                    {{ row.active === false ? 'Désactivée' : 'Active' }}
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
                v-if="!loading && !filtered.length && (keyword || state !== 'all' || planFilter !== 'all')"
                title="Aucune école"
                text="Modifiez les filtres pour retrouver un établissement."
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
                <span class="text-[12px]" style="color: var(--text-faint)">
                    Valeur annuelle
                    <b class="nu" style="color: var(--navy)">{{ fm(shownValue) }} FCFA</b>
                </span>
            </template>
        </UiCard>

        <!-- ============ Fiche école ============ -->
        <SideDrawer
            v-if="opened" :title="opened.name"
            :sub="rowSub(opened)"
            @close="opened = null"
        >
            <template #avatar>
                <AvatarBadge :name="opened.name" :size="44" />
            </template>

            <div class="flex gap-2 flex-wrap mb-4">
                <UiPill :tone="opened.active === false ? 'mute' : 'ok'">
                    {{ opened.active === false ? 'Désactivée' : 'Active' }}
                </UiPill>
                <span
                    v-if="statOf(opened.id).subscriptionPlan" class="tag"
                    :style="{ color: PLAN_TONES[statOf(opened.id).subscriptionPlan!] }"
                >{{ PLAN_LABELS[statOf(opened.id).subscriptionPlan!] }}</span>
                <UiPill v-if="lastInvoice" :tone="invoiceStatusTone(lastInvoice.status as InvoiceStatus)">
                    {{ invoiceStatusLabel(lastInvoice.status as InvoiceStatus) }}
                </UiPill>
            </div>

            <p class="sec">Abonnement Nelima</p>

            <!-- En lecture par défaut : une fiche s'ouvre bien plus souvent pour être consultée que
                 pour être modifiée, et un formulaire toujours ouvert invite à changer une formule
                 sans l'avoir voulu. Le pied de tiroir bascule en édition. -->
            <template v-if="!editing">
                <dl class="kv mb-3">
                    <dt>Formule</dt>
                    <dd>
                        <template v-if="currentPlan">
                            {{ currentPlan.label }} — {{ currentPlan.maxStudents
                                ? `jusqu'à ${fm(currentPlan.maxStudents)} élèves`
                                : 'au-delà de 1 000 élèves, sur devis' }}
                        </template>
                        <span v-else style="color: var(--warning)">à définir</span>
                    </dd>
                    <dt>Facturation</dt>
                    <dd class="nu">
                        {{ currentPlan ? `${fm(currentPlan.price)} FCFA / an` : '—' }}
                    </dd>
                    <dt>Élèves facturés</dt>
                    <dd class="nu">
                        {{ statOf(opened.id).studentCount }}{{ currentPlan?.maxStudents
                            ? ` sur ${fm(currentPlan.maxStudents)} inclus` : '' }}
                    </dd>
                    <dt>Souscrit le</dt>
                    <dd>{{ day(statOf(opened.id).subscribedAt) }}</dd>
                    <dt>Prochaine facture</dt>
                    <dd>{{ nextInvoice }}</dd>
                </dl>

                <div v-if="palier" class="mt-3 mb-5">
                    <div class="h-2 rounded-full overflow-hidden" style="background: var(--surface-sunken)">
                        <div
                            class="h-full rounded-full"
                            :style="{ width: `${Math.min(100, palier.used)}%`,
                                      background: palier.used > 92
                                          ? 'var(--warning-solid)' : 'var(--brand-600)' }"
                        />
                    </div>
                    <p class="text-[12px] mt-1" style="color: var(--text-faint)">
                        {{ palier.used > 100
                            ? 'Le palier est dépassé : la formule supérieure est à négocier.'
                            : 'Le dépassement n\'arrête rien : il appelle une renégociation, pas un blocage.' }}
                    </p>
                </div>
            </template>

            <div v-else class="flex flex-col gap-3.5 mb-5">
                <div>
                    <label class="field-label" for="plan">Formule</label>
                    <select id="plan" v-model="planDraft" class="select">
                        <option value="" disabled>Choisir…</option>
                        <option v-for="plan in plans" :key="plan.plan" :value="plan.plan">
                            {{ plan.label }} — {{ fm(plan.price) }} FCFA / an
                        </option>
                    </select>
                    <!-- L'effectif propose un palier, il ne corrige pas un contrat : Enterprise se
                         négocie sur devis, et une école peut obtenir un tarif consenti. -->
                    <p class="text-[12px] mt-1" style="color: var(--text-faint)">
                        {{ statOf(opened.id).studentCount }} élève(s) inscrits. Le palier se propose
                        d'après l'effectif ; la formule retenue prime.
                    </p>
                </div>
                <div>
                    <label class="field-label" for="subscribedAt">Date de souscription</label>
                    <input
                        id="subscribedAt" v-model="subscribedAtDraft" type="date" class="input"
                        :disabled="openedInvoices.length > 0"
                    />
                    <p class="text-[12px] mt-1" style="color: var(--text-faint)">
                        Elle ancre les périodes de facturation, de douze mois. Elle ne change plus
                        dès qu'une facture s'appuie dessus.
                    </p>
                </div>
                <button
                    class="btn-primary self-start" :disabled="savingPlan || !planDraft" @click="savePlan"
                >
                    <BoIcon name="check" :size="16" />
                    {{ savingPlan ? 'Enregistrement…' : "Enregistrer l'abonnement" }}
                </button>
            </div>

            <!-- Identité de l'école : éditée à part de l'abonnement, elle n'exige aucune formule et
                 possède son propre enregistrement. -->
            <template v-if="editing">
                <p class="sec">Modifier l'école</p>
                <div class="flex flex-col gap-3.5 mb-5">
                    <div>
                        <label class="field-label" for="schoolName">Nom</label>
                        <input
                            id="schoolName" v-model="nameDraft" type="text" class="input"
                            placeholder="Groupe Scolaire…"
                        />
                    </div>
                    <div>
                        <label class="field-label" for="schoolShortName">Nom court</label>
                        <input
                            id="schoolShortName" v-model="shortNameDraft" type="text" class="input"
                            placeholder="Sigle affiché dans les listes"
                        />
                    </div>
                    <div>
                        <label class="field-label" for="schoolAccreditation">Numéro d'agrément</label>
                        <input
                            id="schoolAccreditation" v-model="accreditationDraft" type="text" class="input"
                            placeholder="Agrément du ministère"
                        />
                    </div>
                    <div>
                        <label class="field-label" for="schoolCity">Ville</label>
                        <CitySelect id="schoolCity" v-model="cityDraft" />
                        <p class="text-[12px] mt-1" style="color: var(--text-faint)">
                            Elle situe l'école dans les listes, et reste distincte de l'adresse postale.
                        </p>
                    </div>
                    <div>
                        <label class="field-label" for="schoolPhone">Téléphone</label>
                        <input
                            id="schoolPhone" v-model="phoneDraft" type="tel" class="input"
                            placeholder="+225…"
                        />
                    </div>
                    <div>
                        <label class="field-label" for="schoolEmail">Email de contact</label>
                        <input
                            id="schoolEmail" v-model="emailDraft" type="email" class="input"
                            placeholder="contact@ecole.ci"
                        />
                    </div>
                    <div>
                        <label class="field-label" for="schoolWebSite">Site web (facultatif)</label>
                        <input
                            id="schoolWebSite" v-model="webSiteDraft" type="url" class="input"
                            placeholder="https://…"
                        />
                    </div>
                    <button
                        class="btn-primary self-start" :disabled="savingSchool" @click="saveSchool"
                    >
                        <BoIcon name="check" :size="16" />
                        {{ savingSchool ? 'Enregistrement…' : 'Enregistrer les informations' }}
                    </button>
                </div>
            </template>

            <p class="sec">Scolarités encaissées via Nelima</p>
            <div class="grid-12 mb-3">
                <KpiCard
                    class="c6" :label="`Encaissé (${shortMonth})`" icon="cash"
                    :value="fmc(statOf(opened.id).collectedThisMonth).value"
                    :unit="fmc(statOf(opened.id).collectedThisMonth).unit"
                    :delta="collectedTrend"
                    :foot="`sur ${fm(statOf(opened.id).expectedThisMonth)} attendus`"
                />
                <KpiCard
                    class="c6" label="Recouvrement" icon="percent"
                    :value="recoveryOf(opened.id) !== null
                        ? recoveryOf(opened.id)!.toFixed(0) : '—'"
                    :unit="recoveryOf(opened.id) !== null ? '%' : undefined"
                    :foot="recoveryOf(opened.id) === null ? 'aucune échéance ce mois'
                        : recoveryOf(opened.id)! < 70 ? 'sous le seuil d\'alerte'
                            : 'au-dessus du seuil'"
                >
                    <template #chart>
                        <StatDonut
                            :size="56" :stroke="7" :percent="recoveryOf(opened.id) ?? 0"
                            :label="recoveryOf(opened.id) === null ? '—' : undefined"
                            :tone="recoveryOf(opened.id) === null ? 'var(--border-strong)'
                                : recoveryOf(opened.id)! < 70
                                    ? 'var(--warning-solid)' : 'var(--success-solid)'"
                        />
                    </template>
                </KpiCard>
            </div>
            <dl class="kv mb-5">
                <dt>Commission Nelima</dt>
                <dd class="nu">{{ fm(statOf(opened.id).commissionThisMonth) }} FCFA</dd>
                <dt>Impayés des familles</dt>
                <dd class="nu">
                    {{ fm(statOf(opened.id).overdueAmount) }} FCFA
                    ({{ statOf(opened.id).overdueCount }})
                </dd>
            </dl>

            <p class="sec">Contact</p>
            <dl class="kv mb-5">
                <dt>Direction</dt>
                <dd>
                    {{ principal ?? '—' }}
                    <button
                        v-if="openedDetail?.principal?.id"
                        type="button" class="btn-ghost btn-sm ml-2"
                        :disabled="resending" @click="resendActivation"
                    >
                        {{ resending ? 'Envoi…' : 'Renvoyer le lien' }}
                    </button>
                    <span
                        v-if="resendMessage"
                        class="block mt-1 text-xs" style="color: var(--text-faint)"
                    >{{ resendMessage }}</span>
                </dd>
                <dt>Téléphone</dt>
                <dd>
                    <a v-if="contactPhone" :href="`tel:${contactPhone}`">{{ contactPhone }}</a>
                    <span v-else style="color: var(--text-faint)">—</span>
                </dd>
                <dt>Email</dt>
                <dd>
                    <a v-if="contactEmail" :href="`mailto:${contactEmail}`">{{ contactEmail }}</a>
                    <span v-else style="color: var(--text-faint)">—</span>
                </dd>
                <dt>Ville</dt>
                <dd>{{ openedDetail?.city ?? opened.city ?? '—' }}</dd>
                <dt>Sites ouverts</dt>
                <dd class="nu">{{ sites(opened) }}</dd>
                <dt>Site web</dt>
                <dd>
                    <a v-if="opened.webSite" :href="opened.webSite" target="_blank" rel="noreferrer">
                        {{ opened.webSite }}
                    </a>
                    <span v-else style="color: var(--text-faint)">—</span>
                </dd>
            </dl>

            <p class="sec">Dernières factures</p>
            <EmptyState
                v-if="!openedInvoices.length"
                title="Aucune facture"
                text="Renseignez la formule : la période ouverte apparaîtra ensuite dans Facturation."
            />
            <div v-else class="lst">
                <div v-for="invoice in openedInvoices.slice(0, 5)" :key="invoice.number"
                     class="flex items-center gap-2.5">
                    <div class="nm flex-1 min-w-0">
                        <b>{{ invoice.number }}</b>
                        <span>période du {{ day(invoice.periodStart) }}</span>
                    </div>
                    <b class="nu text-[12.5px]" style="color: var(--navy)">
                        {{ fm(invoice.amount) }} F
                    </b>
                    <UiPill :tone="invoiceStatusTone(invoice.status as InvoiceStatus)">
                        {{ invoiceStatusLabel(invoice.status as InvoiceStatus) }}
                    </UiPill>
                </div>
            </div>

            <template #footer>
                <template v-if="editing">
                    <!-- Chaque section a son propre enregistrement (abonnement, informations) : le
                         pied ne fait que sortir du mode édition. -->
                    <button class="btn-secondary" :disabled="savingPlan || savingSchool" @click="cancelEdit">
                        Fermer l'édition
                    </button>
                </template>
                <template v-else>
                    <button class="btn-primary" @click="editing = true">
                        <BoIcon name="edit" :size="16" />Modifier l'école
                    </button>
                    <a
                        v-if="contactEmail" :href="`mailto:${contactEmail}`" class="btn-secondary"
                    ><BoIcon name="mail" :size="16" />Contacter</a>
                </template>
            </template>
        </SideDrawer>
    </div>
</template>

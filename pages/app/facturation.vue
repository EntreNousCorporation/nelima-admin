<script setup lang="ts">
import {
    INVOICE_STATUSES, PLAN_TONES, invoiceStatusLabel, invoiceStatusTone,
    type InvoiceStatus, type Plan, type SubscriptionDue, type SubscriptionInvoice,
} from '~/composables/useSubscriptions';
import { fm, fmc } from '~/composables/useMoney';

/**
 * Facturation des abonnements.
 *
 * C'est le seul endroit où YPYit voit ce que ses écoles lui doivent. Avant cet écran, l'abonnement
 * se facturait hors outil — donc de mémoire.
 *
 * **Rien ne s'émet tout seul.** L'écran dit quelles périodes sont ouvertes ; c'est un humain qui
 * émet. Une facture qu'un automate produit sans que personne ne la regarde est une dette que
 * personne n'a vérifiée.
 */
const subscriptions = useSubscriptions();

const invoices = ref<SubscriptionInvoice[]>([]);
const due = ref<SubscriptionDue[]>([]);
const plans = ref<Plan[]>([]);
const loading = ref(true);
const error = ref('');
const notice = ref('');

const statusFilter = ref<InvoiceStatus | ''>('');

const filtered = computed(() => invoices.value
    .filter((invoice) => !statusFilter.value || invoice.status === statusFilter.value));

const year = new Date().getFullYear();

/** Facturé sur l'année civile, annulations exclues : une facture annulée n'est pas un revenu. */
const billed = computed(() => invoices.value
    .filter((i) => i.status !== 'CANCELLED' && new Date(i.periodStart).getFullYear() === year)
    .reduce((total, i) => total + Number(i.amount ?? 0), 0));

const collected = computed(() => invoices.value
    .filter((i) => i.status === 'PAID' && new Date(i.periodStart).getFullYear() === year)
    .reduce((total, i) => total + Number(i.amount ?? 0), 0));

const outstanding = computed(() => billed.value - collected.value);

const lateCount = computed(() => invoices.value.filter((i) => i.status === 'LATE').length);

/** Factures émises et non réglées, en retard ou non : ce sont les écoles à relancer. */
const unpaidCount = computed(() => invoices.value
    .filter((i) => i.status === 'ISSUED' || i.status === 'LATE').length);

const studentCount = ref(0);

/**
 * Revenu d'abonnement par élève géré.
 *
 * <p>Annuel, comme les abonnements : la maquette le donne au mois parce qu'elle suppose une
 * facturation mensuelle. Il dit ce que rapporte un élève sous licence, et se compare d'une année
 * sur l'autre — pas d'une école à l'autre, les paliers n'étant pas linéaires.
 */
const revenuePerStudent = computed(() =>
    (studentCount.value ? billed.value / studentCount.value : 0));

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const api = useApi();
        const [rows, dueRows, grid, summary] = await Promise.all([
            subscriptions.invoices(),
            subscriptions.due(),
            subscriptions.plans(true),
            // L'effectif du parc n'est qu'un dénominateur : son absence ne doit rien empêcher.
            api<{ studentCount: number }>('/dashboard/summary').catch(() => ({ studentCount: 0 })),
        ]);
        invoices.value = rows;
        due.value = dueRows;
        plans.value = grid;
        studentCount.value = Number(summary.studentCount ?? 0);
    } catch {
        error.value = "La facturation n'a pas pu être chargée.";
    } finally {
        loading.value = false;
    }
}

/* ---- Émission ---- */
const issuing = ref('');

async function issue(row: SubscriptionDue) {
    issuing.value = row.establishmentId;
    error.value = '';
    try {
        const invoice = await subscriptions.issue(row.establishmentId);
        notice.value = `Facture ${invoice.number} émise pour ${row.establishmentName}.`;
        await load();
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "La facture n'a pas pu être émise.";
    } finally {
        issuing.value = '';
    }
}

/* ---- Règlement ---- */
const paying = ref<SubscriptionInvoice | null>(null);
const payment = reactive({ paidOn: '', method: 'Virement', reference: '' });
const savingPayment = ref(false);

function openPayment(invoice: SubscriptionInvoice) {
    paying.value = invoice;
    Object.assign(payment, {
        paidOn: new Date().toISOString().slice(0, 10),
        method: 'Virement',
        reference: '',
    });
}

async function submitPayment() {
    if (!paying.value) return;
    savingPayment.value = true;
    error.value = '';
    try {
        const invoice = await subscriptions.recordPayment(paying.value.id, {
            paidOn: payment.paidOn || undefined,
            method: payment.method || undefined,
            reference: payment.reference || undefined,
        });
        notice.value = `Règlement de ${invoice.number} constaté.`;
        paying.value = null;
        await load();
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "Le règlement n'a pas pu être constaté.";
    } finally {
        savingPayment.value = false;
    }
}

/* ---- Annulation ---- */
const cancelling = ref<SubscriptionInvoice | null>(null);
const cancelReason = ref('');
const savingCancellation = ref(false);

function openCancellation(invoice: SubscriptionInvoice) {
    cancelling.value = invoice;
    cancelReason.value = '';
}

/**
 * Annulation d'une facture émise par erreur.
 *
 * <p>La facture reste, avec son numéro et son motif : la suite doit rester continue, et un trou
 * dans la numérotation serait impossible à justifier. La période redevient facturable, donc une
 * nouvelle facture peut être émise — sous un nouveau numéro.
 */
async function submitCancellation() {
    if (!cancelling.value || !cancelReason.value.trim()) return;
    savingCancellation.value = true;
    error.value = '';
    try {
        const invoice = await subscriptions.cancel(cancelling.value.id, cancelReason.value.trim());
        notice.value = `Facture ${invoice.number} annulée. La période redevient facturable.`;
        cancelling.value = null;
        await load();
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "La facture n'a pas pu être annulée.";
    } finally {
        savingCancellation.value = false;
    }
}

/* ---- Formules ---- */

/**
 * Édition d'une formule, en tiroir.
 *
 * <p>Le tarif seul se réglait sur place ; le libellé et le palier appellent un formulaire. Les
 * mettre tous les trois au même endroit évite d'avoir deux façons de modifier la même ligne.
 */
const editingPlan = ref<Plan | null>(null);
const planIsNew = ref(false);
const planForm = reactive({
    label: '', description: '', maxStudents: '', price: '',
    active: true, isPublic: false, featured: false,
});
const savingPlan = ref(false);

function openPlan(plan: Plan | null) {
    planIsNew.value = plan === null;
    editingPlan.value = plan;
    Object.assign(planForm, {
        label: plan?.label ?? '',
        description: plan?.description ?? '',
        maxStudents: plan?.maxStudents ? String(plan.maxStudents) : '',
        price: plan ? String(Math.round(plan.price)) : '',
        active: plan ? plan.active : true,
        isPublic: plan ? plan.isPublic : false,
        featured: plan ? plan.featured : false,
    });
}

/**
 * Lecture d'un nombre saisi.
 *
 * <p>Rend {@code NaN} sur une saisie vide, là où {@code Number('')} rend zéro. Cette subtilité a
 * déjà coûté cher : un champ tarif laissé vide enregistrait une formule à 0 FCFA sans que rien ne
 * le signale, et ce zéro serait parti sur le site public.
 */
function numberOf(value: string) {
    const text = String(value ?? '').replace(/\s/g, '').replace(',', '.').trim();
    return text ? Number(text) : Number.NaN;
}

const planComplete = computed(() =>
    Boolean(planForm.label.trim()) && Number.isFinite(numberOf(planForm.price)));

async function savePlan() {
    const price = numberOf(planForm.price);
    // Zéro est un tarif — une formule gratuite. C'est le champ *vide* qui n'en est pas un, et
    // `numberOf` le rend `NaN` pour cette raison.
    if (!planComplete.value || price < 0) {
        error.value = 'Un libellé et un tarif sont nécessaires. Zéro est accepté : la formule '
            + 'sera annoncée gratuite.';
        return;
    }
    // Un plafond vide vaut « sans plafond » : c'est le palier de tête, pas une saisie oubliée.
    const cap = planForm.maxStudents.trim() ? Math.round(numberOf(planForm.maxStudents)) : null;
    if (cap !== null && (!Number.isFinite(cap) || cap <= 0)) {
        error.value = "Le plafond d'effectif doit être un entier positif, ou rester vide.";
        return;
    }

    savingPlan.value = true;
    error.value = '';
    try {
        const body = {
            label: planForm.label.trim(),
            description: planForm.description.trim() || undefined,
            maxStudents: cap,
            price,
            active: planForm.active,
            isPublic: planForm.isPublic,
            // Retirée du site, elle ne peut pas y être mise en avant.
            featured: planForm.isPublic && planForm.featured,
        };
        if (planIsNew.value) {
            const created = await subscriptions.createPlan(body);
            notice.value = `Formule ${created.label} créée. Elle est souscriptible immédiatement.`;
        } else {
            await subscriptions.updatePlan(editingPlan.value!.id, body);
            // Sans effet sur les factures déjà émises : elles ont figé formule et montant.
            notice.value = `Formule ${body.label} enregistrée.`;
        }
        editingPlan.value = null;
        planIsNew.value = false;
        await load();
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "La formule n'a pas pu être enregistrée.";
    } finally {
        savingPlan.value = false;
    }
}

/**
 * Suppression d'une formule.
 *
 * <p>Le serveur la refuse dès qu'une école ou une facture s'y réfère, et dit pourquoi. L'écran ne
 * réplique pas la règle : deux versions du même contrôle finissent par diverger.
 */
async function removePlan(plan: Plan) {
    savingPlan.value = true;
    error.value = '';
    try {
        await subscriptions.deletePlan(plan.id);
        notice.value = `Formule ${plan.label} supprimée.`;
        editingPlan.value = null;
        await load();
    } catch (e: any) {
        error.value = e?.data?.debugMessage ?? "La formule n'a pas pu être supprimée.";
    } finally {
        savingPlan.value = false;
    }
}

/** Ce que chaque palier a déjà rapporté cette année : le tarif seul ne dit pas son poids. */
function billedOf(plan: string) {
    const rows = invoices.value.filter((invoice) => invoice.plan === plan
        && invoice.status !== 'CANCELLED'
        && new Date(invoice.periodStart).getFullYear() === year);
    return {
        count: rows.length,
        amount: rows.reduce((total, invoice) => total + Number(invoice.amount ?? 0), 0),
    };
}

/** La fiche école est unique : la facturation y renvoie plutôt que d'ouvrir son propre tiroir. */
function openSchool(establishmentId: string) {
    return navigateTo(`/app/etablissements?ecole=${establishmentId}`);
}

function day(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR');
}

onMounted(load);
</script>

<template>
    <div>
        <PageHead
            title="Facturation Nelima"
            :sub="`Abonnements ${year} · ${invoices.length} facture(s) émise(s)`"
        />

        <p v-if="error" class="alert-danger mb-3.5" role="alert">{{ error }}</p>
        <p v-if="notice" class="alert-success mb-3.5" role="status" @click="notice = ''">
            {{ notice }}
        </p>

        <div class="grid-12 mb-3.5">
            <KpiCard
                class="c3" label="Facturé sur l'année" icon="receipt"
                :value="fmc(billed).value" :unit="fmc(billed).unit"
                :foot="`${invoices.filter((i) => i.status !== 'CANCELLED').length} facture(s)`"
                tip="Abonnements émis pour l'année civile en cours, annulations exclues. Une facture annulée n'est pas un revenu."
            />
            <KpiCard
                class="c3" label="Encaissé" icon="cash"
                :value="fmc(collected).value" :unit="fmc(collected).unit"
                :foot="billed ? `${Math.round(collected / billed * 100)} % du facturé` : 'rien de facturé'"
                tip="Abonnements dont le règlement a été constaté, tous moyens confondus."
            />
            <KpiCard
                class="c3" label="Restant dû" icon="alert"
                :value="fmc(outstanding).value" :unit="fmc(outstanding).unit"
                :value-tone="lateCount ? 'var(--danger)' : undefined"
                :foot="`${unpaidCount} école(s) à relancer`"
                tip="Factures non réglées. Aucune suspension automatique : couper une école couperait le paiement en ligne de ses familles, qui n'y sont pour rien."
            />
            <KpiCard
                class="c3" label="Revenu par élève" icon="students"
                :value="fm(Math.round(revenuePerStudent))" unit="FCFA"
                foot="moyenne annuelle du parc"
                tip="Abonnements facturés divisés par le nombre d'élèves gérés. Il ne se compare pas d'une école à l'autre : les paliers ne sont pas linéaires."
            />
        </div>

        <div class="grid-12">
            <!-- ============ Factures ============ -->
            <UiCard
                class="c8" :pad="false"
                title="Factures d'abonnement"
                :sub="`Année civile ${year}`"
                tip="Une facture par école et par période de douze mois. La formule et le montant sont figés à l'émission : renégocier un tarif ne réécrit pas les factures déjà émises."
            >
                <div class="tbar">
                    <button class="chip" :aria-pressed="!statusFilter" @click="statusFilter = ''">
                        Toutes
                    </button>
                    <button
                        v-for="status in INVOICE_STATUSES" :key="status.value" class="chip"
                        :aria-pressed="statusFilter === status.value"
                        @click="statusFilter = status.value"
                    >{{ status.label }}</button>
                </div>

                <div class="table-wrap" style="border: 0; box-shadow: none; border-radius: 0">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Référence</th>
                                <th>École</th>
                                <th>Période</th>
                                <th>Moyen</th>
                                <th class="r">Montant</th>
                                <th>Statut</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <TableSkeleton v-if="loading" :columns="7" />
                            <tr
                                v-for="invoice in filtered" v-else :key="invoice.id" class="cl"
                                @click="openSchool(invoice.establishmentId)"
                            >
                                <td>
                                    <b class="nu text-[12.5px]" style="color: var(--navy)">
                                        {{ invoice.number }}
                                    </b>
                                    <div class="nu text-[11px]" style="color: var(--text-faint)">
                                        émise le {{ day(invoice.issuedAt) }}
                                    </div>
                                </td>
                                <td>
                                    <div class="flex items-center gap-2.5">
                                        <AvatarBadge :name="invoice.establishmentName" :size="28" />
                                        <div class="nm min-w-0">
                                            <b>{{ invoice.establishmentName }}</b>
                                            <span :style="{ color: PLAN_TONES[invoice.plan] }">
                                                {{ invoice.planLabel }}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td class="nu text-[12px]" style="color: var(--text-muted)">
                                    {{ day(invoice.periodStart) }} → {{ day(invoice.periodEnd) }}
                                </td>
                                <td class="text-[12.5px]" style="color: var(--text-muted)">
                                    {{ invoice.paymentMethod ?? '—' }}
                                </td>
                                <td class="num">{{ fm(invoice.amount) }} F</td>
                                <td>
                                    <UiPill :tone="invoiceStatusTone(invoice.status)">
                                        {{ invoiceStatusLabel(invoice.status) }}
                                    </UiPill>
                                    <div
                                        v-if="invoice.status === 'LATE'" class="text-[11px] mt-1"
                                        style="color: var(--danger)"
                                    >échue le {{ day(invoice.dueAt) }}</div>
                                    <div
                                        v-else-if="invoice.status === 'PAID'" class="text-[11px] mt-1"
                                        style="color: var(--text-faint)"
                                    >le {{ day(invoice.paidAt) }}</div>
                                </td>
                                <td class="text-right whitespace-nowrap">
                                    <template v-if="invoice.status === 'ISSUED' || invoice.status === 'LATE'">
                                        <button
                                            class="btn-secondary btn-sm"
                                            @click.stop="openPayment(invoice)"
                                        ><BoIcon name="check" :size="15" />Régler</button>
                                        <button
                                            class="btn-ghost btn-sm ml-1.5" title="Annuler la facture"
                                            @click.stop="openCancellation(invoice)"
                                        ><BoIcon name="ban" :size="15" /></button>
                                    </template>
                                    <span
                                        v-else-if="invoice.cancelled" class="text-[11.5px]"
                                        style="color: var(--text-faint)"
                                    >{{ invoice.cancellationReason }}</span>
                                    <BoIcon
                                        v-else name="chevron-right" :size="16"
                                        style="color: var(--text-faint)"
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <EmptyState
                    v-if="!loading && !filtered.length && statusFilter"
                    title="Aucune facture"
                    text="Aucune facture ne correspond à ce filtre."
                />
                <EmptyState
                    v-else-if="!loading && !filtered.length"
                    title="Aucune facture émise"
                    text="Les périodes ouvertes apparaissent à droite : c'est de là que part l'émission."
                />

                <template #footer>
                    <span class="text-[12px]" style="color: var(--text-faint)">
                        <b class="nu" style="color: var(--navy)">{{ filtered.length }}</b>
                        facture(s) affichée(s)
                    </span>
                    <span class="text-[12px]" style="color: var(--text-faint)">
                        Une facture annulée est conservée : la suite doit rester continue
                    </span>
                </template>
            </UiCard>

            <div class="c4 flex flex-col gap-3.5 min-w-0">
                <!-- ============ À facturer ============ -->
                <UiCard
                    :pad="false"
                    title="Écoles à facturer"
                    :sub="due.length
                        ? `${due.length} période(s) commencée(s), encore sans facture`
                        : 'Périodes de douze mois commencées, encore sans facture'"
                >
                    <EmptyState
                        v-if="!loading && !due.length"
                        title="Rien à facturer"
                        text="Toutes les périodes ouvertes ont leur facture."
                    />
                    <template v-else>
                    <SettingRow
                        v-for="row in due" :key="row.establishmentId"
                        :label="row.establishmentName"
                        :desc="`${row.planLabel} · ${fm(row.amount)} F · période du ${day(row.periodStart)}`"
                        :tip="row.suggestedPlan
                            ? `L'effectif de ${row.studentCount} élève(s) appellerait la formule ${row.suggestedPlan}. La formule souscrite prime : elle peut avoir été négociée.`
                            : undefined"
                    >
                        <template #icon>
                            <AvatarBadge :name="row.establishmentName" :size="34" />
                        </template>
                        <button
                            class="btn-primary btn-sm" :disabled="issuing === row.establishmentId"
                            @click="issue(row)"
                        >
                            <BoIcon name="plus" :size="15" />
                            {{ issuing === row.establishmentId ? 'Émission…' : 'Émettre' }}
                        </button>
                    </SettingRow>
                </template>
                </UiCard>

                <!-- ============ Formules ============ -->
                <UiCard
                    :pad="false"
                    title="Formules"
                    sub="Tarif annuel par palier d'effectif"
                    tip="La grille vit en base : créer une formule, la renommer ou en renégocier le tarif ne demande pas de livraison. Les factures déjà émises gardent la leur."
                >
                    <template #action>
                        <button class="btn-secondary btn-sm" @click="openPlan(null)">
                            <BoIcon name="plus" :size="15" />Nouvelle formule
                        </button>
                    </template>

                    <SettingRow
                        v-for="plan in plans" :key="plan.plan" icon="layers"
                        :label="`${plan.label} — ${Number(plan.price) === 0
                            ? 'gratuite' : `${fm(plan.price)} FCFA / an`}`"
                        :desc="`${plan.maxStudents ? `jusqu'à ${fm(plan.maxStudents)} élèves`
                            : 'sans plafond · sur devis'} · ${plan.establishmentCount} école(s) · ${fm(billedOf(plan.plan).amount)} F facturés`"
                    >
                        <UiPill v-if="!plan.active" tone="mute">Retirée</UiPill>
                        <UiPill v-else-if="plan.featured" tone="ok">En avant</UiPill>
                        <UiPill v-else-if="plan.isPublic" tone="info">Publiée</UiPill>
                        <button
                            class="btn-ghost btn-sm" :title="`Modifier ${plan.label}`"
                            @click="openPlan(plan)"
                        ><BoIcon name="edit" :size="15" /></button>
                    </SettingRow>

                    <template #footer>
                        <span class="text-[12px]" style="color: var(--text-faint)">
                            Sans effet sur les factures déjà émises
                        </span>
                    </template>
                </UiCard>
            </div>
        </div>

        <!-- ============ Formule ============ -->
        <SideDrawer
            v-if="editingPlan || planIsNew"
            :title="planIsNew ? 'Nouvelle formule' : editingPlan!.label"
            :sub="planIsNew ? 'Souscriptible dès son enregistrement'
                : `Code ${editingPlan!.plan} · ${editingPlan!.establishmentCount} école(s) · ${editingPlan!.invoiceCount} facture(s)`"
            @close="editingPlan = null; planIsNew = false"
        >
            <template #avatar>
                <div
                    class="w-10 h-10 rounded-xl grid place-items-center shrink-0"
                    style="background: var(--brand-50); color: var(--brand-600)"
                >
                    <BoIcon name="layers" :size="20" />
                </div>
            </template>

            <div class="flex flex-col gap-3.5">
                <div>
                    <label class="field-label" for="planLabel">Libellé</label>
                    <input
                        id="planLabel" v-model="planForm.label" type="text" class="input"
                        placeholder="Offre de lancement…"
                    />
                    <p v-if="!planIsNew" class="text-[12px] mt-1" style="color: var(--text-faint)">
                        Le code <b class="nu">{{ editingPlan!.plan }}</b> ne change pas : il est
                        recopié sur les contrats et les factures. Renommer n'y touche pas, et les
                        factures déjà émises gardent l'ancien libellé.
                    </p>
                </div>
                <div>
                    <label class="field-label" for="planDesc">Description</label>
                    <input
                        id="planDesc" v-model="planForm.description" type="text" class="input"
                        placeholder="Jusqu'à 100 élèves"
                    />
                </div>
                <div>
                    <label class="field-label" for="planCap">Plafond d'effectif</label>
                    <input
                        id="planCap" v-model="planForm.maxStudents" type="text" inputmode="numeric"
                        class="input" placeholder="laisser vide pour « sans plafond »"
                    />
                    <p class="text-[12px] mt-1" style="color: var(--text-faint)">
                        Il sert à <b>proposer</b> une formule d'après l'effectif. Il n'interdit
                        rien : une école qui le dépasse reste facturée à sa formule souscrite.
                    </p>
                </div>
                <div>
                    <label class="field-label" for="planPrice">Tarif annuel (FCFA)</label>
                    <input
                        id="planPrice" v-model="planForm.price" type="text" inputmode="numeric"
                        class="input nu text-right"
                    />
                    <p class="text-[12px] mt-1" style="color: var(--text-faint)">
                        {{ numberOf(planForm.price) === 0
                            ? 'À zéro, la formule est annoncée « Gratuit » sur le site.'
                            : 'Laisser le champ vide n\'est pas accepté : un tarif se décide.' }}
                    </p>
                </div>
                <SettingRow
                    label="Proposée aux nouvelles souscriptions"
                    desc="Une formule retirée disparaît du choix, mais reste lisible sur les contrats en cours."
                >
                    <UiSwitch v-model="planForm.active" />
                </SettingRow>
                <SettingRow
                    label="Afficher sur nelima.ci"
                    desc="Une offre négociée ou un tarif réservé aux pilotes n'a rien à faire sur une page publique."
                >
                    <UiSwitch v-model="planForm.isPublic" />
                </SettingRow>
                <SettingRow
                    label="Mettre en avant sur le site"
                    desc="La carte est agrandie et porte la mention « le plus courant ». Une seule formule à la fois : en désigner une retire la mise en avant de l'autre."
                >
                    <UiSwitch v-model="planForm.featured" :disabled="!planForm.isPublic" />
                </SettingRow>
            </div>

            <template #footer>
                <button
                    class="btn-primary" :disabled="savingPlan || !planComplete" @click="savePlan"
                >
                    <BoIcon name="check" :size="16" />
                    {{ savingPlan ? 'Enregistrement…' : 'Enregistrer' }}
                </button>
                <button
                    v-if="!planIsNew && !editingPlan!.establishmentCount && !editingPlan!.invoiceCount"
                    class="btn-secondary" :disabled="savingPlan" @click="removePlan(editingPlan!)"
                ><BoIcon name="ban" :size="16" />Supprimer</button>
            </template>
        </SideDrawer>

        <!-- ============ Annulation ============ -->
        <SideDrawer
            v-if="cancelling" :title="`Annuler ${cancelling.number}`"
            :sub="`${cancelling.establishmentName} · ${fm(cancelling.amount)} FCFA`"
            @close="cancelling = null"
        >
            <template #avatar>
                <div
                    class="w-10 h-10 rounded-xl grid place-items-center shrink-0"
                    style="background: var(--danger-soft); color: var(--danger)"
                >
                    <BoIcon name="ban" :size="20" />
                </div>
            </template>

            <p class="text-[12.5px] mb-4 leading-relaxed" style="color: var(--text-muted)">
                La facture n'est pas supprimée : son numéro reste pris, et le motif lui reste
                attaché. C'est ce qui garde la numérotation continue, donc justifiable. La période
                redevient facturable, sous un nouveau numéro.
            </p>

            <div>
                <label class="field-label" for="reason">Motif</label>
                <textarea
                    id="reason" v-model="cancelReason" class="input" rows="3"
                    placeholder="Émise en double, formule erronée…"
                />
                <p class="text-[12px] mt-1" style="color: var(--text-faint)">
                    Il figurera sur la ligne annulée. Un motif vague ne dira rien dans six mois.
                </p>
            </div>

            <template #footer>
                <button
                    class="btn-danger" :disabled="savingCancellation || !cancelReason.trim()"
                    @click="submitCancellation"
                >
                    <BoIcon name="ban" :size="16" />
                    {{ savingCancellation ? 'Annulation…' : "Annuler la facture" }}
                </button>
                <button class="btn-secondary" @click="cancelling = null">Fermer</button>
            </template>
        </SideDrawer>

        <!-- ============ Constat de règlement ============ -->
        <SideDrawer
            v-if="paying" :title="`Régler ${paying.number}`"
            :sub="`${paying.establishmentName} · ${fm(paying.amount)} FCFA`"
            @close="paying = null"
        >
            <template #avatar>
                <div
                    class="w-10 h-10 rounded-xl grid place-items-center shrink-0"
                    style="background: var(--brand-50); color: var(--brand-600)"
                >
                    <BoIcon name="cash" :size="20" />
                </div>
            </template>

            <p class="text-[12.5px] mb-4 leading-relaxed" style="color: var(--text-muted)">
                Le règlement se constate ici : Nelima n'encaisse pas ses propres abonnements. Le
                virement, l'espèce ou le paiement mobile a lieu hors plateforme, et la console en
                garde la trace.
            </p>

            <div class="flex flex-col gap-3.5">
                <div>
                    <label class="field-label" for="paidOn">Date du règlement</label>
                    <input id="paidOn" v-model="payment.paidOn" type="date" class="input" />
                </div>
                <div>
                    <label class="field-label" for="method">Moyen</label>
                    <select id="method" v-model="payment.method" class="select">
                        <option>Virement</option>
                        <option>Espèces</option>
                        <option>Chèque</option>
                        <option>Mobile money</option>
                    </select>
                </div>
                <div>
                    <label class="field-label" for="reference">Référence</label>
                    <input
                        id="reference" v-model="payment.reference" type="text" class="input"
                        placeholder="Numéro de virement, de chèque…"
                    />
                </div>
            </div>

            <template #footer>
                <button class="btn-primary" :disabled="savingPayment" @click="submitPayment">
                    <BoIcon name="check" :size="16" />
                    {{ savingPayment ? 'Enregistrement…' : 'Constater le règlement' }}
                </button>
                <button class="btn-secondary" @click="paying = null">Annuler</button>
            </template>
        </SideDrawer>
    </div>
</template>

<script setup lang="ts">
/**
 * Choix d'une ville, au référentiel, avec recherche.
 *
 * <p>La ville était saisie librement : trois orthographes pour deux villes, et une liste de parc où
 * la même commune apparaissait deux fois. Elle se choisit maintenant, et rien d'autre ne s'écrit —
 * ce que le serveur revérifie de son côté, la contrainte d'un écran n'engageant que cet écran.
 *
 * <p>Le champ de saisie ne porte pas la valeur : il porte la <em>recherche</em>. Ce sont deux
 * choses différentes, et les confondre laisserait passer à l'aveugle une ville à moitié tapée. Ce
 * qui est retenu réapparaît donc dans le champ dès qu'on le quitte, choisi ou non.
 *
 * <p>Une ville absente de la liste — les saisies reprises à la mise en place du référentiel — reste
 * affichée telle quelle tant qu'on n'y touche pas : une école ne déménage pas parce qu'on a corrigé
 * son téléphone.
 */
const props = withDefaults(defineProps<{
    modelValue?: string | null;
    id?: string;
    required?: boolean;
    placeholder?: string;
}>(), {
    modelValue: '',
    id: 'city',
    required: false,
    placeholder: 'Rechercher une ville…',
});

const emit = defineEmits<{ 'update:modelValue': [string] }>();

const { cities, load } = useCities();

const open = ref(false);
const query = ref('');
const active = ref(-1);
const root = ref<HTMLElement | null>(null);

onMounted(load);

/** Le champ montre la ville retenue tant qu'on ne cherche pas. */
watch(() => props.modelValue, (value) => {
    if (!open.value) query.value = value ?? '';
}, { immediate: true });

/**
 * Comparaison insensible à la casse et aux accents.
 *
 * <p>Sans quoi « korhogo » ne trouve pas Korhogo, et « seguela » ne trouve pas Séguéla — ce que
 * personne ne tape avec ses accents.
 */
function fold(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const matches = computed(() => {
    const needle = fold(query.value.trim());
    // Champ vide, ou champ affichant simplement ce qui est déjà retenu : on montre tout, plutôt
    // qu'une liste d'un seul élément qui empêcherait d'en choisir un autre sans tout effacer.
    if (!needle || query.value === props.modelValue) return cities.value;
    return cities.value.filter((city) => fold(city.label).includes(needle)
        || fold(city.region ?? '').includes(needle));
});

/** Regroupées par région : cent entrées à plat ne se parcourent pas. */
const groups = computed(() => {
    const byRegion = new Map<string, string[]>();
    for (const city of matches.value) {
        const region = city.region || 'Autres';
        const labels = byRegion.get(region) ?? [];
        labels.push(city.label);
        byRegion.set(region, labels);
    }
    return [...byRegion.entries()].map(([region, labels]) => ({ region, labels }));
});

/** Index à plat, dans l'ordre affiché : c'est ce que parcourent les flèches. */
const flat = computed(() => groups.value.flatMap((group) => group.labels));

function indexOf(label: string) {
    return flat.value.indexOf(label);
}

function openList() {
    if (open.value) return;
    open.value = true;
    active.value = props.modelValue ? indexOf(props.modelValue) : -1;
}

function pick(label: string) {
    emit('update:modelValue', label);
    query.value = label;
    open.value = false;
    active.value = -1;
}

/** Abandonner, c'est revenir à ce qui est retenu — jamais laisser une recherche en place. */
function close() {
    open.value = false;
    active.value = -1;
    query.value = props.modelValue ?? '';
}

function move(step: number) {
    openList();
    const count = flat.value.length;
    if (!count) return;
    active.value = (active.value + step + count) % count;
}

function onEnter() {
    if (!open.value) return openList();
    const label = flat.value[active.value] ?? (flat.value.length === 1 ? flat.value[0] : undefined);
    if (label) pick(label);
}

function onClickOutside(event: MouseEvent) {
    if (!root.value?.contains(event.target as Node)) close();
}

onMounted(() => document.addEventListener('mousedown', onClickOutside));
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside));

/** La ville retenue mais absente du référentiel : reprise d'une saisie libre, on le dit. */
const offList = computed(() => Boolean(props.modelValue)
    && cities.value.length > 0
    && !cities.value.some((city) => city.label === props.modelValue));
</script>

<template>
    <div ref="root" class="cbx">
        <div class="cbx-field">
            <BoIcon name="search" :size="16" />
            <input
                :id="id" v-model="query" type="text" class="cbx-input"
                role="combobox" aria-autocomplete="list" :aria-expanded="open"
                :aria-controls="`${id}-list`" autocomplete="off"
                :placeholder="placeholder" :required="required"
                @focus="openList" @click="openList"
                @input="open = true; active = -1"
                @keydown.down.prevent="move(1)"
                @keydown.up.prevent="move(-1)"
                @keydown.enter.prevent="onEnter"
                @keydown.esc.prevent="close"
                @keydown.tab="close"
            />
            <BoIcon name="chevron-down" :size="16" />
        </div>

        <ul v-if="open" :id="`${id}-list`" class="cbx-list" role="listbox">
            <li v-if="!flat.length" class="cbx-empty">
                Aucune ville ne correspond. La liste est celle du référentiel :
                signalez la ville manquante plutôt que de la saisir.
            </li>
            <template v-for="group in groups" :key="group.region">
                <li class="cbx-group" role="presentation">{{ group.region }}</li>
                <li
                    v-for="label in group.labels" :key="label"
                    role="option" :aria-selected="label === modelValue"
                    class="cbx-option"
                    :class="{
                        'is-active': indexOf(label) === active,
                        'is-picked': label === modelValue,
                    }"
                    @mouseenter="active = indexOf(label)"
                    @mousedown.prevent="pick(label)"
                >
                    {{ label }}
                    <BoIcon v-if="label === modelValue" name="check" :size="14" />
                </li>
            </template>
        </ul>

        <p v-if="offList" class="cbx-note">
            « {{ modelValue }} » vient d'une ancienne saisie et n'est plus proposée. Elle reste
            enregistrée tant que vous n'en choisissez pas une autre.
        </p>
    </div>
</template>

<style scoped>
.cbx {
    position: relative;
}

.cbx-field {
    display: flex;
    align-items: center;
    gap: .5rem;
    height: 2.5rem;
    padding: 0 .75rem;
    background-color: var(--surface-raised);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    color: var(--text-faint);
    transition: box-shadow .15s;
}

.cbx-field:focus-within {
    border-color: var(--brand-500);
    box-shadow: 0 0 0 3px var(--brand-100);
}

.cbx-input {
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    outline: none;
    font-size: .875rem;
    color: var(--text);
}

.cbx-input::placeholder {
    color: var(--text-faint);
}

.cbx-list {
    position: absolute;
    z-index: 30;
    left: 0;
    right: 0;
    top: calc(100% + .25rem);
    max-height: 16rem;
    overflow-y: auto;
    padding: .25rem 0;
    background-color: var(--surface-raised);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    box-shadow: 0 12px 28px rgb(15 23 42 / .12);
}

.cbx-group {
    padding: .4rem .75rem .2rem;
    font-size: .6875rem;
    font-weight: 600;
    letter-spacing: .04em;
    text-transform: uppercase;
    color: var(--text-faint);
}

.cbx-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .5rem;
    padding: .4rem .75rem;
    font-size: .875rem;
    color: var(--text);
    cursor: pointer;
}

.cbx-option.is-active {
    background-color: var(--surface-sunken);
}

.cbx-option.is-picked {
    color: var(--brand-700);
    font-weight: 500;
}

.cbx-empty {
    padding: .6rem .75rem;
    font-size: .8125rem;
    color: var(--text-faint);
}

.cbx-note {
    margin-top: .25rem;
    font-size: .75rem;
    color: var(--text-faint);
}
</style>

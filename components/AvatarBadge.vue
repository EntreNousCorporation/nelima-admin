<script setup lang="ts">
/**
 * Pastille d'initiales, à la place d'une photo que l'école n'a pas.
 *
 * La couleur est **déduite du nom**, pas tirée au sort ni stockée : la même personne garde la
 * sienne d'un écran à l'autre et d'une session à l'autre. C'est ce qui rend une liste parcourable
 * du coin de l'œil — on retrouve un élève à sa pastille avant d'avoir lu la ligne. Une couleur
 * aléatoire donnerait l'inverse : un repère qui change à chaque rechargement désoriente.
 *
 * Les teintes sont celles du prototype : claires, avec le texte en bleu nuit. Sur une liste de
 * trente lignes, des pastilles saturées feraient un damier illisible.
 */
const props = withDefaults(
    defineProps<{
        name?: string | null;
        size?: number;
        /**
         * `mute` pour une pastille grise, là où la couleur n'apporterait rien ; une valeur CSS
         * pour imposer une teinte qui porte un sens ailleurs (un canal de paiement, un statut).
         * Par défaut, la teinte se déduit du nom.
         */
        tone?: string;
    }>(),
    { size: 30 },
);

/** Palette du prototype. Claires et distinctes deux à deux, y compris en niveaux de gris. */
const TONES = [
    '#9DC8FF', '#C9F5C5', '#FFD9A0', '#D6C8FF', '#A9E7E0',
    '#FFB7C0', '#BFD4FF', '#FFC2E2',
];

const muted = computed(() => props.tone === 'mute');

const initials = computed(() => (props.name ?? '').split(' ').filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase()).join('') || '—');

/** Somme des codes de caractères : stable, bon marché, et assez dispersée sur huit teintes. */
const background = computed(() => {
    if (muted.value) return 'var(--surface-sunken)';
    if (props.tone) return props.tone;
    const name = props.name ?? '';
    let sum = 0;
    for (let index = 0; index < name.length; index += 1) sum += name.charCodeAt(index);
    return TONES[sum % TONES.length];
});

const style = computed(() => ({
    width: `${props.size}px`,
    height: `${props.size}px`,
    fontSize: `${Math.round(props.size * 0.38)}px`,
    background: background.value,
    color: muted.value ? 'var(--text-muted)' : 'var(--navy)',
}));
</script>

<template>
    <span class="avatar" :style="style">{{ initials }}</span>
</template>

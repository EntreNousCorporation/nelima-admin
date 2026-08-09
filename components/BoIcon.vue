<script setup lang="ts">
/**
 * Jeu d'icônes du prototype, repris trait pour trait.
 *
 * Un seul composant plutôt qu'un `<svg>` recopié à chaque appel : le prototype pose partout la
 * même grille de 24, la même épaisseur et les mêmes terminaisons arrondies, et c'est cette
 * régularité qui fait qu'un écran paraît dessiné plutôt qu'assemblé.
 *
 * Une icône inconnue ne rend rien du tout — un carré vide se remarque à la relecture, un symbole
 * approchant passerait inaperçu et resterait faux.
 */
const props = withDefaults(
    defineProps<{ name: string; size?: number; strokeWidth?: number }>(),
    { size: 18, strokeWidth: 1.7 },
);

/** Chemins SVG, sur la grille 24×24 du prototype. */
const PATHS: Record<string, string[]> = {
    'chart-bar': ['M4 20V10M10 20V4M16 20v-7M22 20H2'],
    'trend-up': ['M3 17l6-6 4 4 7-7', 'M15 8h5v5'],
    'trend-down': ['M3 7l6 6 4-4 7 7', 'M15 16h5v-5'],
    filter: ['M3 5h18l-7 8v6l-4 2v-8L3 5z'],
    refresh: ['M20 12a8 8 0 11-2.3-5.7', 'M20 3v4h-4'],
    building: ['M4 21V6l7-3v18', 'M11 10h6a2 2 0 012 2v9', 'M2 21h20'],
    cash: ['M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z', 'M12 14.6a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2'],
    percent: ['M19 5L5 19', 'M7.5 10a2.5 2.5 0 100-5 2.5 2.5 0 000 5', 'M16.5 19a2.5 2.5 0 100-5 2.5 2.5 0 000 5'],
    'user-check': ['M9 11.6a3.6 3.6 0 100-7.2 3.6 3.6 0 000 7.2', 'M2.5 20c.9-4 3.5-6 6.5-6 1.2 0 2.3.3 3.3.9', 'M14.5 17.5l2 2 4-4.5'],
    clipboard: ['M7 4h10a2 2 0 012 2v13a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z', 'M9 4V3h6v1', 'M9 10h6M9 14h6M9 18h3'],
    printer: ['M7 9V3h10v6', 'M5 9h14a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 012-2z', 'M7 16h10v5H7z'],
    mail: ['M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z', 'M3 7l9 6 9-6'],
    key: ['M8 19a4 4 0 100-8 4 4 0 000 8', 'M11 12l9-9M17 3l3 3M15 5l3 3'],
    briefcase: ['M5 7h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z', 'M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18'],
    layers: ['M12 3l9 5-9 5-9-5 9-5z', 'M3 13l9 5 9-5'],
    ban: ['M12 21a9 9 0 100-18 9 9 0 000 18', 'M6 18L18 6'],
    logout: ['M10 21H5a2 2 0 01-2-2V5a2 2 0 012-2h5', 'M16 16l5-4-5-4', 'M21 12H9'],
    'shield-check': ['M12 3l7.5 3v6c0 4.4-3 7.7-7.5 9-4.5-1.3-7.5-4.6-7.5-9V6L12 3z', 'M8.8 12l2.2 2.2 4.2-4.4'],
    /* ---- reprises du jeu mobile ---- */
    wallet: ['M5.5 6h13a2.5 2.5 0 012.5 2.5v8a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5v-8A2.5 2.5 0 015.5 6z', 'M3 9h18', 'M16.5 14.7a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4'],
    ball: ['M12 21a9 9 0 100-18 9 9 0 000 18', 'M12 7l3.5 2.5-1.3 4.2h-4.4L8.5 9.5 12 7z', 'M12 3v4M4 9l4.5.5M20 9l-4.5.5M7 20l2.8-3.3M17 20l-2.8-3.3'],
    edit: ['M15.5 4.5l4 4L8 20H4v-4L15.5 4.5z', 'M13.5 6.5l4 4'],
    bell: ['M6 16V11a6 6 0 1112 0v5l1.5 2H4.5L6 16z', 'M10 20a2 2 0 004 0'],
    user: ['M12 12.1a3.6 3.6 0 100-7.2 3.6 3.6 0 000 7.2', 'M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6'],
    search: ['M11 17.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13', 'M16 16l4 4'],
    'arrow-right': ['M9 5l7 7-7 7'],
    'chevron-right': ['M9 6l6 6-6 6'],
    'chevron-left': ['M15 6l-6 6 6 6'],
    'chevron-down': ['M6 9l6 6 6-6'],
    close: ['M6 6l12 12M6 18L18 6'],
    check: ['M5 12l5 5 9-11'],
    'check-circle': ['M12 21a9 9 0 100-18 9 9 0 000 18', 'M8 12l2.7 2.7L16 9'],
    plus: ['M12 5v14M5 12h14'],
    students: ['M9 12a3 3 0 100-6 3 3 0 000 6', 'M17 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5', 'M3 19c.7-3 3-5 6-5s5.3 2 6 5', 'M14.5 19c.5-2 2-3.5 4-3.5s3 1 3.5 2.5'],
    clock: ['M12 21a9 9 0 100-18 9 9 0 000 18', 'M12 7v5l3 2'],
    alert: ['M12 3l10 17H2L12 3z', 'M12 10v5M12 18v.5'],
    calendar: ['M5.5 5h13a2 2 0 012 2v11a2 2 0 01-2 2h-13a2 2 0 01-2-2V7a2 2 0 012-2z', 'M3.5 10h17M8 3v4M16 3v4'],
    download: ['M12 4v12M7 11l5 5 5-5', 'M5 20h14'],
    upload: ['M12 20V8M7 13l5-5 5 5', 'M5 4h14'],
    phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z'],
    lock: ['M7 11h10a2 2 0 012 2v5a2 2 0 01-2 2H7a2 2 0 01-2-2v-5a2 2 0 012-2z', 'M8 11V8a4 4 0 018 0v3'],
    sparkles: ['M12 3l1.5 4 4 1.5-4 1.5L12 14l-1.5-4-4-1.5 4-1.5L12 3z', 'M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z'],
    settings: ['M12 15a3 3 0 100-6 3 3 0 000 6', 'M19.4 15a1.7 1.7 0 00.4 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.4 1.7 1.7 0 00-1 1.6V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.4-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.4-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.4H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.4 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z'],
    zap: ['M13 3L4 14h7l-1 7 9-11h-7l1-7z'],
    send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
    receipt: ['M6 3h12v18l-3-2-3 2-3-2-3 2V3z', 'M9 8h6M9 12h6M9 16h3'],
    door: ['M4 21V4a1 1 0 011-1h11a1 1 0 011 1v17', 'M2 21h20'],
    /* Natures d'activité extra-scolaire. */
    music: ['M9 18V6l10-2v12', 'M6.5 20.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5', 'M16.5 18.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5'],
    palette: ['M12 3a9 9 0 100 18c1.4 0 2-1 1.4-2-.6-1.2.2-2.4 1.6-2.4H17a4 4 0 004-4c0-5-4-9.6-9-9.6z'],
    book: ['M4 4h7a3 3 0 013 3v13H7a3 3 0 01-3-3V4z', 'M20 4h-7a3 3 0 00-3 3v13h7a3 3 0 003-3V4z'],
    globe: ['M12 21a9 9 0 100-18 9 9 0 000 18', 'M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18'],
    megaphone: ['M3 10v4l11 5V5L3 10z', 'M14 8a4 4 0 010 8', 'M7 14v4l3 1'],
    trophy: ['M8 4h8v5a4 4 0 11-8 0V4z', 'M5 5H3v2a3 3 0 003 3M19 5h2v2a3 3 0 01-3 3', 'M9 14h6l-1 5h-4l-1-5z'],
};

const paths = computed(() => PATHS[props.name] ?? []);
</script>

<template>
    <svg
        v-if="paths.length" :width="size" :height="size" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" :stroke-width="strokeWidth" stroke-linecap="round"
        stroke-linejoin="round" class="shrink-0 inline-block" aria-hidden="true"
    >
        <path v-for="(d, index) in paths" :key="index" :d="d" />
    </svg>
</template>

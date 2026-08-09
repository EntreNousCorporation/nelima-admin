<script setup lang="ts">
/**
 * Marque Nelima, reprise trait pour trait de la charte du designer
 * (`New Design/src/icons.jsx`, composant `NelimaLogo`).
 *
 * Le motif — un écusson à double contour portant un disque plein — est le logo officiel du
 * produit. Celui que le portail affichait jusqu'ici était un carnet dessiné faute de charte, et il
 * ne ressemblait à rien de ce que les écoles voient par ailleurs.
 *
 * Le rapport 56 × 45 est celui de la charte ; l'inscrire dans un carré l'aurait écrasé.
 */
withDefaults(
    defineProps<{ size?: number; color?: string; accent?: string }>(),
    { size: 26, color: 'currentColor' },
);
</script>

<template>
    <svg
        :width="size" :height="size * 45 / 56" viewBox="0 0 56 45" fill="none"
        class="block shrink-0" role="img" aria-label="Nelima"
    >
        <circle cx="28" cy="17.4143" r="13.1286" :fill="accent || color" :stroke="accent || color" />
        <path d="M1.5 0V30.9295L28 42.4L54.5 30.9295V0" :stroke="color" stroke-width="3" />
        <path d="M9.07144 4.54286V27.74L28.7572 36.3429L48.4429 27.74V4.54286" :stroke="color" />
    </svg>
</template>

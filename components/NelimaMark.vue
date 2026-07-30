<script setup lang="ts">
/**
 * Marque Nelima.
 *
 * Dessinée en SVG plutôt qu'importée en image : elle doit rester nette à toute taille, suivre la
 * couleur de marque définie par les jetons, et ne coûter aucune requête réseau au premier rendu.
 *
 * Le motif — un carnet dont une page se détache — se lit à 24 px comme à 64. Il tient lieu de
 * repère en attendant la charte définitive.
 */
withDefaults(defineProps<{ size?: number }>(), { size: 32 });
</script>

<template>
    <svg
        :width="size" :height="size" viewBox="0 0 32 32" fill="none"
        role="img" aria-label="Nelima"
    >
        <rect width="32" height="32" rx="8" fill="var(--brand-600)" />
        <path
            d="M9 9.5h9.5a4.5 4.5 0 0 1 0 9H12v4"
            stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
        />
        <circle cx="22.5" cy="22.5" r="2.2" fill="#fff" />
    </svg>
</template>

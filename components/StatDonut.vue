<script setup lang="ts">
/**
 * Anneau de progression, tel que le prototype l'emploie pour le taux de recouvrement.
 *
 * Dessiné en SVG plutôt qu'apporté par une bibliothèque de graphiques : un seul arc ne justifie
 * pas d'embarquer un moteur de rendu, et celui-ci reste net à toute taille.
 */
const props = withDefaults(defineProps<{
    percent: number;
    size?: number;
    stroke?: number;
    tone?: string;
    /** Remplace le pourcentage au centre. Sert à dire « rien à mesurer » sans afficher 0 %. */
    label?: string;
}>(), { size: 64, stroke: 8, tone: 'var(--success-solid)' });

const radius = computed(() => (props.size - props.stroke) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
// Bornage explicite : un taux supérieur à 100 % — une école qui encaisse des arriérés — dessinerait
// sinon un arc plus long que le cercle.
const clamped = computed(() => Math.max(0, Math.min(100, props.percent || 0)));
const offset = computed(() => circumference.value * (1 - clamped.value / 100));
</script>

<template>
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" class="shrink-0">
        <circle
            :cx="size / 2" :cy="size / 2" :r="radius" fill="none"
            stroke="var(--border)" :stroke-width="stroke"
        />
        <circle
            :cx="size / 2" :cy="size / 2" :r="radius" fill="none"
            :stroke="tone" :stroke-width="stroke" stroke-linecap="round"
            :stroke-dasharray="circumference" :stroke-dashoffset="offset"
            :transform="`rotate(-90 ${size / 2} ${size / 2})`"
        />
        <text
            :x="size / 2" :y="size / 2" text-anchor="middle" dominant-baseline="central"
            style="font: 800 13px Nunito, sans-serif; fill: var(--navy)"
        >{{ label ?? `${Math.round(clamped)}%` }}</text>
    </svg>
</template>

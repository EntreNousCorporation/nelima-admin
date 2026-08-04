<script setup lang="ts">
/**
 * En-tête de page du prototype : titre serré en bleu nuit, précision grise en dessous, actions
 * alignées à droite. Répété tel quel sur chaque écran, il donne au portail son unité.
 */
defineProps<{ title: string; sub?: string }>();
</script>

<template>
    <div class="flex flex-wrap items-end justify-between gap-5 mb-4">
        <div>
            <h1 class="text-[22px] font-black tracking-tight" style="color: var(--navy)">
                {{ title }}
            </h1>
            <p v-if="sub" class="mt-1 text-[13px]" style="color: var(--text-faint)">{{ sub }}</p>
        </div>
        <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
            <slot name="actions" />
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * Carte à en-tête : titre, sous-titre, action à droite, puis contenu.
 *
 * `pad` se met à faux quand le contenu est un tableau ou une liste, qui portent leur propre
 * gouttière et doivent toucher les bords de la carte.
 */
withDefaults(
    defineProps<{
        title?: string;
        sub?: string;
        pad?: boolean;
        /** Explication de ce que la carte montre, au survol d'une pastille « ? » près du titre. */
        tip?: string;
    }>(),
    { pad: true },
);
</script>

<template>
    <section class="card min-w-0">
        <div v-if="title || $slots.action" class="card-h">
            <div class="min-w-0">
                <h3 v-if="title">{{ title }}<InfoDot v-if="tip" :tip="tip" class="ml-1.5" /></h3>
                <div v-if="sub" class="sub">{{ sub }}</div>
            </div>
            <div v-if="$slots.action" class="flex items-center gap-2 shrink-0">
                <slot name="action" />
            </div>
        </div>

        <div v-if="pad" class="card-b"><slot /></div>
        <slot v-else />

        <div v-if="$slots.footer" class="card-f"><slot name="footer" /></div>
    </section>
</template>

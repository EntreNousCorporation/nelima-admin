<script setup lang="ts">
/**
 * Ligne de réglage : pastille, intitulé, explication, commande à droite.
 *
 * <p>C'est le {@code SRow} du prototype, le vocabulaire de tous les écrans de réglages du produit.
 * Un réglage se lit d'un coup d'œil parce que la commande est toujours au même endroit, et parce
 * que l'explication tient sous l'intitulé plutôt que dans une aide séparée : un interrupteur dont
 * on ignore l'effet ne se touche pas.
 */
defineProps<{
    label: string;
    desc?: string;
    icon?: string;
    tip?: string;
}>();
</script>

<template>
    <div class="srow">
        <!-- L'emplacement de gauche accepte autre chose qu'une pastille : une liste d'écoles y met
             leur avatar, qui identifie mieux qu'une icône répétée à chaque ligne. -->
        <slot name="icon">
            <div v-if="icon" class="sic"><BoIcon :name="icon" :size="17" /></div>
        </slot>
        <div class="flex-1 min-w-0">
            <b>{{ label }}<InfoDot v-if="tip" :tip="tip" /></b>
            <p v-if="desc">{{ desc }}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
            <slot />
        </div>
    </div>
</template>

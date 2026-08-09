<script setup lang="ts">
/**
 * Interrupteur du prototype.
 *
 * Distinct d'une case à cocher, et la distinction porte un sens : une case s'inscrit dans une
 * liste de choix qu'on valide ensuite, un interrupteur bascule un état unique. « Toutes les
 * classes » est de la seconde espèce — il éteint la liste qui le suit.
 *
 * `role="switch"` et `aria-checked` : sans eux, un lecteur d'écran annonce un bouton sans état.
 */
const props = defineProps<{ modelValue: boolean; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [boolean] }>();
</script>

<template>
    <button
        type="button" class="sw" role="switch" :aria-checked="modelValue" :disabled="disabled"
        @click="emit('update:modelValue', !props.modelValue)"
    ><i /></button>
</template>

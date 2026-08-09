<script setup lang="ts">
/**
 * Pastille « ? » qui explique un chiffre au survol.
 *
 * Le libellé d'un indicateur tient en trois mots ; la règle qui le produit, non. « Taux de
 * recouvrement » ne dit ni sur quelle période il porte, ni ce qu'il compte, ni à partir de quel
 * seuil il faut s'inquiéter. Sans cette bulle, chacun devine — et deux personnes lisent le même
 * chiffre différemment, ce qui est la pire situation pour un tableau de bord d'argent.
 *
 * `tabindex` et `aria-label` la rendent atteignable au clavier et lisible par un lecteur d'écran :
 * une explication qu'on ne peut obtenir qu'à la souris n'est une explication que pour une partie
 * des utilisateurs.
 */
defineProps<{ tip: string; pos?: 'top' }>();
</script>

<template>
    <span
        class="info-dot" :data-tip="tip" :data-tip-pos="pos" tabindex="0"
        role="note" :aria-label="tip"
    >?</span>
</template>

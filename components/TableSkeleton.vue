<script setup lang="ts">
/**
 * Lignes d'attente d'un tableau.
 *
 * Elles occupent exactement la place des vraies : la page ne saute pas quand les données arrivent,
 * et l'œil sait déjà où regarder. Un « Chargement… » centré sur une cellule fusionnée fait l'un et
 * l'autre à l'envers — il déplace tout, et sur une requête lente il ne distingue pas un écran qui
 * travaille d'un écran en panne.
 *
 * Les largeurs sont volontairement irrégulières : des barres toutes identiques se lisent comme un
 * motif décoratif, pas comme du texte à venir.
 */
withDefaults(defineProps<{ columns: number; rows?: number }>(), { rows: 5 });

const WIDTHS = ['70%', '45%', '60%', '35%', '55%', '40%', '65%', '30%'];
</script>

<template>
    <tr v-for="row in rows" :key="row" aria-hidden="true">
        <td v-for="column in columns" :key="column">
            <i class="sk h-3" :style="{ width: WIDTHS[(row + column) % WIDTHS.length] }" />
        </td>
    </tr>
</template>

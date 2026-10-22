<script setup lang="ts">
/**
 * Mise en page des écrans de connexion : rien autour de la page.
 *
 * Ils avaient la mise en page de l'application, qui choisit son cadre selon la session. Or la
 * session s'ouvre avant que la navigation vers le tableau de bord ne soit terminée : pendant un
 * instant, la barre et les onglets s'affichaient autour du formulaire de connexion. Avec une mise
 * en page à eux, le changement de cadre se fait en même temps que le changement de page.
 */
</script>

<template>
    <div class="min-h-screen">
        <slot />
    </div>
</template>

<script setup lang="ts">
/**
 * Le panneau de gauche des écrans d'authentification.
 *
 * <p>Il disait à qui s'adresse la page de connexion ; les écrans de mot de passe en ont le même
 * besoin. Définir son mot de passe est le premier écran qu'un compte nouvellement créé découvre :
 * le laisser nu en ferait une page d'erreur d'apparence.
 *
 * <p>Masqué sous 1024 px, où toute la place doit aller au formulaire.
 */
</script>

<template>
    <aside
        class="hidden lg:flex flex-col justify-between p-12 text-white"
        style="background: linear-gradient(150deg, #131a2e 0%, #0a0f1d 100%)"
    >
        <div class="flex items-center gap-3">
            <NelimaMark :size="36" />
            <span class="text-lg font-semibold tracking-tight">Nelima</span>
        </div>

        <div class="max-w-md">
            <p class="text-3xl font-semibold leading-tight tracking-tight">
                Administration de la plateforme.
            </p>
            <p class="mt-4 text-white/60 leading-relaxed">
                Établissements partenaires, comptes de direction et configuration de
                l'agrégateur de paiement.
            </p>
        </div>

        <p class="text-sm text-white/40">Réservé à l'équipe YPYit</p>
    </aside>
</template>

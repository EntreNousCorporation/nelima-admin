<script setup lang="ts">
/**
 * Sous-navigation segmentée du prototype : un rail gris, l'onglet actif en pastille blanche.
 *
 * Distincte des filtres (`.chip`), et la distinction porte un sens : un filtre se cumule et se
 * décoche, un onglet est exclusif. Les avoir dessinés pareil laissait croire qu'on pouvait
 * consulter deux sous-écrans à la fois.
 *
 * Un onglet dont le rôle n'a pas la permission n'est pas affiché : le serveur refuserait l'appel,
 * et proposer une page qui répond 403 est une promesse que l'écran ne tient pas.
 */
export type SubNavItem = { label: string; to: string; permission?: string };

const props = defineProps<{ items: SubNavItem[] }>();

const route = useRoute();
const { can } = usePermissions();

const shown = computed(() => props.items.filter((item) => !item.permission || can(item.permission)));
</script>

<template>
    <nav class="sub-nav">
        <NuxtLink
            v-for="item in shown" :key="item.to" :to="item.to"
            :aria-current="route.path === item.to ? 'page' : undefined"
        >{{ item.label }}</NuxtLink>
    </nav>
</template>

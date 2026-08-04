<script setup lang="ts">
/**
 * Écran vide. Il dit ce qui manque et comment le remplir : un tableau sans ligne ni explication
 * laisse croire à une panne.
 */
defineProps<{ title: string; text: string }>();
</script>

<template>
    <div class="empty">
        <p class="empty-title">{{ title }}</p>
        <p class="empty-text">{{ text }}</p>
        <div v-if="$slots.action" class="mt-2.5"><slot name="action" /></div>
    </div>
</template>

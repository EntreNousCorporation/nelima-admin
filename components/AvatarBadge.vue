<script setup lang="ts">
/** Pastille d'initiales, à la place d'une photo que l'école n'a pas. */
const props = withDefaults(
    defineProps<{ name?: string | null; size?: number; tone?: 'brand' | 'mute' }>(),
    { size: 30, tone: 'brand' },
);

const initials = computed(() => (props.name ?? '').split(' ').filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase()).join('') || '—');

const style = computed(() => ({
    width: `${props.size}px`,
    height: `${props.size}px`,
    fontSize: `${Math.round(props.size * 0.36)}px`,
    background: props.tone === 'brand' ? 'var(--brand-50)' : 'var(--surface-sunken)',
    color: props.tone === 'brand' ? 'var(--brand-700)' : 'var(--text-muted)',
}));
</script>

<template>
    <span class="avatar" :style="style">{{ initials }}</span>
</template>

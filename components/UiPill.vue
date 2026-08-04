<script setup lang="ts">
/**
 * Étiquette d'état. Le ton porte le sens — vert pour ce qui est réglé, rouge pour ce qui est en
 * retard —, jamais la décoration.
 */
const props = withDefaults(
    defineProps<{ tone?: 'ok' | 'warn' | 'late' | 'info' | 'mute' }>(),
    { tone: 'mute' },
);

const TONES = {
    ok: ['var(--success)', 'var(--success-soft)'],
    warn: ['var(--warning)', 'var(--warning-soft)'],
    late: ['var(--danger)', 'var(--danger-soft)'],
    info: ['var(--brand-700)', 'var(--brand-50)'],
    mute: ['var(--text-muted)', 'var(--surface-sunken)'],
} as const;

const style = computed(() => {
    const [color, background] = TONES[props.tone] ?? TONES.mute;
    return { color, background };
});
</script>

<template>
    <span class="pill" :style="style"><slot /></span>
</template>

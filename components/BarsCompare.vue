<script setup lang="ts">
/**
 * Deux séries comparées, mois par mois.
 *
 * <p>Même dessin que {@code MonthlyBars}, mais sans le seuil d'alerte à 80 % ni le vocabulaire des
 * échéanciers : ici la barre claire est ce qui a été facturé, la barre pleine ce qui est rentré.
 * Un abonnement facturé et non réglé n'est pas « en retard » tant que son échéance court, et
 * peindre le mois en orange l'accuserait à tort.
 *
 * <p>En CSS pur : douze paires de rectangles ne justifient pas d'embarquer un moteur de graphiques.
 */
const props = defineProps<{
    points: { month: string; back: number; front: number }[];
    backLabel: string;
    frontLabel: string;
}>();

const rows = computed(() => {
    const max = Math.max(1, ...props.points.flatMap((p) => [p.back ?? 0, p.front ?? 0]));
    return props.points.map((p) => ({
        ...p,
        label: monthLabel(p.month),
        backHeight: `${Math.round(((p.back ?? 0) / max) * 100)}%`,
        frontHeight: `${Math.round(((p.front ?? 0) / max) * 100)}%`,
    }));
});

function monthLabel(month: string) {
    const [year, m] = (month ?? '').split('-');
    if (!year || !m) return month;
    return new Date(Number(year), Number(m) - 1, 1)
        .toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}

function amount(value?: number | null) {
    return Math.round(Number(value ?? 0)).toLocaleString('fr-FR');
}
</script>

<template>
    <div>
        <div class="flex items-end justify-between gap-2">
            <div v-for="row in rows" :key="row.month" class="flex-1 flex flex-col items-center gap-2">
                <!-- Hauteur explicite : un pourcentage a besoin d'un parent dont la hauteur est
                     résolue, sinon les barres ne se dessinent pas. -->
                <div class="w-full flex items-end justify-center gap-1" style="height: 168px">
                    <div
                        class="w-[38%] rounded-t" :style="{ height: row.backHeight, background: 'var(--border)' }"
                        :title="`${backLabel} : ${amount(row.back)} F`"
                    />
                    <div
                        class="w-[38%] rounded-t"
                        :style="{ height: row.frontHeight, background: 'var(--brand-600)' }"
                        :title="`${frontLabel} : ${amount(row.front)} F`"
                    />
                </div>
                <span class="text-[11px] font-semibold" style="color: var(--text-faint)">
                    {{ row.label }}
                </span>
            </div>
        </div>

        <div class="flex items-center gap-4 mt-3 text-[11px]" style="color: var(--text-faint)">
            <span class="flex items-center gap-1.5">
                <i class="w-2.5 h-2.5 rounded-sm inline-block" style="background: var(--border)" />
                {{ backLabel }}
            </span>
            <span class="flex items-center gap-1.5">
                <i class="w-2.5 h-2.5 rounded-sm inline-block" style="background: var(--brand-600)" />
                {{ frontLabel }}
            </span>
        </div>
    </div>
</template>

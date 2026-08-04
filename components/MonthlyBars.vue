<script setup lang="ts">
/**
 * Barres comparées attendu / encaissé, mois par mois.
 *
 * Barre claire à l'arrière : ce que l'échéancier prévoyait. Barre pleine devant : ce qui est
 * réellement rentré. Le mois passe en orange sous 80 % de recouvrement — c'est le seuil que le
 * prototype retient pour déclencher une campagne de relance.
 *
 * En CSS pur, sans bibliothèque : six paires de rectangles ne justifient pas d'embarquer un moteur
 * de graphiques, et le rendu reste net à toute densité d'écran.
 */
const props = defineProps<{
    points: { month: string; expected: number; collected: number }[];
}>();

const SEUIL_ALERTE = 0.8;

const rows = computed(() => {
    const max = Math.max(
        1,
        ...props.points.flatMap((p) => [p.expected ?? 0, p.collected ?? 0]),
    );
    return props.points.map((p) => {
        const expected = p.expected ?? 0;
        const collected = p.collected ?? 0;
        return {
            ...p,
            label: monthLabel(p.month),
            expectedHeight: `${Math.round((expected / max) * 100)}%`,
            collectedHeight: `${Math.round((collected / max) * 100)}%`,
            // Un mois sans rien d'attendu n'est pas un mois en retard : il n'a simplement pas
            // d'échéance. Le peindre en orange accuserait l'école à tort.
            alert: expected > 0 && collected / expected < SEUIL_ALERTE,
        };
    });
});

function monthLabel(month: string) {
    const [year, m] = (month ?? '').split('-');
    if (!year || !m) return month;
    const date = new Date(Number(year), Number(m) - 1, 1);
    return date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}
</script>

<template>
    <div>
        <div class="flex items-end justify-between gap-3">
            <div v-for="row in rows" :key="row.month" class="flex-1 flex flex-col items-center gap-2">
                <!-- Hauteur explicite, et non `flex-1` : une hauteur en pourcentage a besoin d'un
                     parent dont la hauteur est résolue, sinon les barres ne se dessinent pas. -->
                <div class="w-full flex items-end justify-center gap-1" style="height: 168px">
                    <div
                        class="w-[38%] rounded-t"
                        :style="{ height: row.expectedHeight, background: 'var(--border)' }"
                        :title="`Attendu : ${Math.round(row.expected).toLocaleString('fr-FR')} F`"
                    />
                    <div
                        class="w-[38%] rounded-t"
                        :style="{
                            height: row.collectedHeight,
                            background: row.alert ? 'var(--warning-solid)' : 'var(--brand-600)',
                        }"
                        :title="`Encaissé : ${Math.round(row.collected).toLocaleString('fr-FR')} F`"
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
                Attendu
            </span>
            <span class="flex items-center gap-1.5">
                <i class="w-2.5 h-2.5 rounded-sm inline-block" style="background: var(--brand-600)" />
                Encaissé
            </span>
            <span class="flex items-center gap-1.5">
                <i class="w-2.5 h-2.5 rounded-sm inline-block" style="background: var(--warning-solid)" />
                Sous 80 %
            </span>
        </div>
    </div>
</template>

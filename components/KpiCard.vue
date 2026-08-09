<script setup lang="ts">
/**
 * Carte de chiffre clé, telle que le prototype la dessine.
 *
 * Le **symbole devant le libellé** n'est pas un ornement : quatre cartes alignées se distinguent
 * d'abord par lui, avant qu'on ait lu un seul mot. Sans lui, le tableau de bord se lit en quatre
 * temps au lieu d'un.
 *
 * L'écart chiffré porte sa couleur : vert quand il va dans le bon sens, rouge sinon. `invert`
 * sert aux grandeurs où la baisse est une bonne nouvelle — un reste à recouvrer, par exemple.
 */
withDefaults(defineProps<{
    label: string;
    icon?: string;
    value: string;
    unit?: string;
    /** Écart en pourcentage. Absent quand il n'y a rien à comparer — un zéro mentirait. */
    delta?: number | null;
    invert?: boolean;
    foot?: string;
    /**
     * Couleur du chiffre, quand il porte lui-même une alerte — un nombre de pièces comptables
     * manquantes, par exemple. Réservée à ce cas : colorer par habitude ferait perdre au rouge sa
     * valeur de signal.
     */
    valueTone?: string;
    /**
     * Explication du chiffre, montrée au survol de la pastille « ? ».
     *
     * Elle dit ce que la carte compte et sur quelle période — ce que le libellé ne peut pas porter
     * en trois mots.
     */
    tip?: string;
}>(), { invert: false });
</script>

<template>
    <div class="card p-[14px_15px]">
        <div class="kpi-label">
            <BoIcon v-if="icon" :name="icon" :size="14" :stroke-width="2" />
            {{ label }}
            <InfoDot v-if="tip" :tip="tip" />
        </div>
        <!-- Alignement en haut, et non en bas : l'anneau est plus haut que le bloc chiffre + pied,
             et l'aligner par le bas décalait la valeur de trois pixels vers le bas sur la seule
             carte qui en porte un. Dans une rangée de quatre, ce décalage se voit. -->
        <div class="flex items-start justify-between gap-2.5">
            <div class="min-w-0">
                <div class="kpi-value" :style="valueTone ? { color: valueTone } : undefined">
                    {{ value }}<small v-if="unit">{{ unit }}</small>
                </div>
                <div class="kpi-foot">
                    <span
                        v-if="delta !== null && delta !== undefined"
                        class="delta"
                        :class="(invert ? delta <= 0 : delta >= 0) ? 'delta-up' : 'delta-down'"
                    >
                        <BoIcon
                            :name="delta >= 0 ? 'trend-up' : 'trend-down'" :size="12"
                            :stroke-width="2.3"
                        />
                        {{ delta >= 0 ? '+' : '' }}{{ String(delta).replace('.', ',') }} %
                    </span>
                    <slot name="foot">{{ foot }}</slot>
                </div>
            </div>
            <slot name="chart" />
        </div>
    </div>
</template>

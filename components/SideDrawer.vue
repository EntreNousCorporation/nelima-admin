<script setup lang="ts">
/**
 * Tiroir latéral, tel que le prototype l'emploie pour les fiches.
 *
 * Un tiroir plutôt qu'une page : on consulte une fiche depuis une liste et on y revient aussitôt,
 * et une navigation complète ferait perdre le filtre, la page et la position de défilement.
 */
defineProps<{ title: string; sub?: string }>();
const emit = defineEmits<{ close: [] }>();

/** Échap ferme, comme partout ailleurs : un tiroir sans sortie au clavier piège l'utilisateur. */
function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') emit('close');
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
    <Teleport to="body">
        <div
            class="fixed inset-0 z-40" style="background: rgba(8,31,71,.42)"
            @click="emit('close')"
        />
        <aside
            class="fixed top-0 right-0 bottom-0 z-50 w-[560px] max-w-[94vw] flex flex-col"
            style="background: var(--surface-raised); box-shadow: -10px 0 50px rgba(11,46,102,.2)"
            role="dialog" aria-modal="true"
        >
            <div class="flex items-start gap-3 px-4 py-4" style="border-bottom: 1px solid var(--border)">
                <slot name="avatar" />
                <div class="flex-1 min-w-0">
                    <h3 class="text-[17px] font-black tracking-tight truncate" style="color: var(--navy)">
                        {{ title }}
                    </h3>
                    <p v-if="sub" class="text-[12.5px] mt-0.5" style="color: var(--text-faint)">
                        {{ sub }}
                    </p>
                </div>
                <button
                    class="w-8 h-8 rounded-lg grid place-items-center shrink-0"
                    style="color: var(--text-muted)" title="Fermer" @click="emit('close')"
                >
                    <svg
                        class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2" stroke-linecap="round"
                    >
                        <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto p-4"><slot /></div>

            <div
                v-if="$slots.footer" class="flex gap-2 px-4 py-3"
                style="border-top: 1px solid var(--border)"
            >
                <slot name="footer" />
            </div>
        </aside>
    </Teleport>
</template>

import { defineStore } from 'pinia';
import type { AdminUser } from '~~/server/utils/auth';

/**
 * Ni jeton, ni persistance, ni hydratation manuelle : le store ne contient que le profil
 * affiché. Tout le reste vit dans la session scellée côté serveur.
 */
export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: null as AdminUser | null,
        initializing: false,
    }),
    getters: {
        isAuthenticated: (state) => state.user !== null,
        /**
         * Nom affiché.
         *
         * Le compte d'amorçage de YPYit n'a ni prénom ni nom : le backend y recopie son
         * identifiant, et la concaténation naïve affichait deux fois la même adresse en haut de
         * l'écran. On retombe alors sur l'identifiant, une fois.
         */
        fullName: (state) => {
            if (!state.user) return '';
            const parts = [state.user.firstName, state.user.lastName]
                .map((part) => (part ?? '').trim()).filter(Boolean);
            const unique = [...new Set(parts)];
            return unique.join(' ') || state.user.username || '';
        },
    },
    actions: {
        setUser(user: AdminUser) {
            this.user = user;
        },
        clear() {
            this.user = null;
        },
    },
});

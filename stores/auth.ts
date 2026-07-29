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
        fullName: (state) => state.user ? `${state.user.firstName} ${state.user.lastName}`.trim() : '',
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

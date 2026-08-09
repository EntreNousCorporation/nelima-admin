import { useAuthStore } from '~/stores/auth';

/**
 * Client HTTP de la console. Même origine, sans en-tête d'autorisation : c'est le serveur Nuxt qui
 * ajoute le jeton. Le navigateur ne connaît pas l'URL du backend.
 */
export function useApi() {
    return $fetch.create({
        baseURL: '/api/v1',
        onResponseError({ response }) {
            if (response.status !== 401) return;
            // Sans vider le magasin, le middleware voit l'utilisateur encore « connecté » et le
            // renvoie vers /app, dont les appels échouent à nouveau : boucle infinie qui fige
            // l'onglet. Le portail a connu exactement ce défaut.
            useAuthStore().clear();
            if (useRoute().path !== '/connexion') navigateTo('/connexion');
        },
    });
}

/**
 * Client HTTP du portail. Même origine, sans en-tête d'autorisation : c'est le serveur
 * Nuxt qui ajoute le jeton. Le navigateur ne connaît pas l'URL du backend.
 */
export function useApi() {
    return $fetch.create({
        baseURL: '/api/v1',
        onResponseError({ response }) {
            if (response.status === 401) {
                navigateTo('/connexion');
            }
        },
    });
}

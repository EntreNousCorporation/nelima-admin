import { useAuthStore } from '~/stores/auth';

const PUBLIC_ROUTES = new Set(['/connexion']);

export default defineNuxtRouteMiddleware(async (to) => {
    const auth = useAuthStore();

    if (!auth.user && !auth.initializing) {
        auth.initializing = true;
        // useRequestFetch et non $fetch : en rendu serveur, $fetch ne réémet pas les
        // cookies de la requête entrante. Le serveur ne verrait donc pas la session et
        // renverrait l'utilisateur sur la page de connexion à chaque rafraîchissement.
        const fetcher = useRequestFetch();
        try {
            const { user } = await fetcher<{ user: any }>('/api/me');
            auth.setUser(user);
        } catch (error: any) {
            if (error?.statusCode && error.statusCode !== 401) throw error;
        } finally {
            auth.initializing = false;
        }
    }

    if (PUBLIC_ROUTES.has(to.path)) {
        return auth.isAuthenticated ? navigateTo('/app') : undefined;
    }
    if (!auth.isAuthenticated) {
        return navigateTo('/connexion');
    }
});

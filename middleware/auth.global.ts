import { useAuthStore } from '~/stores/auth';

/** Ouvertes à qui n'est pas connecté, mais fermées à qui l'est : il n'a rien à y faire. */
const PUBLIC_ROUTES = new Set(['/connexion']);

/**
 * Ouvertes à tout le monde, connecté ou non.
 *
 * <p>Le parcours de mot de passe ne se laisse pas rediriger : un membre de l'équipe déjà connecté
 * peut ouvrir un lien reçu pour un autre compte. Le renvoyer vers `/app` lui ferait manquer
 * l'écran, et le lien expirerait sans qu'il comprenne pourquoi.
 */
const OPEN_ROUTES = new Set(['/connexion/reset', '/connexion/oubli']);

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

    if (OPEN_ROUTES.has(to.path)) {
        return;
    }
    if (PUBLIC_ROUTES.has(to.path)) {
        return auth.isAuthenticated ? navigateTo('/app') : undefined;
    }
    if (!auth.isAuthenticated) {
        return navigateTo('/connexion');
    }
});

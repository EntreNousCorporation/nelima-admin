import { createError, defineEventHandler } from 'h3';
import { getAdminSession } from '~~/server/utils/auth';

/**
 * Source de vérité de l'état connecté. Le store client est éphémère : c'est cet appel
 * qui le repeuple à chaque démarrage, en SSR comme au rafraîchissement.
 */
export default defineEventHandler(async (event) => {
    const session = await getAdminSession(event);
    if (!session.data.user) {
        throw createError({ statusCode: 401 });
    }
    return { user: session.data.user };
});

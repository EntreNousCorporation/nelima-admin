import { createError, defineEventHandler, readValidatedBody } from 'h3';
import { z } from 'zod';

const schema = z.object({
    username: z.string().min(1).max(255),
    token: z.string().min(1).max(4096),
    password: z.string().min(6).max(16),
});

/**
 * Définition du mot de passe depuis le lien reçu par courriel.
 *
 * Hors du proxy générique, comme le login : c'est une route qui doit répondre **sans session**,
 * puisque celui qui l'appelle n'a précisément pas encore de mot de passe.
 *
 * Rien n'est scellé ici et aucune session n'est ouverte : le compte est ensuite invité à se
 * connecter normalement. Poser une session à la volée reviendrait à faire du lien reçu par
 * courriel un moyen d'authentification à part entière.
 */
export default defineEventHandler(async (event) => {
    const parsed = await readValidatedBody(event, (body) => schema.safeParse(body));
    if (!parsed.success) {
        throw createError({ statusCode: 400, statusMessage: 'Mot de passe ou lien invalide' });
    }

    const config = useRuntimeConfig();

    const response = await $fetch.raw(`${config.backendUrl}/users/reset-password`, {
        method: 'PUT',
        body: parsed.data,
        headers: { 'Content-Type': 'application/json' },
        ignoreResponseError: true,
    });

    if (response.status >= 400) {
        // Le backend ne distingue pas un jeton faux d'un jeton périmé, et il n'y a rien à en
        // dire de plus utile : dans les deux cas, le seul recours est de redemander un lien.
        throw createError({
            statusCode: response.status === 400 || response.status === 404 ? 400 : 502,
            statusMessage: 'Ce lien n’est plus valable. Demandez-en un nouveau.',
        });
    }

    return { ok: true };
});

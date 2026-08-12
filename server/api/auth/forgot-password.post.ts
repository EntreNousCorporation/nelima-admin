import { createError, defineEventHandler, readValidatedBody } from 'h3';
import { z } from 'zod';

const schema = z.object({
    username: z.string().min(1).max(255),
});

/**
 * Demande d'un nouveau lien de définition de mot de passe.
 *
 * La réponse est **toujours la même**, que le compte existe ou non. Le backend rend 404 sur un
 * identifiant inconnu ; le relayer ferait de cet écran un moyen de savoir qui a un compte chez
 * nous, à raison d'une adresse essayée par requête.
 */
export default defineEventHandler(async (event) => {
    const parsed = await readValidatedBody(event, (body) => schema.safeParse(body));
    if (!parsed.success) {
        throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' });
    }

    const config = useRuntimeConfig();

    await $fetch.raw(`${config.backendUrl}/users/init-reset-password`, {
        method: 'POST',
        body: parsed.data,
        headers: { 'Content-Type': 'application/json' },
        ignoreResponseError: true,
    });

    return { ok: true };
});

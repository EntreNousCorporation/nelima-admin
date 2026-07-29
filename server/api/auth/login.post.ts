import { createError, defineEventHandler, readValidatedBody } from 'h3';
import { z } from 'zod';
import { getAdminSession, type AdminUser } from '~~/server/utils/auth';

const schema = z.object({
    username: z.string().min(1).max(255),
    password: z.string().min(1).max(255),
});

/**
 * Route dédiée, volontairement hors du proxy générique : c'est la seule qui a le droit
 * de s'exécuter sans session, et la seule qui en ouvre une.
 *
 * Le jeton renvoyé par le backend est scellé dans la session serveur et ne redescend
 * jamais au navigateur — la réponse ne contient que le profil.
 */
export default defineEventHandler(async (event) => {
    const parsed = await readValidatedBody(event, (body) => schema.safeParse(body));
    if (!parsed.success) {
        throw createError({ statusCode: 400, statusMessage: 'Identifiants invalides' });
    }

    const config = useRuntimeConfig();

    const login = await $fetch.raw<{ access_token: string; expired_at: number }>(
        `${config.backendUrl}/auth/login`,
        {
            method: 'POST',
            body: parsed.data,
            headers: { 'Content-Type': 'application/json' },
            ignoreResponseError: true,
        },
    );

    if (login.status !== 200 || !login._data?.access_token) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Identifiant ou mot de passe incorrect',
            data: login._data ?? {},
        });
    }

    const accessToken = login._data.access_token;

    // Le backend ne renvoie que le jeton : on va chercher le profil dans la foulée, pour
    // que le client n'ait jamais à enchaîner deux appels ni à décoder le JWT lui-même.
    const profile = await $fetch.raw<Record<string, any>>(`${config.backendUrl}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        ignoreResponseError: true,
    });

    if (profile.status !== 200 || !profile._data) {
        throw createError({ statusCode: 502, statusMessage: 'Profil utilisateur indisponible' });
    }

    const raw = profile._data;

    // Chaque surface n'accepte qu'un type de compte. Un administrateur YPYit passe par le
    // back-office, un parent par l'application mobile : ni l'un ni l'autre n'a de périmètre
    // établissement, et les laisser entrer ici afficherait une interface sans données ou,
    // pire, les données d'un établissement arbitraire.
    if (raw.userType !== 'ADMIN_USER') {
        throw createError({
            statusCode: 403,
            statusMessage: "Ce back-office est réservé à l'équipe YPYit",
        });
    }

    const user: AdminUser = {
        id: raw.id,
        firstName: raw.firstName,
        lastName: raw.lastName,
        username: parsed.data.username,
    };

    const session = await getAdminSession(event);
    await session.update({
        user,
        accessToken,
        accessExpiresAt: login._data.expired_at,
    });

    return { user };
});

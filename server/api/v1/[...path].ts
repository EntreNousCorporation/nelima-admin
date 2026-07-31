import {
    createError,
    defineEventHandler,
    getMethod,
    getQuery,
    getRequestHeaders,
    getRouterParam,
    readRawBody,
    setResponseHeader,
    setResponseStatus,
} from 'h3';
import { getAdminSession } from '~~/server/utils/auth';

/**
 * En-têtes qu'on ne relaie jamais vers le backend.
 *
 * `cookie` et `authorization` viennent du client, donc potentiellement d'un attaquant :
 * l'authentification se construit ici, à partir de la session scellée. Les autres sont
 * recalculés par la couche HTTP et les transmettre corromprait la requête.
 */
const STRIP_REQUEST_HEADERS = new Set([
    'host', 'connection', 'cookie', 'authorization', 'content-length',
]);

/**
 * `set-cookie` est retiré volontairement : la session du portail doit rester l'unique
 * source de cookies, un cookie posé par le backend court-circuiterait le modèle.
 */
const STRIP_RESPONSE_HEADERS = new Set([
    'connection', 'transfer-encoding', 'content-encoding', 'content-length', 'set-cookie',
]);

/**
 * Proxy authentifié vers le backend Nelima.
 *
 * Le navigateur ne connaît que des URLs `/api/v1/...` du même domaine : il n'a ni jeton,
 * ni URL de backend, et il n'y a aucun CORS à gérer.
 */
export default defineEventHandler(async (event) => {
    const path = getRouterParam(event, 'path') ?? '';

    // Le login a sa route dédiée, qui seule sait ouvrir une session.
    if (path.startsWith('auth/login')) {
        throw createError({ statusCode: 404 });
    }

    const session = await getAdminSession(event);
    if (!session.data.accessToken) {
        throw createError({ statusCode: 401, statusMessage: 'Session expirée' });
    }

    const config = useRuntimeConfig();
    const method = getMethod(event);

    const forwardHeaders: Record<string, string> = {
        Authorization: `Bearer ${session.data.accessToken}`,
    };
    for (const [key, value] of Object.entries(getRequestHeaders(event))) {
        if (!value || STRIP_REQUEST_HEADERS.has(key.toLowerCase())) continue;
        forwardHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }

    // Corps lu brut : un readBody() parserait le JSON et casserait les envois multipart,
    // dont on aura besoin pour l'import de listes d'élèves.
    const rawBody = method === 'GET' || method === 'HEAD'
        ? undefined
        : await readRawBody(event, false);

    // Toujours lu en binaire, puis décodé — ou non — selon ce que le backend annonce.
    //
    // Lire en `text` décodait tout binaire comme de l'UTF-8, ce qui vidait les fichiers
    // téléchargés. Le JSON, lui, doit rester une chaîne pour arriver intact au navigateur.
    const response = await $fetch.raw<ArrayBuffer>(`${config.backendUrl}/${path}`, {
        method: method as any,
        body: rawBody,
        query: getQuery(event) as Record<string, string>,
        headers: forwardHeaders,
        ignoreResponseError: true,
        responseType: 'arrayBuffer',
    });

    setResponseStatus(event, response.status);
    for (const [key, value] of response.headers.entries()) {
        if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
        setResponseHeader(event, key, value);
    }

    // Jeton rejeté par le backend : la session locale ne vaut plus rien, on la purge pour
    // que l'utilisateur reparte proprement sur l'écran de connexion.
    if (response.status === 401) {
        await session.clear();
    }

    if (!response._data || response._data.byteLength === 0) {
        return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const isTextual = /^(application\/(json|.*\+json|xml)|text\/)/i.test(contentType);

    return isTextual
        ? new TextDecoder('utf-8').decode(response._data)
        : Buffer.from(response._data);
});

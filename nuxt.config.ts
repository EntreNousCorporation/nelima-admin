import Aura from '@primeuix/themes/aura';

export default defineNuxtConfig({
    compatibilityDate: '2025-07-01',
    devtools: { enabled: true },

    // SSR maintenu : avec le pattern BFF, serveur et client voient exactement le même
    // état d'authentification, il n'y a donc pas de désynchronisation à l'hydratation.
    ssr: true,

    modules: [
        '@nuxtjs/tailwindcss',
        '@pinia/nuxt',
        '@primevue/nuxt-module',
        '@nuxtjs/i18n',
    ],

    css: ['~/assets/css/main.css'],

    primevue: {
        options: {
            theme: { preset: Aura, options: { darkModeSelector: '.dark' } },
            ripple: true,
        },
    },

    i18n: {
        locales: [{ code: 'fr', language: 'fr-FR', name: 'Français' }],
        defaultLocale: 'fr',
        strategy: 'no_prefix',
    },

    runtimeConfig: {
        // Serveur uniquement. Rien de tout ceci n'est exposé au navigateur : ni l'URL du
        // backend, ni le secret de session.
        backendUrl: process.env.NELIMA_BO_BACKEND_URL || 'https://api.nelima.ci',
        sessionSecret: process.env.NELIMA_BO_SESSION_SECRET
            || 'dev-only-secret-de-32-caracteres-minimum-a-remplacer',
        public: {},
    },

    devServer: { port: 3011 },

    app: {
        head: {
            htmlAttrs: { lang: 'fr' },
            title: 'Nelima — Back-office YPYit',
            meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
        },
    },
});

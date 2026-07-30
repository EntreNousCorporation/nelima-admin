import primeui from 'tailwindcss-primeui';

export default {
    // `media` et non `class` : aucune bascule manuelle n'existe dans l'application, et les
    // variables CSS suivent déjà `prefers-color-scheme`. Avec `class`, les variantes `dark:`
    // n'auraient jamais été appliquées alors que le fond, lui, passait au sombre — bordures
    // noires sur fond noir.
    darkMode: 'media',
    content: [
        './components/**/*.{vue,js,ts}',
        './layouts/**/*.vue',
        './pages/**/*.vue',
        './app.vue',
    ],
    theme: {
        extend: {
            colors: {
                // Reprend les variables CSS plutôt que de redéclarer des valeurs : une seule
                // définition de la palette, et le mode sombre s'applique sans duplication.
                brand: {
                    50: 'var(--brand-50)',
                    100: 'var(--brand-100)',
                    200: 'var(--brand-200)',
                    300: 'var(--brand-300)',
                    500: 'var(--brand-500)',
                    600: 'var(--brand-600)',
                    700: 'var(--brand-700)',
                    900: 'var(--brand-900)',
                },
                surface: {
                    DEFAULT: 'var(--surface)',
                    raised: 'var(--surface-raised)',
                    sunken: 'var(--surface-sunken)',
                },
                line: {
                    DEFAULT: 'var(--border)',
                    strong: 'var(--border-strong)',
                },
                ink: {
                    DEFAULT: 'var(--text)',
                    muted: 'var(--text-muted)',
                    faint: 'var(--text-faint)',
                },
            },
        },
    },
    plugins: [primeui],
};

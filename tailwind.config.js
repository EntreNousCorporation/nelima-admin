import primeui from 'tailwindcss-primeui';

export default {
    darkMode: 'class',
    content: [
        './components/**/*.{vue,js,ts}',
        './layouts/**/*.vue',
        './pages/**/*.vue',
        './app.vue',
    ],
    theme: {
        extend: {
            colors: {
                // Palette Nelima. À figer avec la charte quand elle existera.
                nelima: {
                    50: '#eef7f2', 100: '#d6ebe0', 300: '#8cc9ac',
                    500: '#2f9e68', 600: '#25804f', 700: '#1c6540', 900: '#0f3a25',
                },
            },
        },
    },
    plugins: [primeui],
};

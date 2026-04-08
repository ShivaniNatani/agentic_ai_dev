/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#ffecef',
                    100: '#ffc8d0',
                    400: '#ff5364',
                    500: '#ce1126', // Romania red
                    600: '#a50e1f',
                    900: '#0a0a0d',
                },
                accent: {
                    400: '#f5b700',
                    500: '#ffcc33',
                },
                success: '#22c55e',
                warning: '#f59e0b',
                error: '#f43f5e',
                dark: {
                    900: '#0a0a0d',
                    850: '#0f1015',
                    800: '#12131a',
                    750: '#161823',
                    700: '#191b25',
                },
            },
            fontFamily: {
                sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
                display: ['Space Grotesk', 'system-ui', 'sans-serif'],
                mono: ['IBM Plex Mono', 'monospace'],
            },
            backgroundImage: {
                'gradient-dark': 'linear-gradient(135deg, #0a0a0d 0%, #101018 60%, #0a0a0d 100%)',
                'gradient-glass': 'linear-gradient(135deg, rgba(206, 17, 38, 0.12) 0%, rgba(12, 12, 18, 0.6) 100%)',
                'gradient-primary': 'linear-gradient(135deg, #ce1126 0%, #f5b700 100%)',
            },
            boxShadow: {
                'glow': '0 0 30px rgba(206, 17, 38, 0.35)',
                'glass': '0 16px 36px rgba(0, 0, 0, 0.45), 0 0 24px rgba(206, 17, 38, 0.25)',
            },
            backdropBlur: {
                'glass': '16px',
            },
        },
    },
    plugins: [],
}

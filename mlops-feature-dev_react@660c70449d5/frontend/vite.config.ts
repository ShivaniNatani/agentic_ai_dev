import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const target = env.VITE_API_PROXY_TARGET || 'http://localhost:8510'

    return {
        plugins: [react()],
        server: {
            port: 8715,
            strictPort: true, // fail fast if 8715 is taken instead of choosing a random port
            proxy: {
                '/api': {
                    target,
                    changeOrigin: true,
                },
            },
        },
        build: {
            outDir: 'dist',
            assetsDir: 'assets',
        },
    }
})

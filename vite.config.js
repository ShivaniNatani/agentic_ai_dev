import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [react()],
    server: {
        host: '0.0.0.0', // Expose to Docker
        proxy: {
            '/api/access-control': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
            },
            '/api': {
                target: 'http://localhost:8510',
                changeOrigin: true,
                secure: false,
            }
        }
    }
})

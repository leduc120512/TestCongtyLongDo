import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Web gọi /api cùng origin, Vite chuyển tiếp sang Fastify → không cần CORS.
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
})

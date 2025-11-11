import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const threePath = fileURLToPath(new URL('./node_modules/three', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      three: threePath,
      '@ar-js-org/ar.js/node_modules/three': threePath,
    },
    dedupe: ['three'],
  },
  optimizeDeps: {
    include: ['three'],
    exclude: ['@ar-js-org/ar.js/node_modules/three'],
  },
  server: {
    host: true,
    allowedHosts: ['225566fa6247.ngrok-free.app'],
  },
})

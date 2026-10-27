import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory')) return 'charts'
          if (id.includes('node_modules/react-router')) return 'router'
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react'
          if (id.includes('node_modules/lucide-react')) return 'icons'
        },
      },
    },
  },
})

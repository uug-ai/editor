import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Mediabunny, which reads, cuts and writes the video, is most of the bundle (about 200 kB gzipped).
  build: { chunkSizeWarningLimit: 800 },
  server: {
    host: '0.0.0.0',
    port: 5176,
    strictPort: true,
  },
})

// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.glb'], // ✅ allows .glb 3D model imports
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei']
  },
  server: {
    https: true,
    port: 5178,
    host: true // ✅ allows mobile device access via local network
  }
})

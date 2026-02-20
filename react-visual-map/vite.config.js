import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // App is served by Flask under /react, so built asset URLs must include this base path.
  base: '/react/',
  plugins: [react()],
})

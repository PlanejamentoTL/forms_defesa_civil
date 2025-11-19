import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/forms_defesa_civil/', 
  build: {
    outDir: 'dist'
  }
})

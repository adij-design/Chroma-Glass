import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this as a project site; Vercel serves from the domain root.
  base: process.env.VERCEL ? '/' : '/Chroma-Glass/',
  plugins: [react()],
})

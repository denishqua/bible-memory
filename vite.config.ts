import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Node 22+ ships an experimental global `localStorage` that is only
    // partially initialized without a --localstorage-file path. It shadows
    // jsdom's own (fully functional) localStorage global, breaking anything
    // that calls e.g. `localStorage.clear()`. Disable it in the test worker
    // so jsdom's implementation is the only one in play.
    execArgv: ['--no-experimental-webstorage'],
  },
})

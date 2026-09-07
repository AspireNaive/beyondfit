import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // scripts/seed.ts reuses the front end's fixtures via its `@/` alias.
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/env.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Every file shares one MySQL database, so run files one after another.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
})

import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    
    // Test file patterns
    // cod-shared tests run through this package (no vitest setup there);
    // the include is relative to this config, hence the ../cod-shared path.
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
      '../cod-shared/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],

    // Test timeout configuration
    testTimeout: 15000,
    hookTimeout: 15000,

    // Environment variables for testing
    env: {
      NODE_ENV: 'test',
      VITEST: 'true'
    },

    // Inline the provider so Vite rewrites its `cloudflare:workers` import
    // to the test stub (Node's native loader cannot handle `cloudflare:`).
    server: {
      deps: {
        inline: ['@cloudflare/workers-oauth-provider'],
      },
    },
  },

  // Path aliases for server code
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/db': resolve(__dirname, './src/db'),
      '@/types': resolve(__dirname, './src/types'),
      // Stub the Workers runtime module so @cloudflare/workers-oauth-provider
      // can load under Node in unit tests (see src/test-utils/cloudflare-workers.ts).
      'cloudflare:workers': resolve(__dirname, './src/test-utils/cloudflare-workers.ts'),
    }
  },

  // Define configuration for different test environments
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'test'),
    'process.env.VITEST': JSON.stringify('true')
  }
})
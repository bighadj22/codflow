import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    
    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'
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
    }
  },

  // Path aliases for server code
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/db': resolve(__dirname, './src/db'),
      '@/types': resolve(__dirname, './src/types'),
    }
  },

  // Define configuration for different test environments
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'test'),
    'process.env.VITEST': JSON.stringify('true')
  }
})
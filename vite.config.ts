import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true, // Enable protocol imports including URL-related APIs
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // 🛡️ PROTEÇÃO: Define globals no build para evitar erros de referência
  define: {
    'global': 'globalThis',
  },
  optimizeDeps: {
    include: ['klinecharts'],
    esbuildOptions: {
      // 🛡️ Define globals durante otimização de dependências
      define: {
        global: 'globalThis'
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Split vendor chunks for better caching
          if (id.includes('node_modules')) {
            // Radix UI components
            if (id.includes('@radix-ui')) {
              return 'radix';
            }
            // Material UI
            if (id.includes('@mui') || id.includes('@emotion')) {
              return 'mui';
            }
            // Chart libraries
            if (id.includes('recharts') || id.includes('klinecharts') || id.includes('lightweight-charts')) {
              return 'charts';
            }
            // Supabase
            if (id.includes('@supabase')) {
              return 'supabase';
            }
            // MetaAPI
            if (id.includes('metaapi')) {
              return 'metaapi';
            }
            // React core
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // Other vendors
            return 'vendor';
          }
          
          // Split app code by feature
          if (id.includes('/src/app/components/admin/')) {
            return 'admin';
          }
          if (id.includes('/src/app/components/debug/')) {
            return 'debug';
          }
          if (id.includes('/src/app/components/landing/')) {
            return 'landing';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console.logs for debugging
        drop_debugger: true,
      },
    },
  },
})
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
            // ✅ 2026-07-28: Radix UI ANTES tinha chunk próprio ('radix'), mas
            // isso criava uma dependência circular real com 'vendor' (onde o
            // React vive) — mesma classe de bug já documentada abaixo pro
            // React/vendor, só que esta nunca foi corrigida. Em produção o
            // Rollup ocasionalmente ordena a inicialização com 'radix' rodando
            // ANTES de 'vendor', e como os componentes Radix chamam
            // `React.useLayoutEffect` no topo do módulo, o app quebra com
            // "Cannot read properties of undefined (reading 'useLayoutEffect')"
            // — tela inteira preta, sem log nenhum (confirmado via import()
            // direto do bundle de produção). Fix: Radix cai no mesmo chunk
            // 'vendor' que o React, eliminando o ciclo (mesmo raciocínio do
            // fix react-vendor->vendor já aplicado logo abaixo).
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
            // React core + other vendors share a chunk: splitting them caused a
            // real circular chunk dependency (vendor -> react-vendor -> vendor),
            // which surfaced in production as "Cannot access 'X' before initialization".
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
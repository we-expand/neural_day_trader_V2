/**
 * ⚡ VITE OPTIMIZATIONS - Configuração de Performance
 * 
 * Otimizações para reduzir tempo de build e melhorar performance
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // Babel optimizations
      babel: {
        plugins: [
          // Remove PropTypes em produção
          ['babel-plugin-transform-remove-console', { exclude: ['error', 'warn'] }]
        ]
      }
    })
  ],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  
  // ⚡ BUILD OPTIMIZATIONS
  build: {
    // Aumentar chunk size warning limit
    chunkSizeWarningLimit: 1000,
    
    // Sourcemaps apenas em dev
    sourcemap: false,
    
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log em produção
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'] // Remove funções específicas
      }
    },
    
    // Code splitting manual
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-motion': ['motion'],
          'vendor-charts': ['klinecharts', 'recharts'],
          'vendor-ui': ['lucide-react', 'sonner'],
          
          // Feature chunks
          'feature-ai': [
            './src/app/components/AITrader.tsx',
            './src/app/services/AITradingEngine.ts'
          ],
          'feature-backtest': [
            './src/app/components/backtest/AIvsTraderMode.tsx',
            './src/app/components/backtest/BacktestDecisionsPanel.tsx',
            './src/app/components/backtest/PerformanceComparison.tsx'
          ],
          'feature-chart': [
            './src/app/components/ChartView.tsx'
          ]
        }
      }
    },
    
    // Compression
    target: 'esnext',
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Reportar tamanho dos chunks
    reportCompressedSize: true
  },
  
  // ⚡ OPTIMIZATIONS DEV
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router',
      'motion',
      'klinecharts',
      'lucide-react'
    ],
    exclude: [
      // Excluir módulos grandes que não precisam ser pre-bundled
    ]
  },
  
  // ⚡ SERVER OPTIMIZATIONS
  server: {
    // Cache mais agressivo
    fs: {
      strict: false
    },
    hmr: {
      overlay: false // Desabilitar overlay de erros (performance)
    }
  },
  
  // ⚡ PREVIEW OPTIMIZATIONS
  preview: {
    port: 4173
  }
});

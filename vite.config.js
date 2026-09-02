import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['styled-jsx/babel']
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react')) return 'react';
            if (id.includes('/antd')) return 'antd';
            if (id.includes('/recharts')) return 'recharts';
            if (id.includes('/dayjs')) return 'dayjs';
            return 'vendor';
          }
          if (id.includes('/src/features/instrument-flow/')) return 'instrument-flow';
          if (id.includes('/src/features/instrument-mgmt/')) return 'instrument-mgmt';
          if (id.includes('/src/features/dashboard/')) return 'dashboard';
          if (id.includes('/src/features/statistics/')) return 'statistics';
          if (id.includes('/src/features/system-settings/')) return 'system-settings';
        }
      }
    }
  },
  server: {
    port: 5174,
    // 确保静态HTML文件和React应用路由都能正确工作
    // 添加API代理配置，将/api请求转发到后端服务器
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  // 确保public目录下的静态文件按原样提供，不经过React Router处理
  publicDir: 'public'
});

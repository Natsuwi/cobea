import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { appVersionPlugin, createBuildId } from './src/lib/viteAppVersionPlugin';

const buildId = createBuildId();

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), appVersionPlugin(buildId)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:3847',
          changeOrigin: true,
        },
      },
    },
  };
});

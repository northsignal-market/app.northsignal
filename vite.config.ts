import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Sin esto todo va a un solo bloque de 1,5 MB: abrir la app descarga las cinco
      // pantallas aunque solo se use una. Las librerías pesadas y de uso puntual
      // (gráficos, PDF, captura de pantalla) van aparte y se bajan cuando hacen falta.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;
            if (id.includes('recharts') || id.includes('d3-')) return 'graficos';
            if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('@react-pdf')) return 'pdf';
            if (id.includes('react-dom') || id.includes('/react/')) return 'react';
            if (id.includes('lucide-react')) return 'iconos';
            if (id.includes('zod')) return 'validacion';
            return 'proveedores';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

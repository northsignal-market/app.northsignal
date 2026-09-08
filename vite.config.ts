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
      // React NO se separa en su propio bloque. Cuando estaba separado, lucide-react,
      // recharts, zustand y Radix quedaban en otros bloques y todos dependen de React:
      // Rollup no garantiza el orden, así que un bloque podía ejecutarse antes que el
      // de React, llamarlo cuando todavía no existía, y la app reventaba ANTES de
      // montar. El síntoma era la pantalla de carga infinita, sin login ni error
      // visible, porque el fallo ocurre antes de que React pueda mostrar nada.
      //
      // Solo se separa lo pesado que no participa del arranque.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;
            if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('@react-pdf')) return 'pdf';
            if (id.includes('recharts') || id.includes('d3-')) return 'graficos';
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

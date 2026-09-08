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
      // React NO se separa en su propio bloque, y el resto de node_modules tampoco
      // va a un bloque general.
      //
      // Qué pasaba antes: React quedaba en un bloque y lucide-react, recharts,
      // zustand y Radix en otro. Todos dependen de React, así que Rollup avisaba
      // "Circular chunk: proveedores -> react -> proveedores" y el orden de
      // ejecución dejaba de estar garantizado. Un bloque podía correr antes que
      // el de React, llamarlo cuando todavía no existía, y la app reventaba ANTES
      // de montar: pantalla de carga infinita, sin login y sin error visible.
      //
      // Ahora solo se separa lo pesado que NO participa del arranque: el PDF y los
      // gráficos se descargan al abrir una pantalla que los usa. Se conserva la
      // mayor parte del ahorro de la primera carga sin el riesgo de orden.
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
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

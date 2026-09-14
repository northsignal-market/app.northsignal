import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// defineConfig sale de 'vitest/config' —superset del de vite— para poder declarar
// la sección `test` acá y no partir la configuración en dos archivos.
import {configDefaults, defineConfig} from 'vitest/config';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],

    test: {
      // Los worktrees de .claude/ son copias del repo: traen su propio
      // formato.test.ts y red.test.ts. Sin esto `npm run verificar` corría los 22
      // tests reales MÁS 22 copias congeladas MÁS los de un trabajo ajeno a medio
      // hacer, y se ponía rojo por algo que no tocaste. Peor todavía: una copia
      // vieja que pasa puede tapar que la de verdad fallaría. El gate de la regla
      // 5 solo sirve si mide este árbol y nada más.
      exclude: [...configDefaults.exclude, '**/.claude/**'],
    },

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
      // De ahí la regla que sigue viva: acá SOLO se nombra lo que ninguna pieza
      // del arranque importa. Un bloque manual se comporta como una raíz más para
      // Rollup, y las dependencias compartidas se van a vivir adentro. Eso fue lo
      // que pasó con el viejo bloque 'graficos' (recharts + d3): como recharts
      // necesita React, React terminó ADENTRO de 'graficos', y entonces el entry
      // tenía que importar 417 kB de gráficos para tener React. El bloque pensado
      // para sacar peso del arranque era lo que lo traía.
      //
      // Hoy recharts ya no se nombra: sus dos consumidores (Datos y Semana, dentro
      // de Cuenta) son diferidos, así que Rollup lo deja solo en un bloque
      // compartido entre ambos y no lo toca nadie hasta abrir esas pantallas.
      // React vuelve al entry, que es su lugar. El arranque pasó de 1.601 kB
      // (479 kB gzip) a 575 kB (177 kB gzip).
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // El helper de preload de Vite (`\0vite/preload-helper.js`) es un módulo
            // virtual: no vive en node_modules, así que caía fuera de todas las reglas
            // y quedaba sin bloque asignado. Rollup lo fusionaba entonces dentro del
            // bloque más grande que también lo usa —le tocó 'pdf'— y como el entry
            // importa el helper para resolver cada import() diferido, el entry
            // terminaba importando ESTÁTICAMENTE los 626 kB de PDF. El PDF se
            // descargaba en el arranque para no usarse nunca en el arranque.
            // Darle bloque propio (1 kB) lo saca de esa fusión.
            if (id.includes('vite/preload-helper')) return 'preload';
            if (!id.includes('node_modules')) return;
            if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('@react-pdf')) return 'pdf';
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

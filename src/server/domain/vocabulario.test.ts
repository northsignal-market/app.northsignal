/**
 * El vocabulario que escribe la app tiene que ser el que lee la métrica.
 *
 * `v_tasa_acierto` —con la que el sistema se califica a sí mismo— compara por
 * igualdad EXACTA contra 'Observacion' y contra ('Inferencia','Hipotesis'). Una
 * grafía distinta no da error: crea una opción nueva en el select de Notion y el
 * accionable **desaparece de las dos tasas, sin error y sin fila**. Es el modo de
 * falla declarado de este sistema: un número verosímil calculado sobre menos
 * casos de los que debería.
 *
 * El 14/9/2026 se encontró que los prompts de los agentes decían
 * "Naturaleza = Observación", con tilde, mientras el código escribe sin tilde.
 * Estos tres controles atrapan el regreso de esa familia entera.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NOTION_NATURALEZA } from './notionSchema';

const RAIZ = path.resolve(__dirname, '../../..');
const MIGRACION = path.join(RAIZ, 'supabase/migrations/20260912182011_remote_schema.sql');

/** Quita diacríticos: si el resultado difiere del original, la cadena tenía tilde. */
const sinTilde = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

describe('vocabulario de Naturaleza', () => {
  it('los valores que escribe la app no llevan tilde', () => {
    for (const v of Object.values(NOTION_NATURALEZA)) {
      expect(sinTilde(v), `NOTION_NATURALEZA tiene un valor con tilde: "${v}"`).toBe(v);
    }
  });

  it('los valores de la app son los que v_tasa_acierto compara', () => {
    // La fuente es el DDL del repo, no una lista copiada acá: si alguien cambia la
    // vista, este test lo ve. Si el archivo no está, el test falla en vez de pasar
    // de largo — un control que no puede mirar no aprueba.
    expect(fs.existsSync(MIGRACION), `No está ${MIGRACION}`).toBe(true);
    const sql = fs.readFileSync(MIGRACION, 'utf8');
    const i = sql.indexOf('CREATE OR REPLACE VIEW "public"."v_tasa_acierto"');
    expect(i, 'No se encontró la definición de v_tasa_acierto').toBeGreaterThan(-1);
    const cuerpo = sql.slice(i, i + 4000);

    // Los literales contra los que la vista compara `naturaleza`.
    const literales = new Set(
      [...cuerpo.matchAll(/"naturaleza"\s*=\s*'([^']+)'/g)].map(m => m[1])
        .concat([...cuerpo.matchAll(/ARRAY\[((?:'[^']+'::"text"(?:,\s*)?)+)\]/g)]
          .flatMap(m => [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])))
    );
    expect(literales.size, 'No se extrajo ningún literal de la vista').toBeGreaterThan(0);

    // Los tres que la app puede escribir como clasificación válida tienen que estar.
    for (const v of [NOTION_NATURALEZA.OBSERVACION, NOTION_NATURALEZA.INFERENCIA, NOTION_NATURALEZA.HIPOTESIS]) {
      expect(literales.has(v), `v_tasa_acierto no lee "${v}": ese accionable no entra en ninguna tasa`).toBe(true);
    }
  });

  it('ningún prompt le pide a un agente que escriba Naturaleza con tilde', () => {
    const dirs = [path.join(RAIZ, 'prompts'), path.join(RAIZ, 'docs/prompts/out')];
    const acentuados = ['Observación', 'Inferéncia', 'Hipótesis'];
    const culpables: string[] = [];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.md'))) {
        const t = fs.readFileSync(path.join(dir, f), 'utf8');
        for (const linea of t.split('\n')) {
          // Solo interesa cuando se está NOMBRANDO el valor a escribir, no la prosa
          // castellana ("lo inferido como hipótesis"), que va con tilde y está bien.
          const asigna = /Naturaleza\s*=\s*[`"']?([A-Za-zÁÉÍÓÚáéíóú]+)/.exec(linea);
          if (asigna && acentuados.some(a => a === asigna[1])) {
            culpables.push(`${f}: Naturaleza = ${asigna[1]}`);
          }
        }
      }
    }
    expect(culpables, 'Un prompt pide escribir un valor con tilde que la métrica no lee').toEqual([]);
  });
});

/**
 * copy-standalone.mjs — copia portable de los assets al bundle standalone.
 *
 * Sustituye al `cp -r` de Unix que rompía el build en Windows
 * (`cp: illegal option -- r`). `node:fs.cpSync` hace lo mismo en Linux,
 * macOS y Windows: el destino recibe el CONTENIDO del origen, que es
 * exactamente lo que hacía `cp -r <origen> <destino-padre>/`.
 *
 *   node scripts/copy-standalone.mjs
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NEXT_DIR = join(ROOT, '.next');
const STANDALONE = join(NEXT_DIR, 'standalone');

if (!existsSync(STANDALONE)) {
  console.error(
    `[copy-standalone] ERROR: no existe ${STANDALONE}. ` +
      'Ejecuta `next build` (con `output: "standalone"`) antes de copiar los assets.'
  );
  process.exit(1);
}

/** Pares [origen, destino]: el destino recibe el contenido del origen. */
const COPIES = [
  [join(NEXT_DIR, 'static'), join(STANDALONE, '.next', 'static')],
  [join(ROOT, 'public'), join(STANDALONE, 'public')],
];

for (const [src, dest] of COPIES) {
  if (!existsSync(src)) {
    console.error(`[copy-standalone] ERROR: no existe el origen ${src}.`);
    process.exit(1);
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
  console.log(`[copy-standalone] ${src} -> ${dest}`);
}

console.log('[copy-standalone] assets copiados al bundle standalone.');

// scripts/generate-brand-assets.js
//
// Genera los assets de marca de Shikin (logo, favicon, apple-icon, OG)
// a partir de la imagen fuente del dueño usando sharp.
//
// Uso:
//   bun scripts/generate-brand-assets.js
//   bun scripts/generate-brand-assets.js --src /ruta/a/otra-imagen.jpeg
//
// La fuente verificada: 1408x768 JPEG sin alpha; contenido centrado
// (bbox 536x568 en x=440..968, y=128..688; centro 704,408). El CROP es un
// cuadrado 640x640 centrado en ese contenido (~56px de aire horizontal,
// ~40px vertical). El OG usa la fuente COMPLETA (sin crop).

import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_SRC =
  '/home/elber01/Downloads/WhatsApp Image 2026-10-25 at 10.24.54 PM.jpeg';

// Parse manual de --src (sin dependencias de parsing externas).
function parseArgValue(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

const CROP = { left: 384, top: 88, width: 640, height: 640 };

// [outputPath, builder] — builder recibe la pipeline base (ya con src) y
// devuelve la pipeline terminada lista para .toFile().
const OUTPUTS = [
  ['public/brand/shikin-logo.png', (s) => s.clone().extract(CROP).resize(512, 512).png()],
  ['src/app/icon.png', (s) => s.clone().extract(CROP).resize(512, 512).png()],
  ['src/app/apple-icon.png', (s) => s.clone().extract(CROP).resize(180, 180).png()],
  [
    'public/brand/shikin-og.png',
    (s) => s.clone().resize(1200, 630, { fit: 'cover', position: 'centre' }).png(),
  ],
];

async function main() {
  const srcPath = resolve(parseArgValue('--src') ?? DEFAULT_SRC);
  const source = sharp(srcPath);
  const meta = await source.metadata();
  console.log(`Fuente: ${srcPath}`);
  console.log(`  ${meta.format} ${meta.width}x${meta.height}`);

  mkdirSync('public/brand', { recursive: true });

  for (const [outPath, build] of OUTPUTS) {
    await build(source).toFile(outPath);
  }

  // Auto-verificación: metadata + tamaño de cada salida.
  console.log('\nSalidas generadas:');
  for (const [outPath] of OUTPUTS) {
    const outMeta = await sharp(outPath).metadata();
    const { size } = statSync(outPath);
    console.log(`  ${outPath}: ${outMeta.format} ${outMeta.width}x${outMeta.height} ${size} bytes`);
  }
}

main().catch((err) => {
  console.error(`[generate-brand-assets] ERROR: ${err.message}`);
  process.exitCode = 1;
});

import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const root = new URL('../src/assets/store/', import.meta.url)
// Somente recorte, redução e compressão. Não há geração, retoque facial,
// suavização de pele, alteração de cor ou nitidez artificial.
const photos = [
  { name: 'wagner-boas-vindas', crop: { left: 40, top: 250, width: 1120, height: 670 }, widths: [480, 960] },
  { name: 'wagner-catalogo', crop: { left: 210, top: 220, width: 790, height: 680 }, widths: [360, 720] },
  { name: 'wagner-contato', crop: { left: 250, top: 120, width: 880, height: 880 }, widths: [400, 800] },
  { name: 'fachada', crop: { left: 0, top: 90, width: 1200, height: 1020 }, widths: [480, 960] },
]

for (const { name, crop, widths } of photos) {
  for (const width of widths) {
    const result = await sharp(fileURLToPath(new URL(`originals/${name}.jpg`, root)))
      .rotate().extract(crop).resize({ width, withoutEnlargement: true })
      .webp({ quality: 91, effort: 6 })
      .toFile(fileURLToPath(new URL(`${name}-${width}.webp`, root)))
    console.log(`${name}: ${result.width} × ${result.height}, ${(result.size / 1024).toFixed(1)} KB`)
  }
}

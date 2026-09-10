import sharp from 'sharp'
import { mkdir, copyFile } from 'node:fs/promises'

const files = [
  ['belize', 'Belize - 2,20m 12x308.jpg'],
  ['berlim', 'Berlim - 2,50m 12x339.jpg'],
  ['dallas', 'Dallas - 2,90m 12x359.jpg'],
  ['ferrari', 'Ferrari - 2,20m 12x234.jpg'],
  ['maximo', 'Máximo - 2,30m 12x309.jpeg'],
]
await mkdir('src/assets/products/originals', { recursive: true })
for (const [slug, file] of files) {
  const original = `src/assets/products/originals/${file}`
  if (process.argv[2]) await copyFile(`${process.argv[2]}/${file}`, original)
  // Somente compressão/redimensionamento: preserva toda a foto, sem recorte ou geração.
  for (const width of [480, 740]) {
    await sharp(original).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 84 }).toFile(`src/assets/products/${slug}-${width}.webp`)
  }
}

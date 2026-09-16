import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// As imagens de entrada já receberam tratamento com IA. Aqui só geramos
// versões responsivas, sem novos ajustes de cor, nitidez ou enquadramento.
const root = new URL('../src/assets/products/', import.meta.url)
await mkdir(new URL('enhanced/', root), { recursive: true })
for (const slug of ['belize', 'berlim', 'dallas', 'ferrari', 'maximo']) {
  const source = new URL(`enhanced/${slug}.png`, root)
  for (const width of [480, 720, 800, 1080]) {
    const result = await sharp(fileURLToPath(source)).rotate().resize({ width })
      .webp({ quality: 88, effort: 6 })
      .toFile(fileURLToPath(new URL(`${slug}-enhanced-${width}.webp`, root)))
    console.log(`${slug}: ${result.width} × ${result.height}, ${(result.size / 1024).toFixed(1)} KB`)
  }
}

import sharp from 'sharp'
// Redimensionamento e compressão, preservando o desenho oficial.
for (const width of [128, 384]) {
  await sharp('public/imperio-sofas-logo.png').resize(width).webp({ quality: 90 }).toFile(`public/imperio-sofas-logo-${width}.webp`)
}
await sharp('public/imperio-sofas-logo.png').resize(64).png().toFile('public/favicon.png')

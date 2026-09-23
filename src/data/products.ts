import belize480 from '../assets/products/belize-enhanced-480.webp'
import belize720 from '../assets/products/belize-enhanced-720.webp'
import belize800 from '../assets/products/belize-enhanced-800.webp'
import belize1080 from '../assets/products/belize-enhanced-1080.webp'
import berlim480 from '../assets/products/berlim-enhanced-480.webp'
import berlim720 from '../assets/products/berlim-enhanced-720.webp'
import berlim800 from '../assets/products/berlim-enhanced-800.webp'
import berlim1080 from '../assets/products/berlim-enhanced-1080.webp'
import dallas480 from '../assets/products/dallas-enhanced-480.webp'
import dallas720 from '../assets/products/dallas-enhanced-720.webp'
import dallas800 from '../assets/products/dallas-enhanced-800.webp'
import dallas1080 from '../assets/products/dallas-enhanced-1080.webp'
import ferrari480 from '../assets/products/ferrari-enhanced-480.webp'
import ferrari720 from '../assets/products/ferrari-enhanced-720.webp'
import ferrari800 from '../assets/products/ferrari-enhanced-800.webp'
import ferrari1080 from '../assets/products/ferrari-enhanced-1080.webp'
import maximo480 from '../assets/products/maximo-enhanced-480.webp'
import maximo720 from '../assets/products/maximo-enhanced-720.webp'
import maximo800 from '../assets/products/maximo-enhanced-800.webp'
import maximo1080 from '../assets/products/maximo-enhanced-1080.webp'

type ImportedAsset = string | { src: string }

const assetUrl = (asset: ImportedAsset) => typeof asset === 'string' ? asset : asset.src

// Fotos reais enviadas em 10/09/2026. Medidas e parcelas transcritas dos nomes dos arquivos.
// Não presumir tecido, número de lugares ou parcelamento sem juros.
export const products = [
  {
    name: 'Sofá Belize', size: '2,20 m', price: '12x de R$ 308,00',
    image: assetUrl(belize800),
    srcSet: `${assetUrl(belize480)} 480w, ${assetUrl(belize720)} 720w, ${assetUrl(belize800)} 800w, ${assetUrl(belize1080)} 1080w`,
    objectPosition: 'center 65%',
    alt: 'Sofá Belize de 2,20 m fotografado no showroom',
  },
  {
    name: 'Sofá Berlim', size: '2,50 m', price: '12x de R$ 339,00',
    image: assetUrl(berlim800),
    srcSet: `${assetUrl(berlim480)} 480w, ${assetUrl(berlim720)} 720w, ${assetUrl(berlim800)} 800w, ${assetUrl(berlim1080)} 1080w`,
    objectPosition: 'center 65%',
    alt: 'Sofá Berlim de 2,50 m fotografado no showroom',
  },
  {
    name: 'Sofá Dallas', size: '2,90 m', price: '12x de R$ 359,00',
    image: assetUrl(dallas800),
    srcSet: `${assetUrl(dallas480)} 480w, ${assetUrl(dallas720)} 720w, ${assetUrl(dallas800)} 800w, ${assetUrl(dallas1080)} 1080w`,
    objectPosition: 'center 65%',
    alt: 'Sofá Dallas de 2,90 m fotografado no showroom',
  },
  {
    name: 'Sofá Ferrari', size: '2,20 m', price: '12x de R$ 234,00',
    image: assetUrl(ferrari800),
    srcSet: `${assetUrl(ferrari480)} 480w, ${assetUrl(ferrari720)} 720w, ${assetUrl(ferrari800)} 800w, ${assetUrl(ferrari1080)} 1080w`,
    objectPosition: 'center 95%',
    alt: 'Sofá Ferrari de 2,20 m fotografado no showroom',
  },
  {
    name: 'Sofá Máximo', size: '2,30 m', price: '12x de R$ 309,00',
    image: assetUrl(maximo800),
    srcSet: `${assetUrl(maximo480)} 480w, ${assetUrl(maximo720)} 720w, ${assetUrl(maximo800)} 800w, ${assetUrl(maximo1080)} 1080w`,
    objectPosition: 'center 100%',
    alt: 'Sofá Máximo de 2,30 m fotografado no showroom',
  },
] as const

import welcome480 from '../assets/store/wagner-boas-vindas-480.webp'
import welcome960 from '../assets/store/wagner-boas-vindas-960.webp'
import catalog360 from '../assets/store/wagner-catalogo-360.webp'
import catalog720 from '../assets/store/wagner-catalogo-720.webp'
import contact400 from '../assets/store/wagner-contato-400.webp'
import contact800 from '../assets/store/wagner-contato-800.webp'
import facade480 from '../assets/store/fachada-480.webp'
import facade960 from '../assets/store/fachada-960.webp'

const photos = {
  welcome: { src: welcome960, srcSet: `${welcome480} 480w, ${welcome960} 960w`, width: 1120, height: 670, alt: 'Wagner, dono da Império Sofás, sorrindo e recebendo você de braços abertos' },
  catalog: { src: catalog720, srcSet: `${catalog360} 360w, ${catalog720} 720w`, width: 790, height: 680, alt: 'Wagner olhando e apontando para os modelos de sofás acima' },
  contact: { src: contact800, srcSet: `${contact400} 400w, ${contact800} 800w`, width: 880, height: 880, alt: 'Wagner sorrindo e apontando para a direita, em direção ao convite para conversar' },
  facade: { src: facade960, srcSet: `${facade480} 480w, ${facade960} 960w`, width: 1200, height: 1020, alt: 'Fachada da Império Sofás Vale, com a placa da loja e a entrada do showroom na Avenida Cinderela, 2011' },
} as const

export function StorePhoto({ photo, sizes, className, priority = false }: {
  photo: keyof typeof photos
  sizes: string
  className?: string
  priority?: boolean
}) {
  return <img {...photos[photo]} sizes={sizes} className={className} loading={priority ? 'eager' : 'lazy'} decoding="async" fetchPriority={priority ? 'high' : undefined} />
}

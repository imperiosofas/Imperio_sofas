import berlim640 from '../assets/sofa-berlim-640.webp'
import berlim1280 from '../assets/sofa-berlim-1280.webp'
import carina640 from '../assets/sofa-carina-640.webp'
import carina1280 from '../assets/sofa-carina-1280.webp'
import nobile640 from '../assets/sofa-nobile-640.webp'
import nobile1280 from '../assets/sofa-nobile-1280.webp'
import verona640 from '../assets/sofa-verona-640.webp'
import verona1280 from '../assets/sofa-verona-1280.webp'
import palazzo640 from '../assets/sofa-palazzo-640.webp'
import palazzo1280 from '../assets/sofa-palazzo-1280.webp'

// TODO: Produtos, fotos e preços abaixo são placeholders. Substitua pelos itens reais da loja.
export const products = [
  { name: 'Sofá Berlim', tone: 'Linho areia', detail: 'Retrátil • 4 lugares', price: 'a partir de R$ 2.490', image: berlim1280, srcSet: `${berlim640} 640w, ${berlim1280} 1280w` },
  { name: 'Sofá Carina', tone: 'Veludo terracota', detail: 'Reclinável • 3 lugares', price: 'a partir de R$ 2.290', image: carina1280, srcSet: `${carina640} 640w, ${carina1280} 1280w` },
  { name: 'Sofá Nobile', tone: 'Bouclé verde', detail: 'Modular • com chaise', price: 'a partir de R$ 3.190', image: nobile1280, srcSet: `${nobile640} 640w, ${nobile1280} 1280w` },
  { name: 'Sofá Verona', tone: 'Linho azul', detail: 'Compacto • 3 lugares', price: 'a partir de R$ 1.990', image: verona1280, srcSet: `${verona640} 640w, ${verona1280} 1280w` },
  { name: 'Sofá Palazzo', tone: 'Suede grafite', detail: 'Retrátil • 4 lugares', price: 'a partir de R$ 2.790', image: palazzo1280, srcSet: `${palazzo640} 640w, ${palazzo1280} 1280w` },
] as const

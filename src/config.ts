// Único ponto de configuração do WhatsApp. Troque somente este valor quando necessário.
export const WHATSAPP_NUMBER = '5512997148386'

export const STORE = {
  name: 'Império Sofás',
  instagram: 'https://www.instagram.com/imperiosofasvale',
  address: 'Av. Cinderela, 2011 — Jardim Gurilândia, Taubaté/SP',
  postalCode: '12071-500',
  mapsUrl: 'https://www.google.com/maps/place/Imp%C3%A9rio+Sof%C3%A1s/@-23.0096683,-45.5260132,17z/data=!4m7!3m6!1s0x94ccf941f45d53fb:0xc891aa62d7a4511b!8m2!3d-23.0096683!4d-45.5260132!16s%2Fg%2F11p6pb4npq',
  mapEmbedUrl: 'https://www.google.com/maps?q=Av.%20Cinderela%2C%202011%2C%20Taubat%C3%A9%20SP&output=embed',
} as const

export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

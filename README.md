# Império Sofás Vale — landing page

Landing page estática em Vite + React + TypeScript, com Tailwind CSS, Framer Motion, Lenis, Swiper e ícones Lucide.

## Rodar localmente

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Para gerar a versão de produção:

```bash
npm run build
npm run preview
```

## Trocar o WhatsApp

O número existe em um único lugar: `src/config.ts`, constante `WHATSAPP_NUMBER`. Use somente dígitos, com código do país e DDD.

## Trocar produtos, fotos e preços

1. Coloque as novas imagens em `src/assets/`, preferencialmente em WebP.
2. Edite `src/data/products.ts` e atualize nome, tecido, descrição, preço, imagem e `srcSet`.
3. Os itens atuais estão marcados no código como `TODO` porque são exemplos fictícios.

As imagens atuais foram geradas por IA para uso como placeholder. As versões WebP em 640/1280 px (e 768/1536 px no hero) ajudam a reduzir o download em celulares.

## Atualizar avaliações e informações da loja

- Avaliações: `src/sections/Reviews.tsx`.
- Endereço, CEP, links do Maps e Instagram: `src/config.ts`.
- Horários: `src/sections/Location.tsx` e JSON-LD em `index.html`.
- Diferenciais: `src/sections/Differentials.tsx`.

Dados verificados no Google Maps em 03/09/2026: nota 4,8 (140 avaliações), endereço Av. Cinderela, 2011 — Jardim Gurilândia, Taubaté/SP, CEP 12071-500; segunda a sexta, 9h–18h; sábado, 9h–13h; domingo fechado.

### Divergências encontradas

O Google Maps exibe o telefone `(12) 99218-0333`, enquanto o briefing confirma o WhatsApp comercial `(12) 99714-8286`. A landing page usa o WhatsApp confirmado. O CEP informado inicialmente (`12081-670`) também diverge do cadastro atual do Maps (`12071-500`); foi adotado o CEP do Maps. Confirme esses dois dados com a loja antes da publicação final.

## Logo e conteúdo provisório

O monograma no componente `src/components/Brand.tsx` é temporário e está marcado com `TODO`. Substitua-o pelo brasão oficial em SVG/WebP quando o arquivo da marca estiver disponível.

Modelos, preços e imagens do catálogo são ilustrativos. Os cinco diferenciais seguem o briefing fornecido e devem passar pela validação comercial da marca antes da publicação.

## SEO e imagem social

Metatags e JSON-LD ficam em `index.html`. Depois de publicar em domínio próprio, troque o valor de `og:image` por uma URL absoluta do arquivo `public/og.webp`.

## Deploy

### Vercel

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

### Netlify

- Build command: `npm run build`
- Publish directory: `dist`

Não é necessário servidor ou SSR.

# Império Sofás Vale — landing page

Landing page estática em Vite + React + TypeScript, com Tailwind CSS, Framer Motion, Lenis, Swiper e ícones Lucide.

## Rodar localmente

Requer Node.js 24. O banco local requer Docker Desktop.

```bash
npm ci
npm run dev
```

### Banco local e migrations

O app usa o adaptador local de rascunhos por padrão. Para iniciar o Supabase local e validar migrations e regras de acesso:

```bash
npx supabase start
npm run db:reset
npm run db:test
```

`npm run db:reset` recria somente o banco Supabase local, reaplicando migrations e seed. Não passe uma URL remota nesse fluxo. Para apontar o app ao Supabase local, defina `CATALOG_SOURCE=supabase`, `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` e a chave publishable exibida por `npx supabase status`.

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
3. O catálogo contém os cinco modelos reais enviados em 10/09/2026: Belize (2,20 m, 12x R$ 308), Berlim (2,50 m, 12x R$ 339), Dallas (2,90 m, 12x R$ 359), Ferrari (2,20 m, 12x R$ 234) e Máximo (2,30 m, 12x R$ 309). As parcelas foram transcritas dos nomes dos arquivos, sem presumir ausência de juros.

As fotos do catálogo ficam em `src/assets/products/`, com originais preservados em `originals/` e versões tratadas por IA em `enhanced/`. O prompt e a procedência estão em `enhanced/README.md`. Para regenerar os WebP responsivos de 480/720/800/1080 px, execute `node scripts/optimize-enhanced-products.mjs`. O carrossel usa proporção 11:10, sem o selo “Foto real” e sem faixas pretas, com enquadramento individual em `objectPosition` para priorizar cada sofá. O tratamento busca clareza e iluminação natural preservando modelo e ambiente; os originais continuam disponíveis para comparação. A imagem do hero continua ilustrativa, gerada por IA, em 768/1536 px.

## Atualizar avaliações e informações da loja

- Avaliações: `src/sections/Reviews.tsx`.
- Endereço, CEP, links do Maps e Instagram: `src/config.ts`.
- Horários: `src/sections/Location.tsx` e JSON-LD em `index.html`.
- Diferenciais: `src/sections/Differentials.tsx`.

Dados verificados no Google Maps em 03/09/2026: nota 4,8 (140 avaliações), endereço Av. Cinderela, 2011 — Jardim Gurilândia, Taubaté/SP, CEP 12071-500; segunda a sexta, 9h–18h; sábado, 9h–13h; domingo fechado.

### Divergências encontradas

O Google Maps exibe o telefone `(12) 99218-0333`, enquanto o briefing confirma o WhatsApp comercial `(12) 99714-8286`. A landing page usa o WhatsApp confirmado. O CEP informado inicialmente (`12081-670`) também diverge do cadastro atual do Maps (`12071-500`); foi adotado o CEP do Maps. Confirme esses dois dados com a loja antes da publicação final.

## Logo e conteúdo provisório

A logo oficial recebida em 08/09/2026 aparece no cabeçalho, hero e rodapé. O original está em `public/imperio-sofas-logo.png`; versões WebP de 128 e 384 px pesam aproximadamente 3,5 KB e 11,4 KB. Para regenerar as versões: `node scripts/optimize-logo.mjs`. O desenho original é preservado; o recorte circular é feito somente na apresentação por CSS.

### Movimento adaptativo

`src/lib/useEnhancedMotion.ts` habilita efeitos avançados somente a partir de 1024 px, com mouse e sem preferência por movimento reduzido. Em mobile há rolagem nativa, carrossel plano, conteúdo imediatamente visível e menu com fade curto. Lenis é importado somente quando necessário no desktop. Parallax e observadores dos componentes Reveal não são montados em mobile. Camadas de blur, textura e sombras do carrossel são removidas nesse modo.

Verificação: build e lint passaram. Na revisão das fotos do Wagner, a página foi conferida em 320, 390 e 1440 px; as quatro novas fotos carregaram sem distorção. O mapa foi testado fechado, aberto e fechado novamente, e só é montado ao solicitar. A navegação dos cinco modelos foi validada na revisão anterior do catálogo. Não foi realizado benchmark em celular físico.

### Fotografias do Wagner e da fachada

As quatro fotos recebidas em 11/09/2026 estão integradas à página: braços abertos na abertura; apontando para cima no apoio ao catálogo; apontando para a direita à esquerda do convite final no desktop; fachada na seção de visita. No celular, o conteúdo é empilhado, com botões acessíveis e fotografias em proporções próprias, sem esticar rostos nem cortar as mãos.

Os rostos não foram tratados por IA. Aplicamos somente recortes retangulares, redução de tamanho e compressão WebP, sem retoque, filtros de pele ou reconstrução generativa. Os originais ficam em `src/assets/store/originals/`, e o processamento reproduzível em `scripts/optimize-store-photos.mjs`. Execute `node scripts/optimize-store-photos.mjs` para regenerar as oito versões responsivas. As versões menores das quatro fotos somam aproximadamente 74 KB; o mapa só é carregado quando o visitante solicita sua abertura.

`src/components/StorePhoto.tsx` centraliza proporções, textos alternativos, tamanhos e prioridades de carregamento. As fotos abaixo da primeira tela usam carregamento tardio. Os textos de apresentação são redação do site, sem atribuir uma fala fictícia ao Wagner.

Modelos, medidas, parcelas e fotos do catálogo correspondem aos arquivos enviados pelo cliente. Os cinco diferenciais seguem o briefing fornecido e devem passar pela validação comercial da marca antes da publicação.

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

# PERF-01 — Imagens do catálogo (2026-11-25)

Ambiente: só TESTE/staging (`imperio-sofas-woad.vercel.app` + Supabase TESTE).
Produção não foi tocada.

## 1. Solução

O bucket `catalog-images` **continua privado**. A loja passa a mostrar as fotos por
`/media/catalog/<caminho no storage>`, uma rota deste site que baixa a foto com a
chave anônima, sem sessão. Quem decide o que pode ser entregue é a mesma policy de
storage que já existia ("published catalog images are readable"): só fotos de
produto **publicado**, em categoria ativa e com estoque. Nenhuma policy foi alterada.

- URL estável por foto → cache na Vercel CDN, no navegador e no otimizador do Next.
- O Next.js redimensiona e converte (WebP; larguras 384–1280 px; qualidade 75, e 80
  na foto principal do produto). Antes o celular baixava o original (~100 KB) para
  um card de ~170 px.
- Primeiras imagens com `priority` + `fetchPriority="high"`; as demais com lazy
  loading.
- Painel admin, upload, edição e exclusão: sem mudança (continuam com URL assinada e
  restritos a administradores pelas policies de storage).

Arquivos: `src/app/media/catalog/[...path]/route.ts`,
`src/features/catalog/image-url.ts`, `next.config.ts` (`images`).

## 2. Verificações de segurança

Feitas em build local e de novo no staging, com produto temporário (removido no
fim). Bucket conferido antes: 122 arquivos, todos WebP de produtos, nenhum documento
ou arquivo de cliente; 20 são de produtos em rascunho.

| Caso                                                                     | Resultado                                           |
| ------------------------------------------------------------------------ | --------------------------------------------------- |
| Foto de produto publicado                                                | 200, `image/webp`, sem cookie                       |
| Foto de produto em rascunho (rota e otimizador)                          | 404, `no-store`                                     |
| Produto despublicado (origem)                                            | 404 imediato para qualquer pedido que chegue à rota |
| Produto despublicado (cópia já na CDN)                                   | continua servida até expirar o cache — ver §3       |
| Arquivo inexistente                                                      | 404                                                 |
| Arquivo registrado mas que não é imagem                                  | 404 (formato conferido pelos primeiros bytes)       |
| Caminhos inválidos (`..`, não-UUID, `.svg`, outra pasta, extensão dupla) | 404                                                 |
| Foto do produto A pedida com o ID do produto B                           | 404                                                 |
| Query string (`?x=`)                                                     | não amplia acesso (rascunho continua 404)           |
| Cliente tentando upload no storage                                       | negado pela policy (E2E D5b)                        |
| Admin: criar produto, enviar foto, rejeitar arquivo falso, excluir       | OK (E2E D2, D4, D4b, D7)                            |

## 3. Cache e tempo máximo de exposição após despublicar

| Camada                                                 | Duração                           |
| ------------------------------------------------------ | --------------------------------- |
| Resposta da rota na Vercel CDN (`s-maxage`)            | 30 min                            |
| Cópia redimensionada do otimizador (`minimumCacheTTL`) | 30 min                            |
| Navegador de quem já viu a foto (`max-age`)            | 30 min (cópia local dessa pessoa) |

Pior caso teórico: a cópia redimensionada pode ser gerada a partir do original ainda
em cache na CDN, então uma foto pode continuar acessível por **até 60 min** depois de
despublicar o produto. Qualquer endereço novo (outra largura, outra query) já
devolve 404 na hora. 404 nunca é cacheado (`no-store`), então ao publicar a foto
aparece imediatamente.

Medição real no staging: ver §5.

## 4. Antes × depois

Mesmas páginas, mesmo script (`imgperf.cjs`), mesmas condições: celular 412×823,
DPR 1.75, rede "Slow 4G" (150 ms RTT, 1.6 Mbps / 750 kbps), CPU 4×; 3 visitas a frio
(mediana) + 1 segunda visita com o mesmo navegador.

### Primeira visita (mediana de 3)

| Página                          | LCP antes | LCP depois | Carregamento antes | depois    | Transferido antes | depois     | Imagens antes | depois     |
| ------------------------------- | --------- | ---------- | ------------------ | --------- | ----------------- | ---------- | ------------- | ---------- |
| `/loja`                         | 3,2 s     | **2,1 s**  | 5,9 s              | **3,6 s** | 1018 KB           | **515 KB** | 653 KB        | **149 KB** |
| `/loja/sofas`                   | 3,5 s     | **1,9 s**  | 6,3 s              | **3,4 s** | 1135 KB           | **520 KB** | 769 KB        | **156 KB** |
| `/produto/poltrona-josy`        | 5,9 s     | **2,8 s**  | 7,9 s              | **3,1 s** | 1485 KB           | **476 KB** | 1120 KB       | **112 KB** |
| `/` (imagens locais, não mudou) | 2,8 s     | 2,5 s      | 3,6 s              | 3,2 s     | 532 KB            | 530 KB     | 79 KB         | 78 KB      |

### Segunda visita (cache do navegador)

| Página                   | Imagens do cache antes | depois       | Transferido antes | depois    | LCP antes | depois    |
| ------------------------ | ---------------------- | ------------ | ----------------- | --------- | --------- | --------- |
| `/loja`                  | 0 de 11                | **10 de 11** | 677 KB            | **22 KB** | 1,3 s     | **0,8 s** |
| `/loja/sofas`            | 0 de 11                | **10 de 11** | 791 KB            | **20 KB** | 3,2 s     | **1,1 s** |
| `/produto/poltrona-josy` | 0 de 12                | **12 de 13** | 1135 KB           | **17 KB** | 5,7 s     | **1,2 s** |

Em cada página uma imagem não veio do cache na segunda visita; ela não foi
identificada nesta medição (o total transferido mostra que é pequena).

### CDN

Antes: toda foto vinha de link assinado novo → `MISS` sempre. Depois: 1º pedido
`MISS`, seguintes `HIT`, tanto na rota quanto na versão redimensionada.

### Lighthouse mobile (configuração padrão, 2 execuções)

| Página                     | Score antes | depois    | LCP antes | depois        | Peso antes | depois     |
| -------------------------- | ----------- | --------- | --------- | ------------- | ---------- | ---------- |
| `/loja`                    | 69–73       | **79–83** | 6,8–7,2 s | **3,1–3,2 s** | 1071 KB    | **545 KB** |
| `/produto/sofas-sofa-doha` | 81–86       | 79–82     | 3,5 s     | **3,0–3,1 s** | 418 KB     | 402 KB     |

## 5. Exposição medida após despublicar (staging)

Produto temporário publicado, rota e versão redimensionada aquecidas na CDN (`MISS`
→ `HIT`), depois despublicado. Verificação a cada 2 min:

| Tempo após despublicar | Rota (original)              | Versão redimensionada | Endereço novo |
| ---------------------- | ---------------------------- | --------------------- | ------------- |
| 0 min                  | 200 (`HIT`)                  | 200 (`HIT`)           | 404           |
| 2 → 28 min             | 200 (`HIT`, idade crescente) | 200 (`HIT`)           | —             |
| **30,1 min**           | **404**                      | **404**               | —             |

Resultado: neste teste as duas cópias deixaram de ser servidas em **30 min**. O
limite documentado continua **60 min** para o pior caso (versão redimensionada
gerada perto do fim do cache do original). Produto temporário removido; contagens
voltaram ao normal (63 produtos, 105 variações, 122 fotos).

## 6. Observações

- As medições "depois" pegaram a CDN parcialmente aquecida (é o comportamento real
  em produção: as fotos mais vistas ficam em cache).
- **Cota de otimização de imagens da Vercel (decisão para produção):** cada
  combinação foto × largura × qualidade é uma transformação, e ela é refeita quando
  o cache de 30 min expira. Uma foto muito vista pode ser transformada até ~48 vezes
  por dia em cada largura. O limite do plano da Vercel não foi conferido. Antes do
  go-live: acompanhar o uso no painel da Vercel com tráfego real. Se ficar perto do
  limite, as saídas são aumentar o cache (o que aumenta na mesma proporção o tempo
  de exposição após despublicar) ou subir de plano.
- Em produção será preciso o mesmo deploy de código; nenhuma mudança de banco ou de
  bucket é necessária.

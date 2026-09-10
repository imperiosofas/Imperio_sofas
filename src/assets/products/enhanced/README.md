# Tratamento das fotografias

Edição com a ferramenta integrada image_gen em 10/09/2026, uma chamada por foto original. Os arquivos originais permanecem em ../originals/.

Arquivos: belize.png, berlim.png, dallas.png, ferrari.png e maximo.png. Versões para o site: ../{modelo}-enhanced-{480,800,1080}.webp, geradas com `node scripts/optimize-enhanced-products.mjs`.

## Prompt aplicado a cada fotografia

Use case: lighting-weather. Asset type: authentic furniture shop product photograph, subtle restoration only. Image 1 is the edit target, not a style reference. Make a VERY CONSERVATIVE photographic quality enhancement: modestly improve clarity, reduce JPEG artifacts and noise, gently balance exposure and white balance, maintain natural fabric texture. This must remain the SAME photograph. STRICT INVARIANTS: preserve the exact sofa model, silhouette, proportions, every seam/button/cushion/fold, upholstery color, legs, arms and all background objects including neighboring sofas, walls, furniture, floor, windows and outlets. Preserve exact camera perspective, framing and aspect ratio. No adding, removing, replacing, repositioning or redesigning anything. No studio staging, no new environment, no fake fine detail, no plastic smoothing, no HDR, no dramatic color grading, no text or badges. Keep the complete original photograph. Output a single faithful enhanced photo, at approximately 1536 pixels on its long edge.

Em cada chamada foi acrescentado `Product identifier for this edit: {modelo}.` e fornecida somente a fotografia original do modelo correspondente.

O enquadramento dos cards é feito em CSS; os PNGs preservam a proporção completa. A revisão visual verifica modelo, cor, almofadas, braços, pés e disposição do showroom. A edição generativa não é uma restauração pixel a pixel: as fontes originais foram preservadas para comparação.

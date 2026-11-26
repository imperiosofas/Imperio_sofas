// Catalog CSV validator — DRY RUN ONLY. Reads a CSV (one row per variant) and
// the image folder, applies the same rules as the database (supabase
// migrations) plus spreadsheet checks, and writes a report of accepted and
// rejected rows. It never connects to a database and never writes data.
//
// Usage:
//   node scripts/catalog/validate-catalog-csv.mjs <arquivo.csv>
//     [--images=<pasta>] [--categories=sofas,colchoes] [--out=<pasta>]
// Exit code: 0 = all rows accepted, 2 = some rows rejected, 1 = unusable input.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const COLUMNS = [
  "categoria_slug",
  "produto_slug",
  "produto_nome",
  "produto_descricao",
  "produto_status",
  "sku",
  "largura_cm",
  "profundidade_cm",
  "altura_cm",
  "tecido",
  "cor",
  "preco",
  "estoque",
  "estoque_minimo",
  "imagens",
  "texto_alternativo",
];
const REQUIRED = [
  "categoria_slug",
  "produto_slug",
  "produto_nome",
  "sku",
  "estoque",
];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // bucket limit (catalog-images)
const STATUS = { rascunho: "draft", publicado: "active", "": "draft" };

/** Minimal RFC 4180 parser; separator auto-detected (; or ,). */
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep =
    (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length
      ? ";"
      : ",";
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return { sep, rows: rows.filter((r) => r.some((c) => c.trim() !== "")) };
}

/** "1.299,90" / "1299,90" / "1299.90" / "R$ 1.299,90" → 129990 cents, or null. */
export function parsePrice(raw) {
  let s = String(raw ?? "")
    .replace(/R\$\s?/i, "")
    .trim();
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return Number.NaN;
  return Math.round(Number(s) * 100);
}

function parseCm(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(",", ".");
  if (!s) return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return Number.NaN;
  return Math.round(Number(s) * 10); // mm
}

function parseInteger(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  return /^\d+$/.test(s) ? Number(s) : Number.NaN;
}

function imageKind(bytes) {
  if (
    bytes.length >= 12 &&
    bytes.toString("latin1", 0, 4) === "RIFF" &&
    bytes.toString("latin1", 8, 12) === "WEBP"
  )
    return "webp";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes.toString("latin1", 1, 4) === "PNG"
  )
    return "png";
  return null;
}

/**
 * @param {string} text CSV content
 * @param {{ imagesDir?: string, categories?: string[] }} options
 */
export function validateCatalogCsv(text, options = {}) {
  const { rows } = parseCsv(text);
  if (!rows.length)
    return { fatal: "Arquivo vazio.", rows: [], products: [], warnings: [] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missingColumns = COLUMNS.filter((c) => !header.includes(c));
  if (missingColumns.length)
    return {
      fatal: `Colunas ausentes: ${missingColumns.join(", ")}`,
      rows: [],
      products: [],
      warnings: [],
    };

  const warnings = [];
  const categories = options.categories?.length
    ? new Set(options.categories)
    : null;
  if (!categories)
    warnings.push(
      "Categorias não conferidas: informe --categories=<slugs existentes>.",
    );
  if (!options.imagesDir)
    warnings.push("Imagens não conferidas: informe --images=<pasta>.");

  const results = rows.slice(1).map((cells, index) => {
    const line = index + 2; // header is line 1
    const get = (col) => (cells[header.indexOf(col)] ?? "").trim();
    const r = Object.fromEntries(COLUMNS.map((c) => [c, get(c)]));
    const errors = [];
    for (const col of REQUIRED) if (!r[col]) errors.push(`${col} obrigatório`);
    if (r.categoria_slug && !SLUG.test(r.categoria_slug))
      errors.push("categoria_slug inválido");
    if (r.categoria_slug && categories && !categories.has(r.categoria_slug))
      errors.push(`categoria "${r.categoria_slug}" não existe`);
    if (r.produto_slug && !SLUG.test(r.produto_slug))
      errors.push("produto_slug inválido (minúsculas, números e hífen)");
    if (r.produto_nome && r.produto_nome.length > 180)
      errors.push("produto_nome com mais de 180 caracteres");
    const status = STATUS[r.produto_status.toLowerCase()];
    if (status === undefined)
      errors.push('produto_status deve ser "rascunho" ou "publicado"');
    if (r.sku && !SKU.test(r.sku))
      errors.push("sku inválido (letras, números, . _ -)");

    const price = parsePrice(r.preco);
    if (Number.isNaN(price)) errors.push(`preco inválido: "${r.preco}"`);
    else if (price !== null && price <= 0)
      errors.push("preco deve ser maior que zero");
    const stock = parseInteger(r.estoque);
    if (Number.isNaN(stock)) errors.push("estoque deve ser número inteiro ≥ 0");
    const minStock = parseInteger(r.estoque_minimo);
    if (Number.isNaN(minStock))
      errors.push("estoque_minimo deve ser número inteiro ≥ 0");
    const dims = {};
    for (const [col, key] of [
      ["largura_cm", "width_mm"],
      ["profundidade_cm", "depth_mm"],
      ["altura_cm", "height_mm"],
    ]) {
      const mm = parseCm(r[col]);
      if (Number.isNaN(mm) || mm === 0) errors.push(`${col} inválido`);
      dims[key] = Number.isNaN(mm) ? null : mm;
    }
    if (status === "active") {
      if (price === null) errors.push("produto publicado exige preco");
      if (dims.width_mm === null)
        errors.push("produto publicado exige largura_cm");
    }

    const images = r.imagens
      ? r.imagens
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    for (const file of images) {
      if (!IMAGE_EXT.has(extname(file).toLowerCase())) {
        errors.push(`imagem "${file}": formato não aceito (jpg, png, webp)`);
        continue;
      }
      if (!options.imagesDir) continue;
      const full = join(options.imagesDir, file);
      if (!existsSync(full)) {
        errors.push(`imagem "${file}" não encontrada`);
        continue;
      }
      const size = statSync(full).size;
      if (size > MAX_IMAGE_BYTES)
        errors.push(`imagem "${file}" maior que 10 MB`);
      const kind = imageKind(readFileSync(full).subarray(0, 16));
      if (!kind) errors.push(`imagem "${file}" não é uma imagem válida`);
    }
    if (images.length && !r.texto_alternativo)
      errors.push("texto_alternativo obrigatório quando há imagens");
    if (r.texto_alternativo.length > 300)
      errors.push("texto_alternativo com mais de 300 caracteres");

    return {
      line,
      sku: r.sku,
      product: r.produto_slug,
      status,
      price_cents: Number.isNaN(price) ? null : price,
      on_hand: Number.isNaN(stock) ? null : stock,
      low_stock_threshold:
        Number.isNaN(minStock) || minStock === null ? 0 : minStock,
      ...dims,
      fabric: r.tecido || null,
      color: r.cor || null,
      images,
      raw: r,
      errors,
    };
  });

  // Cross-row checks.
  const bySku = new Map();
  for (const row of results) {
    if (!row.sku) continue;
    const key = row.sku.toUpperCase();
    if (bySku.has(key))
      row.errors.push(`sku duplicado (também na linha ${bySku.get(key)})`);
    else bySku.set(key, row.line);
  }
  const products = new Map();
  for (const row of results) {
    if (!row.product) continue;
    const list = products.get(row.product) ?? [];
    list.push(row);
    products.set(row.product, list);
  }
  const imageOwners = new Map();
  const productSummaries = [];
  for (const [slug, list] of products) {
    const first = list[0].raw;
    for (const row of list.slice(1))
      for (const col of [
        "categoria_slug",
        "produto_nome",
        "produto_descricao",
        "produto_status",
      ])
        if (row.raw[col] !== first[col])
          row.errors.push(
            `${col} diferente da linha ${list[0].line} do mesmo produto`,
          );
    const variantKeys = new Map();
    for (const row of list) {
      const key = JSON.stringify([
        row.fabric,
        row.color,
        row.width_mm,
        row.depth_mm,
        row.height_mm,
      ]);
      if (variantKeys.has(key))
        row.errors.push(
          `variação repetida (igual à linha ${variantKeys.get(key)})`,
        );
      else variantKeys.set(key, row.line);
    }
    const allImages = [...new Set(list.flatMap((row) => row.images))];
    if (list[0].status === "active" && allImages.length === 0)
      for (const row of list)
        row.errors.push("produto publicado precisa de pelo menos 1 imagem");
    for (const file of allImages) {
      const owner = imageOwners.get(basename(file));
      if (owner && owner !== slug)
        warnings.push(`Imagem "${file}" usada em "${owner}" e "${slug}".`);
      else imageOwners.set(basename(file), slug);
    }
    // A product is imported whole or not at all.
    const productRejected = list.some((row) => row.errors.length);
    if (productRejected)
      for (const row of list)
        if (!row.errors.length)
          row.errors.push(
            "rejeitada porque outra linha do mesmo produto tem erro",
          );
    productSummaries.push({
      slug,
      name: first.produto_nome,
      category: first.categoria_slug,
      status: list[0].status,
      variants: list.length,
      images: allImages.length,
      accepted: !productRejected,
    });
  }

  return {
    fatal: null,
    // `raw` (the original cells) stays out of the report.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    rows: results.map(({ raw, ...row }) => ({
      ...row,
      accepted: row.errors.length === 0,
    })),
    products: productSummaries,
    warnings,
  };
}

export function renderReport(result, source) {
  const accepted = result.rows.filter((r) => r.accepted);
  const rejected = result.rows.filter((r) => !r.accepted);
  const lines = [
    "# Relatório de validação do catálogo (dry-run)",
    "",
    `Arquivo: \`${source}\` · Gerado em ${new Date().toISOString()}`,
    "",
    "Nenhum dado foi gravado. Este relatório só confere o arquivo.",
    "",
    `- Linhas (variações): ${result.rows.length} · aceitas: ${accepted.length} · rejeitadas: ${rejected.length}`,
    `- Produtos: ${result.products.length} · aceitos: ${result.products.filter((p) => p.accepted).length}`,
    "",
  ];
  if (result.warnings.length)
    lines.push("## Avisos", "", ...result.warnings.map((w) => `- ${w}`), "");
  lines.push("## Rejeitadas", "");
  if (!rejected.length) lines.push("Nenhuma.", "");
  else {
    lines.push("| Linha | Produto | SKU | Motivos |", "|---|---|---|---|");
    for (const r of rejected)
      lines.push(
        `| ${r.line} | ${r.product || "—"} | ${r.sku || "—"} | ${r.errors.join("; ")} |`,
      );
    lines.push("");
  }
  lines.push(
    "## Produtos",
    "",
    "| Produto | Categoria | Status | Variações | Imagens | Resultado |",
    "|---|---|---|---|---|---|",
  );
  for (const p of result.products)
    lines.push(
      `| ${p.slug} | ${p.category} | ${p.status === "active" ? "publicado" : "rascunho"} | ${p.variants} | ${p.images} | ${p.accepted ? "aceito" : "rejeitado"} |`,
    );
  return lines.join("\n") + "\n";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const opt = (name) =>
    args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (!file) {
    console.error(
      "Uso: node scripts/catalog/validate-catalog-csv.mjs <arquivo.csv> [--images=<pasta>] [--categories=a,b] [--out=<pasta>]",
    );
    process.exit(1);
  }
  const result = validateCatalogCsv(readFileSync(resolve(file), "utf8"), {
    imagesDir: opt("images") ? resolve(opt("images")) : undefined,
    categories: opt("categories")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });
  if (result.fatal) {
    console.error(`Arquivo inválido: ${result.fatal}`);
    process.exit(1);
  }
  const out = resolve(opt("out") ?? "catalog-validation");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "relatorio.md"), renderReport(result, file));
  writeFileSync(join(out, "relatorio.json"), JSON.stringify(result, null, 2));
  const rejected = result.rows.filter((r) => !r.accepted).length;
  console.log(
    `Linhas: ${result.rows.length} · aceitas: ${result.rows.length - rejected} · rejeitadas: ${rejected}`,
  );
  for (const w of result.warnings) console.log(`aviso: ${w}`);
  console.log(`Relatório: ${join(out, "relatorio.md")}`);
  process.exit(rejected ? 2 : 0);
}

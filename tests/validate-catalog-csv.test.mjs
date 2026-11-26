import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  COLUMNS,
  parsePrice,
  validateCatalogCsv,
} from "../scripts/catalog/validate-catalog-csv.mjs";

const header = COLUMNS.join(";");
const row = (values) => COLUMNS.map((column) => values[column] ?? "").join(";");
const good = {
  categoria_slug: "sofas",
  produto_slug: "sofa-teste",
  produto_nome: "Sofá Teste",
  produto_descricao: "Descrição",
  produto_status: "publicado",
  sku: "TESTE-210",
  largura_cm: "210",
  preco: "2.799,00",
  estoque: "3",
  estoque_minimo: "1",
  imagens: "foto.webp",
  texto_alternativo: "Sofá Teste",
};
const webp = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4),
  Buffer.from("WEBPVP8 "),
]);

async function withImages(files, run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "catalog-csv-"));
  try {
    for (const [name, bytes] of Object.entries(files))
      await writeFile(path.join(dir, name), bytes);
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("prices in Brazilian and plain formats", () => {
  assert.equal(parsePrice("2.799,00"), 279900);
  assert.equal(parsePrice("R$ 1.299,90"), 129990);
  assert.equal(parsePrice("1299.9"), 129990);
  assert.equal(parsePrice(""), null);
  assert.ok(Number.isNaN(parsePrice("12,345,6")));
  assert.ok(Number.isNaN(parsePrice("abc")));
});

test("a complete published product is accepted", () =>
  withImages({ "foto.webp": webp }, (dir) => {
    const result = validateCatalogCsv(`${header}\n${row(good)}\n`, {
      imagesDir: dir,
      categories: ["sofas"],
    });
    assert.equal(result.fatal, null);
    assert.deepEqual(result.rows[0].errors, []);
    assert.equal(result.rows[0].price_cents, 279900);
    assert.equal(result.rows[0].width_mm, 2100);
    assert.equal(result.products[0].accepted, true);
  }));

test("blank stock is rejected, never defaulted", () => {
  const result = validateCatalogCsv(
    `${header}\n${row({ ...good, estoque: "" })}\n`,
  );
  assert.match(result.rows[0].errors.join(), /estoque obrigatório/);
});

test("invalid price, unknown category, bad slug and missing image are reported", () =>
  withImages({}, (dir) => {
    const result = validateCatalogCsv(
      `${header}\n${row({ ...good, preco: "0", categoria_slug: "inexistente", produto_slug: "Sofá Teste" })}\n`,
      { imagesDir: dir, categories: ["sofas"] },
    );
    const errors = result.rows[0].errors.join(" | ");
    assert.match(errors, /preco deve ser maior que zero/);
    assert.match(errors, /categoria "inexistente" não existe/);
    assert.match(errors, /produto_slug inválido/);
    assert.match(errors, /não encontrada/);
  }));

test("a file that is not an image is rejected", () =>
  withImages({ "foto.webp": Buffer.from("<html>") }, (dir) => {
    const result = validateCatalogCsv(`${header}\n${row(good)}\n`, {
      imagesDir: dir,
    });
    assert.match(result.rows[0].errors.join(), /não é uma imagem válida/);
  }));

test("duplicate SKU and duplicate variant are detected", () => {
  const result = validateCatalogCsv(
    `${header}\n${row({ ...good, imagens: "", produto_status: "rascunho" })}\n${row({ ...good, imagens: "", produto_status: "rascunho" })}\n`,
  );
  const errors = result.rows[1].errors.join(" | ");
  assert.match(errors, /sku duplicado/);
  assert.match(errors, /variação repetida/);
});

test("published products need an image, and a product is all or nothing", () => {
  const result = validateCatalogCsv(
    `${header}\n${row({ ...good, imagens: "", texto_alternativo: "" })}\n${row({ ...good, sku: "TESTE-250", largura_cm: "250", imagens: "", texto_alternativo: "" })}\n`,
  );
  assert.ok(result.rows.every((r) => !r.accepted));
  assert.match(result.rows[0].errors.join(), /pelo menos 1 imagem/);
});

test("rows of the same product must agree", () => {
  const result = validateCatalogCsv(
    `${header}\n${row({ ...good, produto_status: "rascunho", imagens: "" })}\n${row({ ...good, sku: "TESTE-250", largura_cm: "250", produto_nome: "Outro nome", produto_status: "rascunho", imagens: "" })}\n`,
  );
  assert.match(result.rows[1].errors.join(), /produto_nome diferente/);
});

test("missing columns make the file unusable", () => {
  const result = validateCatalogCsv("produto_slug;sku\nx;y\n");
  assert.match(result.fatal, /Colunas ausentes/);
});

test("the shipped template parses and flags the blank stock", async () => {
  const text = await readFile(
    new URL("../docs/production/catalog-import-template.csv", import.meta.url),
    "utf8",
  );
  const result = validateCatalogCsv(text);
  assert.equal(result.fatal, null);
  assert.equal(result.rows.length, 2);
  assert.ok(
    result.rows.every((r) => /estoque obrigatório/.test(r.errors.join())),
  );
});

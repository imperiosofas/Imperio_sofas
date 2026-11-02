import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPANY,
  legalDocuments,
  returns,
  terms,
} from "../src/features/legal/content.ts";

const allText = (document) =>
  document.sections
    .flatMap((section) => [
      section.title,
      ...(section.paragraphs ?? []),
      ...(section.bullets ?? []),
    ])
    .join("\n");

test("company identification is complete", () => {
  for (const key of [
    "legalName",
    "tradeName",
    "cnpj",
    "address",
    "phone",
    "email",
    "site",
  ]) {
    assert.ok(COMPANY[key]?.trim(), `${key} is empty`);
  }
  assert.match(COMPANY.cnpj, /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
  assert.match(COMPANY.email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
});

test("all three legal documents have titles, dates and sections", () => {
  assert.equal(legalDocuments.length, 3);
  for (const document of legalDocuments) {
    assert.ok(document.title.trim());
    assert.ok(document.updatedAt.trim());
    assert.ok(document.sections.length > 0);
    for (const section of document.sections) {
      assert.ok(
        (section.paragraphs?.length ?? 0) + (section.bullets?.length ?? 0) > 0,
        `empty section in ${document.slug}`,
      );
    }
  }
});

test("legal slugs are unique and match the public routes", () => {
  const slugs = legalDocuments.map((document) => document.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.deepEqual([...slugs].sort(), [
    "privacidade",
    "termos",
    "trocas-e-devolucoes",
  ]);
});

test("terms and returns keep the consumer-law commitments", () => {
  assert.match(allText(terms), /artigo 49/);
  assert.match(allText(returns), /artigo 49/);
  assert.match(allText(terms), /7 dias corridos/);
  assert.match(allText(terms), /90 dias/);
  assert.match(
    allText(terms),
    new RegExp(COMPANY.cnpj.replace(/[./-]/g, "\$&")),
  );
});

test("terms state both supplier lead times", () => {
  const text = allText(terms);
  assert.match(text, /Valle: até 7 dias úteis/);
  assert.match(text, /Mundial: de 30 a 45 dias úteis/);
});

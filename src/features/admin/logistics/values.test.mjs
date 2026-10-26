import assert from "node:assert/strict";
import test from "node:test";
import { formatBRLFromCents, parseBRLToCents, statusLabel } from "./values.mjs";

test("BRL values are parsed to integer cents without floating point math", () => {
  assert.equal(parseBRLToCents("10,00"), 1000);
  assert.equal(parseBRLToCents("4.30"), 430);
  assert.equal(parseBRLToCents("0"), 0);
  assert.equal(parseBRLToCents(""), null);
  assert.equal(parseBRLToCents("-1,00"), null);
  assert.equal(parseBRLToCents("1.000,00"), null);
  assert.equal(parseBRLToCents("1,234"), null);
});

test("cent values render in the Brazilian currency format", () => {
  assert.equal(formatBRLFromCents(1000), "R$ 10,00");
  assert.equal(formatBRLFromCents(null), "—");
  assert.equal(formatBRLFromCents(-1), "—");
});

test("supported logistics states use Portuguese labels", () => {
  assert.equal(statusLabel("accepted"), "Aceita pelo cliente");
  assert.equal(statusLabel("unknown"), "Status não reconhecido");
});

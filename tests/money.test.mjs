import assert from "node:assert/strict";
import test from "node:test";
import { parseBrlToCents } from "../src/lib/money.ts";

test("parseBrlToCents reads the formats admins type", () => {
  assert.equal(parseBrlToCents("1299"), 129_900);
  assert.equal(parseBrlToCents("1299,90"), 129_990);
  assert.equal(parseBrlToCents("1.299,90"), 129_990);
  assert.equal(parseBrlToCents("1299.90"), 129_990);
  assert.equal(parseBrlToCents("1.299"), 129_900);
  assert.equal(parseBrlToCents("R$ 2.499,5"), 249_950);
  assert.equal(parseBrlToCents("0,10"), 10);
});

test("parseBrlToCents rejects ambiguous or invalid input", () => {
  for (const bad of ["", "abc", "1,2,3", "12.3456", "-10", "1.29.9"])
    assert.ok(Number.isNaN(parseBrlToCents(bad)), bad);
});

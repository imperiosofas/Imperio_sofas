import assert from "node:assert/strict";
import test from "node:test";
import { getSafeAuthReturnTo } from "../src/lib/auth-return-to.ts";

test("admin sub-pages are kept as post-login destinations", () => {
  for (const ok of [
    "/admin/pedidos",
    "/admin/pedidos/2f1c4b8e-1d2a-4c3b-9a8e-7f6d5c4b3a21",
    "/admin/entregas/solicitacoes",
    "/admin/relatorios/vendas",
  ])
    assert.equal(getSafeAuthReturnTo(ok), ok);
});

test("unsafe destinations fall back to /conta", () => {
  for (const bad of [
    "https://evil.example/admin",
    "//evil.example",
    "/admin/../conta",
    "/admin/pedidos?next=https://evil.example",
    "/admin/pedidos/a/b/c",
    "/adminx",
    "/admin/produtos/not-a-uuid",
    null,
  ])
    assert.equal(getSafeAuthReturnTo(bad), "/conta", String(bad));
});

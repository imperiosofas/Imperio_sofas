import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inspectMigrations,
  loadMigrations,
} from "../scripts/verify-migrations.mjs";

test("the repository migrations reproduce the validated schema", () => {
  const { errors, summary } = inspectMigrations(loadMigrations());
  assert.deepEqual(errors, []);
  assert.equal(summary.tables, summary.tablesWithRls);
  assert.equal(summary.catalogBucketPublic, false);
  assert.ok(summary.cronJobs.includes("expire-pending-orders"));
});

const base = loadMigrations();
const errorsFor = (extra) =>
  inspectMigrations([...base, ...extra]).errors.join("\n");

test("a table without RLS fails", () => {
  assert.match(
    errorsFor([
      {
        file: "20991231000000_new_table.sql",
        sql: "create table public.leaky (id int);",
      },
    ]),
    /Tabelas sem RLS: public\.leaky/,
  );
});

test("disabling RLS or making a bucket public fails", () => {
  assert.match(
    errorsFor([
      {
        file: "20991231000000_bad.sql",
        sql: "alter table public.orders disable row level security;",
      },
    ]),
    /desliga RLS/,
  );
  assert.match(
    errorsFor([
      {
        file: "20991231000000_bad.sql",
        sql: "update storage.buckets set public = true where id = 'catalog-images';",
      },
    ]),
    /bucket público/,
  );
});

test("duplicate versions and bad names fail", () => {
  assert.match(
    errorsFor([{ file: "20261125130000_duplicate.sql", sql: "select 1;" }]),
    /Versão duplicada/,
  );
  assert.match(
    errorsFor([{ file: "zz_no_version.sql", sql: "select 1;" }]),
    /Nome fora do padrão/,
  );
});

test("missing critical objects fail", () => {
  const withoutWebhook = base.filter(
    (m) => !/order_apply_payment_event|orders_checkout_foundation/.test(m.sql),
  );
  assert.ok(inspectMigrations(withoutWebhook).errors.length > 0);
});

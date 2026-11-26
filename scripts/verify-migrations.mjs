// Offline inventory of supabase/migrations. Reads files only; never connects to
// a database. Fails (exit 1) when the set would not reproduce the validated
// schema: bad names/order, duplicate versions, a table without RLS, a public
// catalog bucket, missing storage policies, RPCs or the expiry job.
//
// Usage: node scripts/verify-migrations.mjs [--json]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MIGRATIONS_DIR = fileURLToPath(
  new URL("../supabase/migrations/", import.meta.url),
);

// Objects the store and the audit depend on (see docs/production).
export const REQUIRED_FUNCTIONS = [
  "public.get_catalog_categories",
  "public.get_catalog_product_detail",
  "public.get_catalog_listing",
  "public.set_cart_item",
  "public.add_cart_item",
  "public.create_checkout_order",
  "public.cancel_my_order",
  "public.order_apply_payment_event",
  "public.expire_pending_orders",
  "public.admin_close_needs_review_order",
  "public.admin_register_order_refund",
  "private.is_public_catalog_media",
  "private.is_catalog_admin",
];
export const REQUIRED_STORAGE_POLICIES = [
  "published catalog images are readable",
  "catalog admins upload product images",
  "catalog admins remove product images",
];
export const REQUIRED_CRON_JOBS = ["expire-pending-orders"];

const NAME = /^(\d{14})_[a-z0-9_]+\.sql$/;

export function loadMigrations(dir = MIGRATIONS_DIR) {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({ file, sql: readFileSync(join(dir, file), "utf8") }));
}

const lower = (sql) => sql.toLowerCase().replace(/--[^\n]*/g, "");

export function inspectMigrations(migrations) {
  const errors = [];
  const versions = new Map();
  const tables = new Set();
  const rls = new Set();
  const functions = new Set();
  const policies = new Set();
  const cronJobs = new Set();
  let triggers = 0;
  let indexes = 0;
  let bucketPublic = null;

  migrations.forEach(({ file }, index) => {
    const match = NAME.exec(file);
    if (!match) errors.push(`Nome fora do padrão: ${file}`);
    else {
      if (versions.has(match[1]))
        errors.push(
          `Versão duplicada ${match[1]}: ${versions.get(match[1])} e ${file}`,
        );
      versions.set(match[1], file);
      if (index > 0 && file <= migrations[index - 1].file)
        errors.push(`Fora de ordem: ${file}`);
    }
  });

  for (const { file, sql } of migrations) {
    const text = lower(sql);
    for (const m of text.matchAll(
      /create table (?:if not exists )?([a-z_]+\.[a-z_]+)/g,
    ))
      tables.add(m[1]);
    for (const m of text.matchAll(
      /alter table (?:only )?([a-z_]+\.[a-z_]+) enable row level security/g,
    ))
      rls.add(m[1]);
    for (const m of text.matchAll(
      /create (?:or replace )?function ([a-z_]+\.[a-z_]+)\s*\(/g,
    ))
      functions.add(m[1]);
    for (const m of text.matchAll(
      /alter function ([a-z_]+\.[a-z_]+)\([^)]*\) rename to ([a-z_]+)/g,
    ))
      functions.add(`${m[1].split(".")[0]}.${m[2]}`);
    for (const m of text.matchAll(/create policy "([^"]+)"/g))
      policies.add(m[1]);
    for (const m of text.matchAll(/cron\.schedule\(\s*'([^']+)'/g))
      cronJobs.add(m[1]);
    triggers += (
      text.match(/create (?:or replace )?(?:constraint )?trigger /g) ?? []
    ).length;
    indexes += (text.match(/create (?:unique )?index /g) ?? []).length;
    if (/disable row level security/.test(text))
      errors.push(`${file} desliga RLS`);
    const bucket =
      /insert into storage\.buckets[^;]*'catalog-images'\s*,\s*'catalog-images'\s*,\s*(true|false)/.exec(
        text,
      );
    if (bucket) bucketPublic = bucket[1] === "true";
    if (/update storage\.buckets\s+set\s+public\s*=\s*true/.test(text))
      errors.push(`${file} torna um bucket público`);
  }

  const withoutRls = [...tables].filter((table) => !rls.has(table));
  if (withoutRls.length)
    errors.push(`Tabelas sem RLS: ${withoutRls.join(", ")}`);
  if (bucketPublic !== false)
    errors.push("Bucket catalog-images ausente ou público (deve ser privado)");
  for (const name of REQUIRED_FUNCTIONS)
    if (!functions.has(name)) errors.push(`Função ausente: ${name}`);
  for (const name of REQUIRED_STORAGE_POLICIES)
    if (!policies.has(name)) errors.push(`Policy de storage ausente: ${name}`);
  for (const name of REQUIRED_CRON_JOBS)
    if (!cronJobs.has(name)) errors.push(`Job agendado ausente: ${name}`);

  return {
    errors,
    summary: {
      migrations: migrations.length,
      first: migrations[0]?.file ?? null,
      last: migrations.at(-1)?.file ?? null,
      tables: tables.size,
      tablesWithRls: [...tables].filter((t) => rls.has(t)).length,
      functions: functions.size,
      policies: policies.size,
      triggers,
      indexes,
      cronJobs: [...cronJobs],
      catalogBucketPublic: bucketPublic,
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { errors, summary } = inspectMigrations(loadMigrations());
  if (process.argv.includes("--json"))
    console.log(JSON.stringify({ summary, errors }, null, 2));
  else {
    console.log(
      `Migrações: ${summary.migrations} (${summary.first} → ${summary.last})`,
    );
    console.log(
      `Tabelas: ${summary.tables} (com RLS: ${summary.tablesWithRls})`,
    );
    console.log(
      `Funções: ${summary.functions} · Policies: ${summary.policies} · Triggers: ${summary.triggers} · Índices: ${summary.indexes}`,
    );
    console.log(
      `Jobs agendados: ${summary.cronJobs.join(", ") || "nenhum"} · Bucket catalog-images público: ${summary.catalogBucketPublic}`,
    );
    for (const error of errors) console.error(`ERRO: ${error}`);
    console.log(
      errors.length ? "verify-migrations: FALHOU" : "verify-migrations: OK",
    );
  }
  process.exit(errors.length ? 1 : 0);
}

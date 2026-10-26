import { z } from "zod";
import {
  AnalyticsExportLimitError,
  fetchAnalyticsExportProducts,
} from "./catalog-products.mjs";
import { buildAnalyticsWorkbookBuffer } from "./workbook.mjs";

const MAX_WORKBOOK_BYTES = 25 * 1024 * 1024;
const SPREADSHEET_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function jsonError(status, message) {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function authorizationError(error) {
  if (!error || typeof error !== "object" || !("digest" in error)) {
    return null;
  }
  const digest = error.digest;
  if (typeof digest !== "string") return null;
  if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) {
    return jsonError(403, "Acesso administrativo necessário.");
  }
  if (digest.startsWith("NEXT_REDIRECT")) {
    return jsonError(401, "Autentique-se para baixar este relatório.");
  }
  return null;
}

function readCategoryId(request) {
  const values = new URL(request.url).searchParams.getAll("category");
  if (values.length > 1) return { ok: false };
  const raw = values[0];
  if (raw === undefined || raw === "") return { ok: true, categoryId: null };
  const parsed = z.string().uuid().safeParse(raw);
  return parsed.success ? { ok: true, categoryId: parsed.data } : { ok: false };
}

/**
 * Route core separated from Next.js imports so request/auth/response behavior
 * can be tested with injected server-side auth and analytics dependencies.
 */
export async function handleAnalyticsExportGet(
  request,
  { requireCatalogAdmin, getAdminAnalyticsSnapshot },
) {
  const category = readCategoryId(request);
  if (!category.ok) {
    return jsonError(400, "O filtro de categoria é inválido.");
  }

  let supabase;
  try {
    supabase = await requireCatalogAdmin("/admin");
  } catch (error) {
    return (
      authorizationError(error) ??
      jsonError(500, "Não foi possível validar o acesso administrativo.")
    );
  }

  let snapshot;
  try {
    snapshot = await getAdminAnalyticsSnapshot({
      categoryId: category.categoryId,
    });
  } catch (error) {
    const authResponse = authorizationError(error);
    if (authResponse) return authResponse;
    return jsonError(500, "Não foi possível gerar o snapshot de analytics.");
  }

  const categoryLabel = category.categoryId
    ? (snapshot.categories.find(
        (item) => item.category_id === category.categoryId,
      )?.category_name ?? "Categoria selecionada")
    : null;

  let products;
  try {
    products = await fetchAnalyticsExportProducts(
      supabase,
      category.categoryId,
    );
  } catch (error) {
    if (error instanceof AnalyticsExportLimitError) {
      return jsonError(
        413,
        "O catálogo excede o limite seguro para uma única exportação.",
      );
    }
    return jsonError(
      502,
      "Não foi possível validar todos os produtos do catálogo.",
    );
  }

  try {
    const workbook = await buildAnalyticsWorkbookBuffer(
      snapshot,
      products,
      categoryLabel,
    );
    if (workbook.byteLength > MAX_WORKBOOK_BYTES) {
      return jsonError(413, "O relatório excede o limite seguro de tamanho.");
    }

    const date = snapshot.snapshot_at.slice(0, 10);
    return new Response(new Uint8Array(workbook), {
      status: 200,
      headers: {
        "Content-Type": SPREADSHEET_MIME_TYPE,
        "Content-Disposition": `attachment; filename="imperio-analytics-${date}.xlsx"`,
        "Content-Length": String(workbook.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return jsonError(500, "Não foi possível montar o arquivo XLSX.");
  }
}

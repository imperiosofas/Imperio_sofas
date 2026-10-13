"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import sharp from "sharp";
import { requireCatalogAdmin } from "../../lib/supabase/admin-access";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const productInput = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(180),
  slug: z.string().trim().regex(slugPattern).max(180),
  description: z.string().max(10000),
  freeShipping: z.boolean(),
  variants: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        sku: z.string().trim().max(100),
        fabric: z.string().trim().max(120),
        color: z.string().trim().max(120),
        widthMm: z.number().int().positive().max(100000).optional(),
        depthMm: z.number().int().positive().max(100000).optional(),
        heightMm: z.number().int().positive().max(100000).optional(),
        priceCents: z.number().int().positive().max(100_000_000).optional(),
        onHand: z.number().int().nonnegative().max(1_000_000),
        lowStockThreshold: z.number().int().nonnegative().max(1_000_000),
        isActive: z.boolean(),
      }),
    )
    .min(1)
    .max(30),
});

const formText = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();
const parseOptionalInteger = (value: string) =>
  value ? Number.parseInt(value, 10) : undefined;

function parsePriceCents(value: string) {
  if (!value.trim()) return undefined;
  const trimmed = value.trim();
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Math.round(Number(normalized) * 100);
}

export async function saveProduct(
  formData: FormData,
): Promise<{ message: string }> {
  const id = formText(formData, "id") || undefined;
  const returnTo = id ? `/admin/produtos/${id}` : "/admin/produtos/novo";
  const supabase = await requireCatalogAdmin(returnTo);
  const parsed = productInput.safeParse({
    id,
    categoryId: formText(formData, "categoryId"),
    name: formText(formData, "name"),
    slug: formText(formData, "slug"),
    description: formText(formData, "description"),
    freeShipping: formData.get("freeShipping") === "on",
    variants: (() => {
      const grouped = new Map<number, Record<string, FormDataEntryValue>>();
      for (const [key, value] of formData.entries()) {
        const match = /^variants\[(\d+)\]\.(\w+)$/.exec(key);
        if (!match) continue;
        const index = Number(match[1]);
        const entry = grouped.get(index) ?? {};
        entry[match[2]] = value;
        grouped.set(index, entry);
      }
      return [...grouped.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, fields]) => {
          const text = (key: string) => String(fields[key] ?? "").trim();
          const width = parseOptionalInteger(text("widthMm"));
          return {
            id: text("id") || undefined,
            sku: text("sku"),
            fabric: text("fabric"),
            color: text("color"),
            widthMm: width,
            depthMm: parseOptionalInteger(text("depthMm")),
            heightMm: parseOptionalInteger(text("heightMm")),
            priceCents: parsePriceCents(text("price")),
            onHand: parseOptionalInteger(text("onHand")) ?? 0,
            lowStockThreshold:
              parseOptionalInteger(text("lowStockThreshold")) ?? 0,
            isActive: text("isActive") === "on",
          };
        });
    })(),
  });

  if (!parsed.success) {
    return {
      message: "Confira os campos obrigatórios e o preço da variação.",
    };
  }
  const value = parsed.data;
  const intent = formText(formData, "intent");
  const currentStatus = formText(formData, "currentStatus");
  const status =
    intent === "publish"
      ? "active"
      : intent === "archive"
        ? "archived"
        : intent === "unpublish"
          ? "draft"
          : currentStatus === "active" && id
            ? "active"
            : currentStatus === "archived" && id
              ? "archived"
              : "draft";

  const { data: savedId, error } = await supabase.rpc(
    "admin_save_catalog_product",
    {
      p_product: {
        id: value.id ?? null,
        category_id: value.categoryId,
        name: value.name,
        slug: value.slug,
        description: value.description,
        free_shipping: value.freeShipping,
        status,
      },
      p_variants: value.variants.map((variant) => ({
        id: variant.id ?? null,
        sku: variant.sku || null,
        fabric: variant.fabric || null,
        color: variant.color || null,
        width_mm: variant.widthMm ?? null,
        depth_mm: variant.depthMm ?? null,
        height_mm: variant.heightMm ?? null,
        price_cents: variant.priceCents ?? null,
        on_hand: variant.onHand,
        low_stock_threshold: variant.lowStockThreshold,
        is_active: variant.isActive,
      })),
    },
  );

  if (error || typeof savedId !== "string") {
    const code =
      error?.message === "publish_requirements_not_met"
        ? "publishRequirements"
        : error?.message === "publish_requires_media"
          ? "publishMedia"
          : error?.code === "42501"
            ? "permission"
            : error?.code === "23514"
              ? "publish"
              : error?.code === "23505"
                ? "duplicate"
                : "save";
    const messages: Record<string, string> = {
      publishRequirements:
        "Para publicar, escolha uma categoria ativa e salve uma variação ativa com SKU, preço e estoque disponível. Medidas são opcionais.",
      publishMedia:
        "Para publicar, adicione uma imagem com texto alternativo na seção Imagens abaixo.",
      permission:
        "Sua sessão não tem permissão para alterar este produto. Entre novamente com a conta administradora.",
      publish:
        "Ainda faltam requisitos para publicar. Confira a lista de publicação.",
      duplicate:
        "Já existe um produto com esse endereço ou uma variação com esse SKU.",
      save: "Não foi possível salvar. Confira os dados e tente novamente.",
    };
    return { message: messages[code] };
  }
  revalidatePath("/admin/produtos");
  revalidatePath(`/admin/produtos/${savedId}`);
  revalidatePath("/loja");
  revalidatePath("/loja/[categoria]", "page");
  revalidatePath(`/produto/${value.slug}`);
  redirect(`/admin/produtos/${savedId}?saved=1${id ? "" : "#imagens"}`);
}

const categoryInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500),
  active: z.boolean(),
});

export async function createCategory(formData: FormData) {
  const supabase = await requireCatalogAdmin("/admin/produtos");
  const parsed = categoryInput.safeParse({
    name: formText(formData, "name"),
    description: formText(formData, "description"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) redirect("/admin/produtos?categoryError=validation");
  const slug = parsed.data.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) redirect("/admin/produtos?categoryError=validation");

  const { error } = await supabase.from("categories").insert({
    name: parsed.data.name,
    slug,
    description: parsed.data.description,
    is_active: parsed.data.active,
  });
  if (error)
    redirect(
      `/admin/produtos?categoryError=${error.code === "23505" ? "duplicate" : "save"}`,
    );
  revalidatePath("/admin/produtos");
  revalidatePath("/loja");
  redirect("/admin/produtos?categorySaved=1");
}

export async function toggleCategory(formData: FormData) {
  const id = formText(formData, "categoryId");
  const supabase = await requireCatalogAdmin("/admin/produtos");
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) redirect("/admin/produtos?categoryError=validation");
  const active = formText(formData, "active") === "true";
  if (!active) {
    const { count, error: productsError } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id)
      .eq("status", "active");
    if (productsError) redirect("/admin/produtos?categoryError=save");
    if ((count ?? 0) > 0) redirect("/admin/produtos?categoryError=published");
  }
  const { error } = await supabase
    .from("categories")
    .update({ is_active: active })
    .eq("id", id);
  if (error) redirect("/admin/produtos?categoryError=save");
  revalidatePath("/admin/produtos");
  revalidatePath("/loja");
  redirect("/admin/produtos?categorySaved=1");
}

const catalogProductIds = z.array(z.string().uuid()).min(1).max(100);
const statusChange = z.enum(["active", "draft"]);

function revalidateCatalog() {
  revalidatePath("/admin/produtos");
  revalidatePath("/loja");
  revalidatePath("/loja/[categoria]", "page");
  revalidatePath("/produto/[slug]", "page");
}

export async function setCatalogProductStatuses(
  rawIds: string[],
  rawStatus: string,
) {
  const supabase = await requireCatalogAdmin("/admin/produtos");
  const ids = catalogProductIds.safeParse([...new Set(rawIds)]);
  const nextStatus = statusChange.safeParse(rawStatus);
  if (!ids.success || !nextStatus.success)
    return {
      ok: false,
      message: "Seleção inválida.",
      succeeded: [],
      failed: [],
    };

  const succeeded: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const id of ids.data) {
    const { error } = await supabase.rpc("admin_set_catalog_product_status", {
      p_product_id: id,
      p_status: nextStatus.data,
    });
    if (error) {
      failed.push({
        id,
        reason:
          error.message === "publish_requirements_not_met"
            ? "Falta categoria ativa, SKU, preço ou estoque disponível."
            : error.message === "publish_requires_media"
              ? "Adicione uma imagem com texto alternativo."
              : "A alteração foi recusada pelo servidor.",
      });
    } else succeeded.push(id);
  }
  if (succeeded.length) revalidateCatalog();
  return {
    ok: failed.length === 0,
    message: `${succeeded.length} ${nextStatus.data === "active" ? "publicado(s)" : "despublicado(s)"}${failed.length ? ` · ${failed.length} com pendências` : ""}.`,
    succeeded,
    failed,
  };
}

const quickEditInput = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(1).max(180),
  categoryId: z.string().uuid(),
  variants: z
    .array(
      z.object({
        id: z.string().uuid(),
        sku: z.string().trim().min(1).max(100),
        priceCents: z.number().int().positive().max(100_000_000),
        onHand: z.number().int().nonnegative().max(1_000_000),
        lowStockThreshold: z.number().int().nonnegative().max(1_000_000),
      }),
    )
    .min(1)
    .max(30),
});

export async function quickEditCatalogProduct(input: unknown) {
  const supabase = await requireCatalogAdmin("/admin/produtos");
  const parsed = quickEditInput.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revise nome, categoria, SKU, preço e estoque.",
    };
  const { error } = await supabase.rpc("admin_quick_edit_catalog_product", {
    p_product_id: parsed.data.productId,
    p_name: parsed.data.name,
    p_category_id: parsed.data.categoryId,
    p_variants: parsed.data.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      price_cents: variant.priceCents,
      on_hand: variant.onHand,
      low_stock_threshold: variant.lowStockThreshold,
    })),
  });
  if (error)
    return {
      ok: false,
      message:
        "Não foi possível salvar a edição rápida. Confira se o SKU já está em uso.",
    };
  revalidateCatalog();
  revalidatePath(`/admin/produtos/${parsed.data.productId}`);
  return { ok: true, message: "Produto atualizado." };
}

export async function changeCatalogCategory(
  rawIds: string[],
  rawCategoryId: string,
) {
  const supabase = await requireCatalogAdmin("/admin/produtos");
  const ids = catalogProductIds.safeParse([...new Set(rawIds)]);
  const categoryId = z.string().uuid().safeParse(rawCategoryId);
  if (!ids.success || !categoryId.success)
    return { ok: false, message: "Seleção inválida." };
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id,is_active")
    .eq("id", categoryId.data)
    .maybeSingle();
  if (categoryError || !category?.is_active)
    return { ok: false, message: "Escolha uma categoria ativa." };
  const { data, error } = await supabase
    .from("products")
    .update({ category_id: categoryId.data })
    .in("id", ids.data)
    .select("id");
  if (error || data?.length !== ids.data.length)
    return {
      ok: false,
      message: "Não foi possível alterar a categoria de todos os produtos.",
    };
  revalidateCatalog();
  return {
    ok: true,
    message: `Categoria alterada em ${data.length} produto(s).`,
  };
}

export async function adjustCatalogInventory(rawIds: string[], delta: number) {
  const supabase = await requireCatalogAdmin("/admin/produtos");
  const ids = catalogProductIds.safeParse([...new Set(rawIds)]);
  if (
    !ids.success ||
    !Number.isInteger(delta) ||
    delta === 0 ||
    Math.abs(delta) > 1000
  )
    return { ok: false, message: "Ajuste de estoque inválido." };
  const { data: changed, error } = await supabase.rpc(
    "admin_adjust_catalog_inventory",
    {
      p_product_ids: ids.data,
      p_delta: delta,
    },
  );
  if (error || typeof changed !== "number")
    return {
      ok: false,
      message:
        error?.message === "inventory_below_reserved"
          ? "O ajuste deixaria uma variante abaixo da quantidade reservada."
          : "O servidor não conseguiu salvar os ajustes.",
    };
  revalidateCatalog();
  return {
    ok: true,
    message: `Estoque atualizado para ${changed} variante(s).`,
  };
}

export async function deleteCatalogProduct(productId: string) {
  const supabase = await requireCatalogAdmin("/admin/produtos");
  const id = z.string().uuid().safeParse(productId);
  if (!id.success) return { ok: false, message: "Produto inválido." };
  const { data, error } = await supabase.rpc("admin_delete_catalog_product", {
    p_product_id: id.data,
  });
  if (error || !data || typeof data !== "object")
    return { ok: false, message: "Não foi possível remover o produto." };
  const result = data as { outcome?: string; paths?: unknown };
  let storageOk = true;
  if (
    result.outcome === "deleted" &&
    Array.isArray(result.paths) &&
    result.paths.length
  ) {
    const { error: storageError } = await supabase.storage
      .from("catalog-images")
      .remove(
        result.paths.filter((path): path is string => typeof path === "string"),
      );
    storageOk = !storageError;
  }
  revalidateCatalog();
  return result.outcome === "archived"
    ? {
        ok: true,
        message:
          "Produto arquivado para preservar itens de carrinho, avaliações ou histórico.",
      }
    : {
        ok: storageOk,
        message: storageOk
          ? "Produto excluído e imagens removidas."
          : "Produto excluído, mas não foi possível remover todos os arquivos do Storage.",
      };
}

export async function renameCategory(formData: FormData) {
  const supabase = await requireCatalogAdmin("/admin/produtos");
  const id = z.string().uuid().safeParse(formText(formData, "categoryId"));
  const name = z
    .string()
    .trim()
    .min(1)
    .max(120)
    .safeParse(formText(formData, "name"));
  if (!id.success || !name.success)
    redirect("/admin/produtos?categoryError=validation");
  const slug = name.data
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const { error } = await supabase
    .from("categories")
    .update({ name: name.data, slug })
    .eq("id", id.data);
  if (error)
    redirect(
      `/admin/produtos?categoryError=${error.code === "23505" ? "duplicate" : "save"}`,
    );
  revalidateCatalog();
  redirect("/admin/produtos?categorySaved=1");
}

export async function uploadProductImage(formData: FormData) {
  const productId = formText(formData, "productId");
  const supabase = await requireCatalogAdmin(`/admin/produtos/${productId}`);
  const parsedId = z.string().uuid().safeParse(productId);
  const file = formData.get("image");
  const altText = formText(formData, "altText");
  if (
    !parsedId.success ||
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 10 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    altText.length < 1 ||
    altText.length > 300
  ) {
    return {
      ok: false,
      message:
        "Escolha um arquivo JPG, PNG ou WebP de até 10 MB e escreva o texto alternativo.",
    };
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();
  if (productError || !product)
    return { ok: false, message: "Produto não encontrado. Atualize a página." };

  let optimizedImage: Buffer;
  try {
    optimizedImage = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 100_000_000,
    })
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 84 })
      .toBuffer();
  } catch {
    return { ok: false, message: "Não foi possível processar esta imagem." };
  }
  if (optimizedImage.byteLength > 10 * 1024 * 1024)
    return { ok: false, message: "A imagem otimizada excede 10 MB." };
  const storagePath = `products/${productId}/${randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("catalog-images")
    .upload(storagePath, optimizedImage, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError)
    return {
      ok: false,
      message: "Não foi possível enviar a imagem. Tente novamente.",
    };

  const { error: mediaError } = await supabase.from("product_media").insert({
    product_id: productId,
    storage_path: storagePath,
    alt_text: altText,
    position: 0,
  });
  if (mediaError) {
    await supabase.storage.from("catalog-images").remove([storagePath]);
    return {
      ok: false,
      message:
        "Não foi possível vincular a imagem ao produto. Tente novamente.",
    };
  }
  revalidatePath(`/admin/produtos/${productId}`);
  revalidatePath("/loja");
  revalidatePath("/loja/[categoria]", "page");
  return { ok: true, message: "Imagem enviada e vinculada ao produto." };
}

export async function removeProductImage(formData: FormData) {
  const productId = formText(formData, "productId");
  const mediaId = formText(formData, "mediaId");
  const supabase = await requireCatalogAdmin(`/admin/produtos/${productId}`);
  const idsValid =
    z.string().uuid().safeParse(productId).success &&
    z.string().uuid().safeParse(mediaId).success;
  if (!idsValid) redirect("/admin/produtos");

  const { data: media, error } = await supabase
    .from("product_media")
    .select("id,storage_path")
    .eq("id", mediaId)
    .eq("product_id", productId)
    .maybeSingle();
  if (error || !media) redirect(`/admin/produtos/${productId}?error=image`);
  const [{ count, error: countError }, { data: product }] = await Promise.all([
    supabase
      .from("product_media")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId),
    supabase
      .from("products")
      .select("status")
      .eq("id", productId)
      .maybeSingle(),
  ]);
  if (countError || !product)
    redirect(`/admin/produtos/${productId}?error=image`);
  if (product.status === "active" && (count ?? 0) <= 1)
    redirect(`/admin/produtos/${productId}?error=lastImage`);
  const { error: deleteError } = await supabase
    .from("product_media")
    .delete()
    .eq("id", mediaId)
    .eq("product_id", productId);
  if (deleteError) redirect(`/admin/produtos/${productId}?error=image`);
  await supabase.storage.from("catalog-images").remove([media.storage_path]);
  revalidatePath(`/admin/produtos/${productId}`);
  revalidatePath("/loja");
  revalidatePath("/loja/[categoria]", "page");
  redirect(`/admin/produtos/${productId}?imageRemoved=1`);
}

"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "../../lib/supabase/server";

async function authenticated() {
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { client, userId: data.claims.sub };
}

export async function toggleFavorite(productId: string, current: boolean) {
  const auth = await authenticated();
  if (!auth)
    return {
      ok: false,
      requiresLogin: true,
      message: "Entre na sua conta para salvar favoritos.",
    };
  const query = current
    ? auth.client
        .from("product_favorites")
        .delete()
        .eq("user_id", auth.userId)
        .eq("product_id", productId)
    : auth.client
        .from("product_favorites")
        .upsert(
          { user_id: auth.userId, product_id: productId },
          { onConflict: "user_id,product_id" },
        );
  const { error } = await query;
  if (error)
    return {
      ok: false,
      requiresLogin: false,
      message: "Não foi possível atualizar o favorito.",
    };
  revalidatePath("/loja");
  return { ok: true, requiresLogin: false, message: "Favoritos atualizados." };
}

export async function saveReview(
  productId: string,
  rating: number,
  comment: string,
) {
  const auth = await authenticated();
  if (!auth) return { ok: false, message: "Entre na sua conta para avaliar." };
  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    comment.length > 2000
  )
    return { ok: false, message: "Confira a nota e o comentário." };
  const { error } = await auth.client.rpc("save_product_review", {
    p_product_id: productId,
    p_rating: rating,
    p_comment: comment.trim() || null,
  });
  if (error)
    return { ok: false, message: "Não foi possível publicar sua avaliação." };
  const { data: saved } = await auth.client
    .from("product_reviews")
    .select("status")
    .eq("product_id", productId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  revalidatePath("/loja");
  return {
    ok: true,
    message:
      saved?.status === "hidden"
        ? "Avaliação atualizada. Ela continua oculta até moderação."
        : "Avaliação publicada.",
  };
}

export async function removeReview(productId: string) {
  const auth = await authenticated();
  if (!auth) return { ok: false, message: "Entre na sua conta." };
  const { error } = await auth.client.rpc("delete_my_product_review", {
    p_product_id: productId,
  });
  if (error)
    return { ok: false, message: "Não foi possível remover a avaliação." };
  revalidatePath("/loja");
  return { ok: true, message: "Avaliação removida." };
}

export async function setCartItem(variantId: string, quantity: number) {
  const auth = await authenticated();
  if (!auth)
    return {
      ok: false,
      requiresLogin: true,
      message: "Entre na sua conta para usar o carrinho.",
    };
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99)
    return { ok: false, requiresLogin: false, message: "Quantidade inválida." };
  const { error } = await auth.client.rpc("set_cart_item", {
    p_variant_id: variantId,
    p_quantity: quantity,
  });
  if (error)
    return {
      ok: false,
      requiresLogin: false,
      message: "Item indisponível ou quantidade acima do estoque.",
    };
  revalidatePath("/carrinho");
  revalidatePath("/", "layout");
  return {
    ok: true,
    requiresLogin: false,
    message: quantity ? "Adicionado ao carrinho." : "Item removido.",
  };
}

export async function addCartItem(variantId: string, quantity: number) {
  const auth = await authenticated();
  if (!auth)
    return {
      ok: false,
      requiresLogin: true,
      message: "Entre na sua conta para usar o carrinho.",
    };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99)
    return { ok: false, requiresLogin: false, message: "Quantidade inválida." };
  const { data, error } = await auth.client.rpc("get_my_cart");
  if (error || !Array.isArray(data))
    return {
      ok: false,
      requiresLogin: false,
      message: "Não foi possível consultar o carrinho.",
    };
  const current = data.find((item) => item.variant_id === variantId)?.quantity;
  const next = quantity + (typeof current === "number" ? current : 0);
  if (next > 99)
    return {
      ok: false,
      requiresLogin: false,
      message: "Limite de quantidade atingido.",
    };
  return setCartItem(variantId, next);
}

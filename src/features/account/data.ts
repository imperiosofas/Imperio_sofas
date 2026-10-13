import "server-only";

import { createSupabaseServerClient } from "../../lib/supabase/server";

export type AccountSnapshot = {
  displayName: string | null;
  contactPhone: string | null;
  isAdmin: boolean;
  cartCount: number | null;
};

export async function getAccountSnapshot(
  userId: string,
): Promise<AccountSnapshot> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      displayName: null,
      contactPhone: null,
      isAdmin: false,
      cartCount: null,
    };
  }

  const [profileResult, membershipResult, cartResult] = await Promise.all([
    supabase
      .from("customer_profiles")
      .select("display_name, contact_phone")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("catalog_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.rpc("get_my_cart"),
  ]);

  const cartCount =
    cartResult.error || !Array.isArray(cartResult.data)
      ? null
      : cartResult.data.reduce((sum, item) => {
          const quantity = (item as { quantity?: unknown }).quantity;
          return sum + (typeof quantity === "number" ? quantity : 0);
        }, 0);

  return {
    displayName: profileResult.error
      ? null
      : (profileResult.data?.display_name ?? null),
    contactPhone: profileResult.error
      ? null
      : (profileResult.data?.contact_phone ?? null),
    isAdmin: !membershipResult.error && Boolean(membershipResult.data),
    cartCount,
  };
}

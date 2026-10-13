"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "../../lib/supabase/server";

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  const national =
    digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (
    !/^(1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1-5]|6[1-9]|7[134579]|8[1-9]|9[1-9])([2-5][0-9]{7}|9[0-9]{8})$/.test(
      national,
    )
  )
    return "invalid";
  return `+55${national}`;
}

export async function saveCustomerProfile(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return { ok: false, message: "Serviço de conta indisponível." };
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (authError || typeof userId !== "string") {
    return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  }

  const displayName = normalizeName(String(formData.get("displayName") ?? ""));
  const phone = normalizePhone(String(formData.get("contactPhone") ?? ""));
  if (
    displayName.length < 2 ||
    displayName.length > 80 ||
    /[\x00-\x1f\x7f]/.test(displayName)
  ) {
    return { ok: false, message: "Informe um nome entre 2 e 80 caracteres." };
  }
  if (phone === "invalid") {
    return {
      ok: false,
      message: "Informe um telefone brasileiro com DDD, como (12) 98888-7777.",
    };
  }

  const { error } = await supabase.from("customer_profiles").upsert(
    {
      user_id: userId,
      display_name: displayName,
      contact_phone: phone,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error)
    return { ok: false, message: "Não foi possível salvar seus dados agora." };

  revalidatePath("/conta");
  revalidatePath("/conta/perfil");
  return { ok: true, message: "Seus dados foram salvos." };
}

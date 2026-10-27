import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CatalogProductGrid } from "../../../../features/catalog/CatalogProductGrid";
import { AccountShell } from "../../../../features/account/AccountShell";
import { getAccountSnapshot } from "../../../../features/account/data";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { getAccountAccess } from "../../../../lib/supabase/account-access";
import {
  getFavoriteProducts,
  getReviewSummaries,
} from "../../../../features/commerce/data";

export const metadata: Metadata = {
  title: "Meus favoritos",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/conta");
  const access = await getAccountAccess(supabase);
  if (access.status !== "authenticated")
    redirect("/conta?next=%2Fconta%2Ffavoritos");
  const [{ displayName, isAdmin, cartCount }, products] = await Promise.all([
    getAccountSnapshot(access.userId),
    getFavoriteProducts(),
  ]);
  const summaries = await getReviewSummaries(products.map((item) => item.id));
  return (
    <AccountShell
      email={access.email}
      displayName={displayName}
      isAdmin={isAdmin}
      cartCount={cartCount}
      active="favorites"
    >
      <div className="min-h-[60vh] text-ivory">
        <h2 className="font-display text-4xl">Favoritos</h2>
        <p className="mb-6 mt-2 max-w-xl text-sm leading-6 text-muted">
          {products.length
            ? `${products.length} ${products.length === 1 ? "modelo salvo" : "modelos salvos"}. Toque no coração para tirar da lista.`
            : "Salve os modelos que você gostou para comparar com calma depois."}
        </p>
        {products.length ? (
          <CatalogProductGrid
            products={products}
            summaries={summaries}
            favorites={new Set(products.map((item) => item.id))}
          />
        ) : (
          <div className="border-t border-white/20 py-10">
            <p className="text-ivory">Você ainda não salvou nenhum modelo.</p>
            <p className="mt-2 text-sm text-muted">
              Ao navegar pela loja, toque no coração de um produto para
              guardá-lo aqui.
            </p>
            <Link
              href="/loja"
              className="mt-6 inline-flex min-h-12 items-center rounded-full bg-gold px-6 font-bold text-ink"
            >
              Explorar a loja
            </Link>
          </div>
        )}
      </div>
    </AccountShell>
  );
}

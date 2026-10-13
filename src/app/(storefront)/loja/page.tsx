import type { Metadata } from "next";
import { CatalogListingPage } from "../../../features/catalog/CatalogListingPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Loja",
  description: "Conheça os modelos disponíveis da Império Sofás.",
  alternates: { canonical: "/loja" },
};

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CatalogListingPage searchValues={await searchParams} />;
}

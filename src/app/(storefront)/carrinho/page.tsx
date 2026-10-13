import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CartExperience } from "../../../features/commerce/CartExperience";
import {
  getCommerceIdentity,
  getMyCart,
} from "../../../features/commerce/data";

export const metadata: Metadata = {
  title: "Carrinho",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const { userId } = await getCommerceIdentity();
  if (!userId) redirect("/conta?next=%2Fcarrinho");
  return <CartExperience items={await getMyCart()} />;
}

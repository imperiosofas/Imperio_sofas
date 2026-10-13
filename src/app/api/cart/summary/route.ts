import { NextResponse } from "next/server";
import { getCommerceIdentity } from "../../../../features/commerce/data";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  const { client, userId } = await getCommerceIdentity();
  if (!client || !userId) {
    return NextResponse.json({ authenticated: false, count: 0 }, { headers });
  }

  const { data, error } = await client.rpc("get_my_cart");
  if (error || !Array.isArray(data)) {
    return NextResponse.json(
      { authenticated: true, count: null },
      { status: 503, headers },
    );
  }

  const count = data.reduce((total, item) => {
    const quantity = (item as { quantity?: unknown }).quantity;
    return total + (typeof quantity === "number" ? quantity : 0);
  }, 0);

  return NextResponse.json({ authenticated: true, count }, { headers });
}

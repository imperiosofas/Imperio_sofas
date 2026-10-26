import { lookupPostalCode } from "../../../../features/logistics/cep-lookup.mjs";

export async function GET(request: Request) {
  const postalCode = new URL(request.url).searchParams.get("cep");
  const result = await lookupPostalCode(postalCode);

  if (result.status === "invalid") {
    return Response.json(result, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (result.status === "not_found") {
    return Response.json(result, {
      status: 404,
      headers: { "Cache-Control": "public, max-age=0, s-maxage=300" },
    });
  }
  if (result.status === "unavailable") {
    return Response.json(result, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return Response.json(result, {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=86400, stale-while-revalidate=300",
    },
  });
}

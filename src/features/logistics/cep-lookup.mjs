const VIACEP_BASE_URL = "https://viacep.com.br/ws";
const IBGE_MUNICIPALITY_BASE_URL =
  "https://servicodados.ibge.gov.br/api/v1/localidades/municipios";
const LOOKUP_TIMEOUT_MS = 3500;
const LOOKUP_CACHE_SECONDS = 86400;

export function normalizePostalCode(value) {
  if (typeof value !== "string") return null;
  const formatted = value.trim();
  if (!/^\d{5}-?\d{3}$/.test(formatted)) return null;
  return formatted.replace("-", "");
}

function validMunicipality(payload, municipalityId, state) {
  const municipalityState = payload?.microrregiao?.mesorregiao?.UF?.sigla;
  return (
    payload?.id === municipalityId &&
    typeof payload?.nome === "string" &&
    payload.nome.trim().length > 0 &&
    municipalityState === state
  );
}

export async function lookupPostalCode(value, fetcher = fetch) {
  const postalCode = normalizePostalCode(value);
  if (!postalCode) return { status: "invalid" };

  try {
    const viaCepResponse = await fetcher(
      `${VIACEP_BASE_URL}/${postalCode}/json/`,
      {
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
        next: { revalidate: LOOKUP_CACHE_SECONDS },
      },
    );
    if (!viaCepResponse.ok) return { status: "unavailable" };

    const viaCep = await viaCepResponse.json();
    if (viaCep?.erro === "true" || viaCep?.erro === true)
      return { status: "not_found" };

    const municipalityId = String(viaCep?.ibge ?? "");
    const state = String(viaCep?.uf ?? "").toUpperCase();
    const city = String(viaCep?.localidade ?? "").trim();
    if (!/^\d{7}$/.test(municipalityId) || !/^[A-Z]{2}$/.test(state) || !city)
      return { status: "unavailable" };

    const ibgeResponse = await fetcher(
      `${IBGE_MUNICIPALITY_BASE_URL}/${municipalityId}`,
      {
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
        next: { revalidate: LOOKUP_CACHE_SECONDS },
      },
    );
    if (!ibgeResponse.ok) return { status: "unavailable" };

    const municipality = await ibgeResponse.json();
    if (!validMunicipality(municipality, Number(municipalityId), state))
      return { status: "unavailable" };

    return {
      status: "found",
      postalCode,
      municipalityId,
      city: municipality.nome,
      state,
      street: typeof viaCep.logradouro === "string" ? viaCep.logradouro : "",
      neighborhood: typeof viaCep.bairro === "string" ? viaCep.bairro : "",
    };
  } catch {
    // Do not log CEPs or provider payloads; the caller gets a non-sensitive state.
    return { status: "unavailable" };
  }
}

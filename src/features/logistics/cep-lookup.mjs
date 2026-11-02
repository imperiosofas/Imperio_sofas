const VIACEP_BASE_URL = "https://viacep.com.br/ws";
const BRASILAPI_BASE_URL = "https://brasilapi.com.br/api/cep/v2";
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

async function lookupViaCep(postalCode, fetcher) {
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

// Fallback used only when ViaCEP or IBGE is unreachable (some providers rate
// limit or block datacenter IPs). BrasilAPI returns the IBGE city code itself.
async function lookupBrasilApi(postalCode, fetcher) {
  try {
    const response = await fetcher(`${BRASILAPI_BASE_URL}/${postalCode}`, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      next: { revalidate: LOOKUP_CACHE_SECONDS },
    });
    if (response.status === 404) return { status: "not_found" };
    if (!response.ok) return { status: "unavailable" };

    const payload = await response.json();
    const municipalityId = String(payload?.ibge?.city ?? "");
    const state = String(payload?.state ?? "").toUpperCase();
    const city = String(payload?.city ?? "").trim();
    if (!/^\d{7}$/.test(municipalityId) || !/^[A-Z]{2}$/.test(state) || !city)
      return { status: "unavailable" };

    return {
      status: "found",
      postalCode,
      municipalityId,
      city,
      state,
      street: typeof payload.street === "string" ? payload.street : "",
      neighborhood:
        typeof payload.neighborhood === "string" ? payload.neighborhood : "",
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function lookupPostalCode(value, fetcher = fetch) {
  const postalCode = normalizePostalCode(value);
  if (!postalCode) return { status: "invalid" };

  const primary = await lookupViaCep(postalCode, fetcher);
  if (primary.status !== "unavailable") return primary;
  return lookupBrasilApi(postalCode, fetcher);
}

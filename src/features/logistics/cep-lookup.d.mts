export type PostalCodeLookupResult =
  | { status: "invalid" | "not_found" | "unavailable" }
  | {
      status: "found";
      postalCode: string;
      municipalityId: string;
      city: string;
      state: string;
      street: string;
      neighborhood: string;
    };

export function normalizePostalCode(value: unknown): string | null;
export function lookupPostalCode(
  value: unknown,
  fetcher?: typeof fetch,
): Promise<PostalCodeLookupResult>;

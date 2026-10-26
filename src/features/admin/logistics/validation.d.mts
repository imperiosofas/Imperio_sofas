export function normalizeMunicipalityName(value: unknown): string;
export function getApprovedMunicipality(
  ibgeCode: unknown,
  cityName: unknown,
): { ibgeCode: string; cityName: string; stateCode: "SP" } | null;
export function isApprovedMunicipalityCode(ibgeCode: unknown): boolean;
export function getApprovedMunicipalityByCode(ibgeCode: unknown): {
  ibgeCode: string;
  cityName: string;
  stateCode: "SP";
} | null;
export function normalizePickupLocationInput(value: unknown): {
  locationCode: string;
  displayName: string;
  street: string;
  streetNumber: string;
  neighborhood: string;
  postalCode: string;
  ibgeCode: string;
  cityName: string;
  stateCode: "SP";
  isActive: boolean;
} | null;
export function buildLogisticsSupplierUpdateArgs(value: {
  supplierId: string;
  displayName: string;
  isActive: boolean;
  allowsPickup: boolean;
  allowsDelivery: boolean;
  leadMinBusinessDays: number;
  leadMaxBusinessDays: number;
  deliveryQuoteRequired: boolean;
  adminNotes: string | null;
}): {
  p_supplier_id: string;
  p_display_name: string;
  p_is_active: boolean;
  p_allows_pickup: boolean;
  p_allows_delivery: boolean;
  p_lead_min_business_days: number;
  p_lead_max_business_days: number;
  p_delivery_quote_required: boolean;
  p_admin_notes: string | null;
};
export function buildLogisticsPickupLocationArgs(
  pickupLocationId: string | null,
  supplierId: string,
  fields: NonNullable<ReturnType<typeof normalizePickupLocationInput>>,
): {
  p_pickup_location_id: string | null;
  p_supplier_id: string;
  p_location_code: string;
  p_display_name: string;
  p_street: string;
  p_street_number: string;
  p_neighborhood: string;
  p_postal_code: string;
  p_ibge_code: string;
  p_is_active: boolean;
};
export function parseBrazilianCurrencyToCents(value: unknown): number | null;
export function parseNonNegativeInteger(
  value: unknown,
  maximum?: number,
): number | null;
export function isValidWhatsappE164(value: unknown): boolean;
export function normalizeSearchText(value: unknown): string;
export function normalizeBulkSupplierAssignment(value: unknown): {
  productIds: string[];
  supplierId: string;
} | null;

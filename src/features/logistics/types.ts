export type SupplierCode = "VALE" | "MUNDIAL";
export type LogisticsMode = "pickup" | "delivery";

export type PickupLocation = {
  id: string;
  supplierCode: SupplierCode | null;
  displayName: string;
  street: string;
  streetNumber: string;
  neighborhood: string;
  postalCode: string;
  cityName: string;
  stateCode: string;
};

export type DeliveryArea = {
  ibgeCode: string;
  cityName: string;
  stateCode: string;
};

export type FloorCharge = {
  floorChargeCents: number;
  includedThroughFloor: number;
  appliedOncePerQuoteAddress: boolean;
};

export type PublicProductLogistics = {
  supplierCode: SupplierCode | null;
  supplierName: string | null;
  supplierActive: boolean;
  supplierAssigned: boolean;
  fulfillmentModes: LogisticsMode[];
  minBusinessDays: number | null;
  maxBusinessDays: number | null;
  deliveryQuoteRequired: boolean | null;
  deliveryAreas: DeliveryArea[];
  pickupLocations: PickupLocation[];
  floorCharge: FloorCharge;
};

export type CartItemLogistics = {
  supplierCode: SupplierCode | null;
  supplierName: string | null;
  supplierAssigned: boolean;
  availableForQuote: boolean;
  fulfillmentModes: LogisticsMode[];
};

export type CartLogisticsPresentation = {
  deliveryAreas: DeliveryArea[];
  pickupLocations: PickupLocation[];
  floorCharge: FloorCharge;
};

export type LogisticsQuoteGroup = {
  id?: string;
  supplierCode: SupplierCode;
  mode: LogisticsMode;
  status: "awaiting_quote" | "quoted" | "cancelled" | "invalidated";
  baseFreightCents: number | null;
  items: { productName: string; quantity: number }[];
};

export type CustomerLogisticsQuote = {
  id: string;
  status:
    | "awaiting_quote"
    | "quoted"
    | "accepted"
    | "rejected"
    | "cancelled"
    | "invalidated"
    | "expired";
  createdAt: string;
  cityName: string | null;
  stateCode: string | null;
  postalCode: string | null;
  floorNumber: number | null;
  floorChargeCents: number;
  groups: LogisticsQuoteGroup[];
};

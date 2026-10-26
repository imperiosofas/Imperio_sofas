import type { CartItem } from "../commerce/data";
import type { LogisticsMode, SupplierCode } from "./types";

export function createQuoteIdempotency(makeId: () => string): {
  get(fingerprint: string): string;
  clear(): void;
};

export function getCartSnapshotFingerprint(cart: CartItem[]): string;

export function getQuoteRequestFingerprint(input: {
  cart: CartItem[];
  supplierModes: {
    supplierCode: SupplierCode;
    mode: LogisticsMode;
    pickupLocationId: string | null;
  }[];
  address: {
    postalCode: string;
    floor: number;
    number: string;
    complement: string;
  } | null;
  verifiedCep: {
    postalCode: string;
    municipalityId: string;
    city: string;
    state: string;
    street: string;
    neighborhood: string;
  } | null;
}): Promise<string>;

export type CatalogStorageCleanupClaim =
  | {
      outcome: "claimed";
      claimToken: string;
      productId: string;
      bucketId: string;
      storagePath: string;
    }
  | { outcome: "completed" | "busy" | "missing" };

export type CatalogStorageCleanupPorts = {
  claim(cleanupId: string): Promise<CatalogStorageCleanupClaim>;
  exists(
    bucketId: string,
    productId: string,
    storagePath: string,
  ): Promise<boolean>;
  remove(bucketId: string, storagePath: string): Promise<void>;
  finish(
    cleanupId: string,
    claimToken: string,
    errorCode?: string,
  ): Promise<boolean>;
};

export function runCatalogStorageCleanup(
  cleanupId: string,
  ports: CatalogStorageCleanupPorts,
): Promise<{
  ok: boolean;
  state: "completed" | "pending" | "missing" | "unavailable";
}>;

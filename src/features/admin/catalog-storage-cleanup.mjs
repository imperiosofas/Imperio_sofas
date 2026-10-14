const ownedPath = (productId, path) =>
  typeof path === "string" &&
  new RegExp(
    `^products/${productId}/[0-9a-fA-F-]{36}\\.(?:jpg|jpeg|png|webp)$`,
  ).test(path);

/**
 * Runs one claimed cleanup job using only the caller's authenticated client.
 * Storage paths are never accepted from the browser; the claim RPC returns a
 * path already bound to product_media by the database.
 */
export async function runCatalogStorageCleanup(cleanupId, ports) {
  let claim;
  try {
    claim = await ports.claim(cleanupId);
  } catch {
    return { ok: false, state: "unavailable" };
  }

  if (claim.outcome === "completed") return { ok: true, state: "completed" };
  if (claim.outcome === "busy") return { ok: false, state: "pending" };
  if (claim.outcome !== "claimed") return { ok: false, state: "missing" };

  if (
    claim.bucketId !== "catalog-images" ||
    !ownedPath(claim.productId, claim.storagePath)
  ) {
    try {
      await ports.finish(
        cleanupId,
        claim.claimToken,
        "path_ownership_mismatch",
      );
    } catch {
      // The uncompleted claim expires and can be retried safely.
    }
    return { ok: false, state: "pending" };
  }

  try {
    const exists = await ports.exists(
      claim.bucketId,
      claim.productId,
      claim.storagePath,
    );
    if (exists) await ports.remove(claim.bucketId, claim.storagePath);
    const remains = await ports.exists(
      claim.bucketId,
      claim.productId,
      claim.storagePath,
    );
    if (remains) {
      await ports.finish(cleanupId, claim.claimToken, "storage_remove_failed");
      return { ok: false, state: "pending" };
    }
  } catch (error) {
    const code =
      error?.code === "storage_list_failed"
        ? "storage_list_failed"
        : "storage_remove_failed";
    try {
      await ports.finish(cleanupId, claim.claimToken, code);
    } catch {
      // An unfinalized claim expires and can be reclaimed after its lease.
    }
    return { ok: false, state: "pending" };
  }

  try {
    const finalized = await ports.finish(cleanupId, claim.claimToken);
    return finalized
      ? { ok: true, state: "completed" }
      : { ok: false, state: "pending" };
  } catch {
    // The Storage deletion may have succeeded. The lease expiry makes this
    // exact path safe to retry; a missing object is treated as already done.
    return { ok: false, state: "pending" };
  }
}

import assert from "node:assert/strict";
import test from "node:test";
import { runCatalogStorageCleanup } from "../src/features/admin/catalog-storage-cleanup.mjs";

const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const cleanupId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const token = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const path = `products/${productId}/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp`;

function ports(overrides = {}) {
  const calls = {
    claims: 0,
    exists: 0,
    removes: 0,
    finishes: [],
    objectPresent: true,
  };
  return {
    calls,
    claim: async (id) => {
      calls.claims += 1;
      assert.equal(id, cleanupId);
      return {
        outcome: "claimed",
        claimToken: token,
        productId,
        bucketId: "catalog-images",
        storagePath: path,
      };
    },
    exists: async () => {
      calls.exists += 1;
      return calls.objectPresent;
    },
    remove: async () => {
      calls.removes += 1;
      calls.objectPresent = false;
    },
    finish: async (_id, _token, errorCode) => {
      calls.finishes.push({ errorCode });
      if (errorCode) return true;
      // Mirrors the database RPC's server-side storage.objects absence check.
      return !calls.objectPresent;
    },
    ...overrides,
  };
}

test("cleanup succeeds and removes only the claimed owned object", async () => {
  const p = ports();
  assert.deepEqual(await runCatalogStorageCleanup(cleanupId, p), {
    ok: true,
    state: "completed",
  });
  assert.equal(p.calls.exists, 2);
  assert.equal(p.calls.removes, 1);
  assert.deepEqual(p.calls.finishes, [{ errorCode: undefined }]);
});

test("Storage failure stays pending and a later retry can complete", async () => {
  let fail = true;
  const p = ports({
    async remove() {
      if (fail)
        throw Object.assign(new Error("redacted"), {
          code: "storage_remove_failed",
        });
      this.calls.removes += 1;
      this.calls.objectPresent = false;
    },
  });
  assert.equal((await runCatalogStorageCleanup(cleanupId, p)).state, "pending");
  assert.deepEqual(p.calls.finishes[0], {
    errorCode: "storage_remove_failed",
  });
  fail = false;
  assert.equal(
    (await runCatalogStorageCleanup(cleanupId, p)).state,
    "completed",
  );
  assert.equal(p.calls.removes, 1);
});

test("pending cleanup remains retryable by job ID after product and media deletion", async () => {
  let firstAttempt = true;
  const p = ports({
    async claim(id) {
      this.calls.claims += 1;
      assert.equal(id, cleanupId);
      return {
        outcome: "claimed",
        claimToken: token,
        productId,
        bucketId: "catalog-images",
        storagePath: path,
      };
    },
    async remove() {
      if (firstAttempt) {
        firstAttempt = false;
        throw Object.assign(new Error("redacted"), {
          code: "storage_remove_failed",
        });
      }
      this.calls.removes += 1;
      this.calls.objectPresent = false;
    },
  });

  // Product and product_media no longer exist; both attempts address only the outbox ID.
  assert.equal((await runCatalogStorageCleanup(cleanupId, p)).state, "pending");
  assert.deepEqual(await runCatalogStorageCleanup(cleanupId, p), {
    ok: true,
    state: "completed",
  });
  assert.equal(p.calls.claims, 2);
  assert.equal(p.calls.removes, 1);
});

test("cleanup stays pending and refuses success if object remains after remove", async () => {
  const p = ports({
    async remove() {
      this.calls.removes += 1;
      // Simulate a Storage API that reported no error but left the object.
    },
  });

  assert.deepEqual(await runCatalogStorageCleanup(cleanupId, p), {
    ok: false,
    state: "pending",
  });
  assert.equal(p.calls.objectPresent, true);
  assert.deepEqual(p.calls.finishes, [{ errorCode: "storage_remove_failed" }]);
});

test("a duplicate retry after completion is idempotent", async () => {
  const p = ports({
    async claim() {
      return { outcome: "completed" };
    },
  });
  assert.deepEqual(await runCatalogStorageCleanup(cleanupId, p), {
    ok: true,
    state: "completed",
  });
  assert.equal(p.calls.removes, 0);
});

test("retry cooldown does not call Storage while the database reports busy", async () => {
  const p = ports({
    async claim() {
      return { outcome: "busy" };
    },
  });
  assert.deepEqual(await runCatalogStorageCleanup(cleanupId, p), {
    ok: false,
    state: "pending",
  });
  assert.equal(p.calls.exists, 0);
  assert.equal(p.calls.removes, 0);
});

test("missing Storage object is completed without calling remove", async () => {
  const p = ports({
    async exists() {
      this.calls.exists += 1;
      this.calls.objectPresent = false;
      return false;
    },
  });
  assert.equal(
    (await runCatalogStorageCleanup(cleanupId, p)).state,
    "completed",
  );
  assert.equal(p.calls.removes, 0);
  assert.deepEqual(p.calls.finishes[0], { errorCode: undefined });
});

test("a path owned by another product is never sent to Storage", async () => {
  const p = ports({
    async claim() {
      return {
        outcome: "claimed",
        claimToken: token,
        productId,
        bucketId: "catalog-images",
        storagePath: `products/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/${path.split("/").at(-1)}`,
      };
    },
  });
  assert.equal((await runCatalogStorageCleanup(cleanupId, p)).state, "pending");
  assert.equal(p.calls.exists, 0);
  assert.equal(p.calls.removes, 0);
  assert.equal(p.calls.finishes[0].errorCode, "path_ownership_mismatch");
});

test("unauthorized claim fails closed before listing or removing", async () => {
  const p = ports({
    async claim() {
      throw new Error("forbidden");
    },
  });
  assert.equal(
    (await runCatalogStorageCleanup(cleanupId, p)).state,
    "unavailable",
  );
  assert.equal(p.calls.exists, 0);
  assert.equal(p.calls.removes, 0);
  assert.equal(p.calls.finishes.length, 0);
});

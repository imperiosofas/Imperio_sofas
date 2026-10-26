import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createSecretKeyFetch } from "../src/lib/supabase/secret-key-fetch.mjs";

const sentinel = "sb_secret_test_only_never_a_real_credential";

test("supabase-js keeps secret sentinel in apikey and wrapper removes its bearer header", async () => {
  const requests = [];
  const client = createClient("https://example.invalid", sentinel, {
    global: {
      fetch: createSecretKeyFetch(sentinel, async (request) => {
        requests.push(request);
        return new Response('"ok"', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data, error } = await client.rpc("sentinel_test");
  assert.equal(error, null);
  assert.equal(data, "ok");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].headers.get("apikey"), sentinel);
  assert.equal(requests[0].headers.get("Authorization"), null);
});

test("wrapper preserves a different Authorization header and all other headers", async () => {
  let observed;
  const wrapped = createSecretKeyFetch(sentinel, async (request) => {
    observed = request;
    return new Response(null, { status: 204 });
  });
  await wrapped("https://example.invalid/rest/v1/rpc/test", {
    headers: {
      Authorization: "Bearer a-user-session-token",
      apikey: "sb_publishable_test_key",
      "X-Trace": "trace-preserved",
    },
  });
  assert.equal(
    observed.headers.get("Authorization"),
    "Bearer a-user-session-token",
  );
  assert.equal(observed.headers.get("apikey"), "sb_publishable_test_key");
  assert.equal(observed.headers.get("X-Trace"), "trace-preserved");
});

test("wrapper removes only exact bearer text, not a different token or spacing", async () => {
  const observed = [];
  const wrapped = createSecretKeyFetch(sentinel, async (request) => {
    observed.push(request.headers.get("Authorization"));
    return new Response(null, { status: 204 });
  });
  for (const authorization of [
    `Bearer  ${sentinel}`,
    `bearer ${sentinel}`,
    "Bearer another-token",
  ]) {
    await wrapped("https://example.invalid/", { headers: { authorization } });
  }
  assert.deepEqual(observed, [
    `Bearer  ${sentinel}`,
    `bearer ${sentinel}`,
    "Bearer another-token",
  ]);
});

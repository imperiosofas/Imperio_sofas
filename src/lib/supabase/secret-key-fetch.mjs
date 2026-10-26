/**
 * Supabase sb_secret keys belong in `apikey`, not as a JWT bearer token.
 * Remove only the exact SDK-generated Authorization value that equals this
 * server-side key; preserve user JWTs and every other header unchanged.
 */
export function createSecretKeyFetch(secretKey, fetcher = fetch) {
  if (typeof secretKey !== "string" || !secretKey)
    throw new TypeError(
      "A secret key is required to create the server fetch wrapper.",
    );

  const generatedBearer = `Bearer ${secretKey}`;
  return async (input, init) => {
    const request = new Request(input, init);
    if (request.headers.get("Authorization") === generatedBearer)
      request.headers.delete("Authorization");
    return fetcher(request);
  };
}

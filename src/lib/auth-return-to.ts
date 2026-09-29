const safeDestinations = new Set([
  "/conta",
  "/conta/redefinir-senha",
  "/conta/seguranca",
  "/carrinho",
]);

/** Accept only known internal destinations; never pass user URLs to redirects. */
export function getSafeAuthReturnTo(value: string | null | undefined) {
  return value && safeDestinations.has(value) ? value : "/conta";
}

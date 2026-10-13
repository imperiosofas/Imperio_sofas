const safeDestinations = new Set([
  "/conta",
  "/conta/redefinir-senha",
  "/conta/seguranca",
  "/conta/favoritos",
  "/carrinho",
  "/loja",
  "/admin",
  "/admin/avaliacoes",
  "/admin/produtos",
  "/admin/produtos/novo",
]);

/** Accept only known internal destinations; never pass user URLs to redirects. */
export function getSafeAuthReturnTo(value: string | null | undefined) {
  const isStorePage =
    typeof value === "string" &&
    /^\/(?:produto|loja)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  const isAdminProduct =
    typeof value === "string" &&
    /^\/admin\/produtos\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );

  return value && (safeDestinations.has(value) || isAdminProduct || isStorePage)
    ? value
    : "/conta";
}

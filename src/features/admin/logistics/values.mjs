export function formatBRLFromCents(value) {
  if (!Number.isSafeInteger(value) || value < 0) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

export function formatBRLInputFromCents(value) {
  if (!Number.isSafeInteger(value) || value < 0) return "";
  return (value / 100).toFixed(2).replace(".", ",");
}

export function parseBRLToCents(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimal = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function statusLabel(status) {
  const labels = {
    awaiting_quote: "Aguardando cotação",
    quoted: "Cotação enviada",
    accepted: "Aceita pelo cliente",
    rejected: "Recusada pelo cliente",
    cancelled: "Cancelada",
    invalidated: "Invalidada",
    expired: "Expirada",
  };
  return labels[status] ?? "Status não reconhecido";
}

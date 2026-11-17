const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBrlFromCents(amountCents: number): string {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new RangeError(
      "O valor em centavos precisa ser um inteiro não negativo.",
    );
  }

  return brlFormatter.format(amountCents / 100);
}

/**
 * Parses a BRL amount typed by an admin into integer cents.
 * Accepts "1299", "1299,90", "1.299,90", "1.299" (thousands) and "1299.90".
 * Returns NaN for anything else. Integer math only (no float rounding).
 */
export function parseBrlToCents(value: string): number {
  let text = value
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s/g, "");
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return Number.NaN;
  const cents =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : Number.NaN;
}

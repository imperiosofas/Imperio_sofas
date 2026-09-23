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

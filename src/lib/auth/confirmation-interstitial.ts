import { NextResponse } from "next/server";

export type ConfirmationOtpType = "email" | "recovery";

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

export function createConfirmationInterstitialResponse({
  actionPath,
  tokenHash,
  type,
  nextPath,
}: {
  actionPath: "/auth/callback" | "/auth/confirm";
  tokenHash: string;
  type: ConfirmationOtpType;
  nextPath: string;
}) {
  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <title>Confirmar acesso | Império Sofás</title>
  </head>
  <body>
    <main>
      <h1>Confirme seu acesso</h1>
      <p>Para concluir com segurança, toque no botão abaixo.</p>
      <form method="post" action="${actionPath}">
        <input type="hidden" name="token_hash" value="${escapeHtml(tokenHash)}">
        <input type="hidden" name="type" value="${type}">
        <input type="hidden" name="next" value="${escapeHtml(nextPath)}">
        <button type="submit">Confirmar e continuar</button>
      </form>
    </main>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

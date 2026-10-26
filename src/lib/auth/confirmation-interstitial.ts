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

const copyByType: Record<
  ConfirmationOtpType,
  { title: string; lead: string; action: string }
> = {
  email: {
    title: "Confirme seu e-mail",
    lead: "Um último toque e sua conta fica pronta para salvar favoritos e o carrinho.",
    action: "Confirmar e-mail",
  },
  recovery: {
    title: "Crie uma nova senha",
    lead: "Toque no botão para escolher uma nova senha com segurança.",
    action: "Continuar",
  },
};

// The page is self-contained: the CSP below allows only inline styles and
// same-origin images, so everything visual lives in this stylesheet.
const interstitialStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  html { background: #070707; }
  body {
    margin: 0;
    min-height: 100vh;
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 1.5rem 1rem;
    color: #f4efe4;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    background:
      radial-gradient(ellipse 80% 60% at 50% 0%, rgb(215 170 66 / 11%), transparent 62%),
      linear-gradient(145deg, #090c12 0%, #05070b 58%, #0a0c11 100%);
    -webkit-font-smoothing: antialiased;
  }
  main {
    width: min(100%, 26rem);
    text-align: center;
    animation: arrive 420ms ease-out both;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.75rem;
    text-align: left;
  }
  .brand img {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: 0 0 0 1px rgb(215 170 66 / 35%);
  }
  .brand strong {
    display: block;
    font-family: "Cormorant Garamond", Georgia, "Times New Roman", serif;
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.1;
    color: #f4efe4;
  }
  .brand span {
    display: block;
    margin-top: 0.15rem;
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    color: #d7aa42;
  }
  .card {
    padding: 2.25rem 1.75rem 1.75rem;
    border-radius: 1.75rem;
    color: #1a1712;
    background: linear-gradient(145deg, #f8f3e9 0%, #f2ecdf 100%);
    box-shadow: 0 28px 70px rgb(0 0 0 / 45%), inset 0 1px 0 rgb(255 255 255 / 70%);
  }
  h1 {
    margin: 0;
    font-family: "Cormorant Garamond", Georgia, "Times New Roman", serif;
    font-size: clamp(2.1rem, 8vw, 2.6rem);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }
  .lead {
    margin: 0.9rem auto 1.75rem;
    max-width: 20rem;
    font-size: 0.95rem;
    line-height: 1.55;
    color: #4a443a;
    text-wrap: pretty;
  }
  button {
    width: 100%;
    padding: 0.95rem 1.25rem;
    border: 0;
    border-radius: 0.8rem;
    font: inherit;
    font-size: 1rem;
    font-weight: 700;
    color: #1a1305;
    cursor: pointer;
    background: linear-gradient(90deg, #c39336, #f4d47d 52%, #c39336);
    box-shadow: 0 8px 22px rgb(195 147 54 / 30%);
    transition: transform 140ms ease, box-shadow 140ms ease;
  }
  button:hover { transform: translateY(-1px); box-shadow: 0 12px 26px rgb(195 147 54 / 38%); }
  button:active { transform: translateY(0); }
  button:focus-visible { outline: 3px solid #1a1305; outline-offset: 3px; }
  .note {
    margin: 1.5rem 0 0;
    padding-top: 1.25rem;
    border-top: 1px solid rgb(26 23 18 / 12%);
    font-size: 0.8rem;
    line-height: 1.55;
    color: #6b6457;
    text-wrap: pretty;
  }
  @keyframes arrive { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) {
    main { animation: none; }
    button { transition: none; }
  }
`;

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
  const copy = copyByType[type];
  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <meta name="robots" content="noindex, nofollow">
    <meta name="color-scheme" content="dark">
    <title>${copy.title} | Império Sofás</title>
    <style>${interstitialStyles}</style>
  </head>
  <body>
    <main>
      <div class="brand">
        <img src="/imperio-sofas-logo-128.webp" alt="" width="48" height="48">
        <div>
          <strong>Império Sofás</strong>
          <span>Vale do Paraíba</span>
        </div>
      </div>
      <section class="card">
        <h1>${copy.title}</h1>
        <p class="lead">${copy.lead}</p>
        <form method="post" action="${actionPath}">
          <input type="hidden" name="token_hash" value="${escapeHtml(tokenHash)}">
          <input type="hidden" name="type" value="${type}">
          <input type="hidden" name="next" value="${escapeHtml(nextPath)}">
          <button type="submit">${copy.action}</button>
        </form>
        <p class="note">Esta etapa extra impede que programas automáticos usem seu link antes de você. Se você não pediu isso, pode fechar esta página.</p>
      </section>
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
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

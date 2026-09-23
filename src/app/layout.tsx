import type { Metadata } from "next";
import "../index.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Império Sofás | Sofás em Taubaté e região",
    template: "%s | Império Sofás",
  },
  description:
    "Conheça a Império Sofás e encontre o modelo ideal para sua casa.",
  robots:
    process.env.APP_ENV === "production"
      ? undefined
      : { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

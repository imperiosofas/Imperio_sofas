import type { Metadata, Viewport } from "next";
import "../index.css";
import { Header } from "../sections/Header";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Império Sofás | Sofás em Taubaté e região",
    template: "%s | Império Sofás",
  },
  description:
    "Descubra sofás para viver a casa do seu jeito e conte com atendimento próximo em Taubaté e no Vale do Paraíba.",
  robots:
    process.env.APP_ENV === "production"
      ? undefined
      : { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}

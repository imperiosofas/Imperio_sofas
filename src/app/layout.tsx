import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "../index.css";
import { Header } from "../sections/Header";
import { BottomNavigation } from "../sections/BottomNavigation";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant-garamond",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Império Sofás | Sofás em Taubaté e região",
    template: "%s | Império Sofás",
  },
  description:
    "Descubra sofás para viver a casa do seu jeito e conte com atendimento próximo em Taubaté e no Vale do Paraíba.",
  icons: { icon: "/favicon.png" },
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
    <html
      lang="pt-BR"
      className={`${inter.variable} ${cormorantGaramond.variable}`}
    >
      <body>
        <Header />
        {children}
        <BottomNavigation />
      </body>
    </html>
  );
}

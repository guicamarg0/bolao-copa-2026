import type { Metadata } from "next";
import { Bebas_Neue, Montserrat, Rajdhani } from "next/font/google";
import "./globals.css";

const fontDisplay = Bebas_Neue({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

const fontUi = Rajdhani({
  variable: "--font-ui",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const fontBody = Montserrat({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WorldBet 26",
  description:
    "WorldBet 26: plataforma premium de bolão da Copa do Mundo 2026 com experiências estilo fantasy game e sports SaaS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${fontDisplay.variable} ${fontUi.variable} ${fontBody.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--wb-bg)] font-body text-[var(--wb-text)]">
        {children}
      </body>
    </html>
  );
}

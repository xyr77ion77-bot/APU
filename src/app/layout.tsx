import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { PWARegister } from "@/components/civ/PWARegister";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CIV · Ingefalca — Análisis de Precios Unitarios",
  description:
    "Motor de Análisis de Precios Unitarios y Presupuestos del CIV · Tabulador CC vigente 19/08/2026 · Bono alimenticio Bs. 5.407,53/jornada",
  keywords: ["CIV", "COVENIN", "APU", "presupuestos", "ingeniería civil", "Venezuela", "Ingefalca"],
  authors: [{ name: "Constructora Ingefalca, C.A." }],
  icons: {
    icon: [{ url: "/icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "CIV · Ingefalca — Análisis de Precios Unitarios",
    description: "Motor de APU y presupuestos · 7.594 partidas · Tabulador CC 19/08/2026",
    siteName: "Constructora Ingefalca",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f2a4a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <PWARegister />
      </body>
    </html>
  );
}

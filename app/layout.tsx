import type { Metadata, Viewport } from "next";
import { getLang, getTheme } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tenda Desk",
  description: "Simamia tenda za NeST kutoka maandalizi hadi malipo",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={await getLang()} data-theme={await getTheme()}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

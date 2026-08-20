
import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { getDashboardBrand } from "@/lib/brand";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-latin",
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  fallback: [],
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getDashboardBrand();
  return {
    title: brand.metaTitle ?? brand.brandName,
    ...(brand.faviconUrl && { icons: { icon: brand.faviconUrl } }),
  };
}

import { LanguageProvider } from "@/lib/i18n-context";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" translate="no" className={`${cairo.variable} ${inter.variable} notranslate`} suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <LanguageProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange={false}
          >
            {children}
            <Toaster richColors position="top-left" />
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

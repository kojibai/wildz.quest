import type { Metadata, Viewport } from "next";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";
import "./globals.css";
import { PwaController } from "@/features/pwa/PwaController";

export const metadata: Metadata = {
  metadataBase: new URL(WILDZ_PRODUCT.origin),
  applicationName: WILDZ_PRODUCT.name,
  title: {
    default: WILDZ_PRODUCT.name,
    template: `%s · ${WILDZ_PRODUCT.name}`
  },
  description: WILDZ_PRODUCT.description,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: WILDZ_PRODUCT.name
  },
  icons: {
    icon: "/brand/wildz-mark.svg",
    shortcut: "/brand/wildz-mark.svg",
    apple: "/brand/wildz-mark.svg"
  },
  openGraph: {
    title: WILDZ_PRODUCT.name,
    description: WILDZ_PRODUCT.description,
    siteName: WILDZ_PRODUCT.name,
    type: "website"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: WILDZ_PRODUCT.themeColor
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<PwaController /></body>
    </html>
  );
}

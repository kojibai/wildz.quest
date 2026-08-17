import type { Metadata, Viewport } from "next";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";
import "./globals.css";
import { PwaController } from "@/features/pwa/PwaController";

export const metadata: Metadata = {
  metadataBase: new URL(WILDZ_PRODUCT.origin),
  applicationName: WILDZ_PRODUCT.name,
  title: {
    default: WILDZ_PRODUCT.title,
    template: `%s · ${WILDZ_PRODUCT.name}`
  },
  description: WILDZ_PRODUCT.description,
  category: "games",
  classification: "Living creature adventure game",
  alternates: {
    canonical: "/"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  formatDetection: {
    address: false,
    email: false,
    telephone: false
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: WILDZ_PRODUCT.name
  },
  icons: {
    icon: [
      { url: "/brand/wildz-mark.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" }
    ],
    shortcut: "/brand/wildz-mark.svg",
    apple: "/icons/icon-180.png"
  },
  openGraph: {
    title: WILDZ_PRODUCT.title,
    description: WILDZ_PRODUCT.description,
    siteName: WILDZ_PRODUCT.name,
    url: WILDZ_PRODUCT.origin,
    locale: "en_US",
    type: "website",
    images: [{
      url: WILDZ_PRODUCT.socialImage,
      width: 1200,
      height: 630,
      alt: "Wildz explorer bonding with a living creature beside its portable creature card"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title: WILDZ_PRODUCT.title,
    description: WILDZ_PRODUCT.description,
    images: [WILDZ_PRODUCT.socialImage]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: WILDZ_PRODUCT.themeColor },
    { media: "(prefers-color-scheme: dark)", color: WILDZ_PRODUCT.themeColor }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<PwaController /></body>
    </html>
  );
}

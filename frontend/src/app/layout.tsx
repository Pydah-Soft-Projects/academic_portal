import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import { PwaInstallProvider } from "@/components/pwa/PwaInstallProvider";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://acad.pydah.edu.in"),
  applicationName: "Campo Academic Portal",
  title: "Campo Academic Portal",
  description: "Campo Group Academic Portal",
  icons: {
    icon: [
      { url: "/campo-logos/favicon.ico", sizes: "any" },
      { url: "/campo-logos/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/campo-logos/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/campo-logos/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/campo-logos/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/campo-logos/favicon.ico",
    apple: [
      {
        url: "/campo-logos/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Campo Academic Portal",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Campo Academic Portal",
    description: "Campo Group Academic Portal",
    siteName: "Campo Academic Portal",
    type: "website",
    images: [
      {
        url: "/campo-logos/og-image.png",
        width: 800,
        height: 800,
        alt: "Campo Academic Portal",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Campo Academic Portal",
    description: "Campo Group Academic Portal",
    images: ["/campo-logos/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#1f3a5f",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-dvh overflow-hidden" suppressHydrationWarning>
      <body
        className={`${sourceSans.variable} h-dvh overflow-hidden antialiased`}
        suppressHydrationWarning
      >
        <PwaInstallProvider>{children}</PwaInstallProvider>
      </body>
    </html>
  );
}

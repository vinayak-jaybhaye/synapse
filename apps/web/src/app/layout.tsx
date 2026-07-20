import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthInitializer from "../components/AuthInitializer";
import Providers from "../components/shared/Providers";
import ErrorBoundary from "../components/shared/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Synapse — Real-Time Collaboration",
  description:
    "An open-source, ultra-fast real-time messaging and voice platform built for teams. Powered by Go, React, and WebSockets.",
  keywords: ["chat", "real-time", "voice", "collaboration", "open-source", "team communication"],
  authors: [{ name: "Synapse" }],
  icons: {
    icon: [
      { url: "/synapse-logo.svg", type: "image/svg+xml" },
      { url: "/synapse-logo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/synapse-logo-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/synapse-logo-192.png" }],
  },
  openGraph: {
    title: "Synapse — Real-Time Collaboration",
    description:
      "An open-source, ultra-fast real-time messaging and voice platform built for teams.",
    type: "website",
    siteName: "Synapse",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#18181b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary antialiased">
        <Providers>
          <ErrorBoundary>
            <AuthInitializer />
            {children}
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}

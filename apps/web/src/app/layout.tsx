import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthInitializer from "../components/AuthInitializer";
import Providers from "../components/shared/Providers";
import ErrorBoundary from "../components/shared/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Synapse - Realtime Collaboration",
  description: "A modern real-time communication platform built for teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary">
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

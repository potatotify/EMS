import type {Metadata} from "next";
import {Inter} from "next/font/google";

import "./globals.css";
import "../styles/design-system.css";
import AuthProvider from "@/components/providers/SessionProvider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  title: "WorkNest - Modern Team Management Platform",
  description:
    "Experience seamless team collaboration with clear insights and natural workflows. Built for the modern workplace.",
  keywords: [
    "team management",
    "project tracking",
    "employee monitoring",
    "collaboration"
  ],
  authors: [{name: "WorkNest"}]
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#10b981"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-inter antialiased overflow-x-hidden bg-neutral-50 text-neutral-900">
        <AuthProvider>
          <div className="relative min-h-screen">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}

import type {Metadata} from "next";
import {Poppins} from "next/font/google";

import "./globals.css";
import AuthProvider from "@/components/providers/SessionProvider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins"
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
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="font-poppins antialiased overflow-x-hidden">
        <AuthProvider>
          <div className="relative min-h-screen">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}

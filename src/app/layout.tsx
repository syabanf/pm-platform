import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppFrame } from "@/components/AppFrame";
import { PwaRegister } from "@/components/PwaRegister";
import { Toast } from "@/components/Toast";
import { PrototypeProvider } from "@/lib/store";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WIT Sprint OS",
  description:
    "AI-native Agile delivery platform for multi-client consulting teams.",
  applicationName: "WIT Sprint OS",
  appleWebApp: {
    capable: true,
    title: "Sprint OS",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets safe-area insets apply on notched devices
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <PrototypeProvider>
          <AppFrame>{children}</AppFrame>
          <Toast />
        </PrototypeProvider>
        <PwaRegister />
      </body>
    </html>
  );
}

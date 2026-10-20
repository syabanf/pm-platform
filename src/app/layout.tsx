import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppFrame } from "@/components/AppFrame";
import { PwaRegister } from "@/components/PwaRegister";
import { Toast } from "@/components/Toast";
import { PrototypeProvider } from "@/lib/store";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "projectOS",
  description:
    "AI-native Agile delivery platform for multi-client consulting teams.",
  applicationName: "projectOS",
  appleWebApp: {
    capable: true,
    title: "projectOS",
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
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}>
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

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GlobalLoader } from "@/components/global-loader";
import { displayName, getTenant } from "@/lib/tenant";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const name = displayName(await getTenant());
  return {
    title: { template: `%s · ${name}`, default: name },
    description: "Leads empfangen, verteilen und bearbeiten",
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        <GlobalLoader />
      </body>
    </html>
  );
}

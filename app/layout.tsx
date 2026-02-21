import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";

import "@/app/globals.css";
import { AppStoreProvider } from "@/src/components/providers/app-store-provider";

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Quiet Interview",
  description: "Psychologically intelligent AI interview practice",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sourceSerif.variable} ${inter.variable}`}>
      <body>
        <AppStoreProvider>
          <div className="mx-auto min-h-screen max-w-reading px-6 py-10 md:px-10 md:py-12">{children}</div>
        </AppStoreProvider>
      </body>
    </html>
  );
}

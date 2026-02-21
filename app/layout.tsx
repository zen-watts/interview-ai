import type { Metadata } from "next";
import type { ReactNode } from "react";

// Shared metadata for all pages in the app router.
export const metadata: Metadata = {
  title: "Poly Prompt",
  description: "Hackathon foundation app",
};

// Root layout used by every route. Keeps styling intentionally minimal for hackathon speed.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: "0 auto",
          maxWidth: 720,
          padding: "2rem 1rem",
        }}
      >
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "DOMOVINA Fiskal — dashboard",
  description:
    "Self-service izdavanje HR (fiskaliziranih) računa — prijava dijeljenim Domovina računom.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

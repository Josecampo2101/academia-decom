
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Escuela de Comunicaciones D34 | IPUC",
  description: "Escuela de Comunicaciones D34 · Formación para comunicar con propósito.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}

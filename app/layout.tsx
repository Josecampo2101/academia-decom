
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Academia DECOM | Formación institucional",
  description: "Formación para comunicar con propósito.",
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

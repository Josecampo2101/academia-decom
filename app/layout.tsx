import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Escuela de Comunicaciones D34 | IPUC",
  description:
    "Escuela de Comunicaciones D34 · Formación para comunicar con propósito.",
};

const themeInitializationScript = `
(function () {
  try {
    var saved = localStorage.getItem("academia-theme");
    var preference =
      saved === "light" || saved === "dark" || saved === "system"
        ? saved
        : "system";
    var dark =
      preference === "dark" ||
      (preference === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    document.documentElement.classList.toggle("dark", dark);
  } catch (error) {
    // If browser storage is unavailable, the CSS default remains light.
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <Script
          id="academia-theme-initialization"
          strategy="beforeInteractive"
        >
          {themeInitializationScript}
        </Script>
      </head>
      <body className={`${inter.variable} min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}

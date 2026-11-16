import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Escuela de Comunicaciones D34 | IPUC",
    template: "%s | Escuela de Comunicaciones D34",
  },
  description:
    "Escuela de Comunicaciones D34 · Formación para comunicar con propósito.",
};

// Color de la barra del navegador en móviles, según el tema del sistema.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1422" },
  ],
};

const themeInitializationScript = `
(function () {
  try {
    var saved = localStorage.getItem("academia-theme") || "system";
    var dark =
      saved === "dark" ||
      (saved === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;

    root.classList.toggle("dark", dark);
    root.setAttribute("data-theme", dark ? "dark" : "light");
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
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}

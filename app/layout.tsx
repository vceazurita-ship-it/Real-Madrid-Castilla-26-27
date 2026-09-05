import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DataProvider } from "@/app/contexts/data-context";
import { AIProvider } from "@/app/contexts/ai-context";
import { BotonAlertas } from "@/components/alertas/BotonAlertas";
import { PageExportButton } from "@/components/page-export-button";
import { ThemeProvider } from "@/components/theme-provider";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemedToaster } from "@/components/themed-toaster";
import { ServiceWorker } from "@/components/service-worker";
import { SinConexion } from "@/components/sin-conexion";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Real Madrid CF Castilla",
  description: "Plataforma Real Madrid CF Castilla",
  manifest: "/manifest.json",
  /* Los pinta `scripts/app-icons.mjs` desde el escudo de la barra superior.
     El de la pestaña sigue siendo `app/favicon.ico`, que Next enlaza solo. */
  icons: {
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /* El proveedor de tema reescribe esta etiqueta al cambiar de modo. */
  themeColor: "#0B0F14",
};

/**
 * Fija `data-theme` antes de que el navegador pinte nada, para que al recargar
 * en modo día no se vea un fogonazo oscuro. Va en línea a propósito: cualquier
 * script externo llegaría tarde.
 */
const themeInitScript = `
(function(){
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var theme = stored === "light" || stored === "dark" ? stored : ${JSON.stringify(DEFAULT_THEME)};
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", ${JSON.stringify(DEFAULT_THEME)});
  }
})();
`;

/*
| Los tres sitios de fuera a los que la app llama nada más abrir cualquier
| pantalla: las hojas publicadas, el Apps Script que las escribe y el
| almacén de fotos. Abrir la conexión aquí —DNS, TCP y TLS— adelanta entre
| una y tres décimas por cada uno, que hasta ahora se pagaban dentro de la
| primera petición, con la pantalla ya en blanco esperando sus datos.
|
| `crossOrigin` no es adorno: una conexión abierta sin él no le sirve a un
| `fetch()`, que sí va con CORS, y el navegador tendría que abrir otra.
*/
const PRECONECTAR: { url: string; cors?: boolean }[] = [
  { url: "https://docs.google.com", cors: true },
  { url: "https://script.google.com", cors: true },
  ...(process.env.NEXT_PUBLIC_SUPABASE_URL
    ? [{ url: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin }]
    : []),
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {PRECONECTAR.map(({ url, cors }) => (
          <link
            key={url}
            rel="preconnect"
            href={url}
            crossOrigin={cors ? "anonymous" : undefined}
          />
        ))}
      </head>

      <body className="min-h-screen flex flex-col overflow-x-hidden">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />

        <ThemeProvider>
          <AIProvider>
            <DataProvider>
              {children}
              <BotonAlertas />
              <ThemeToggle />
              <PageExportButton />
              <ThemedToaster />
              <ServiceWorker />
              <SinConexion />
            </DataProvider>
          </AIProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
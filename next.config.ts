import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},

  /*
  | Los binarios de vídeo no se empaquetan.
  |
  | `ffmpeg-static` y `ffprobe-static` no son código: son un `.exe` al lado de
  | un módulo que lo señala con `__dirname`. Si el empaquetador se los lleva
  | dentro del bundle del servidor, esa ruta deja de existir y el coding
  | responde que en esta máquina no hay motor de vídeo —aunque lo haya—.
  */
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],

  /*
  | Las funciones no se llevan dentro ni las fotos ni los vídeos.
  |
  | El trazado de Next mete en cada función los ficheros que cree que va a
  | necesitar, y con `carpetaDeVideos()` —que resuelve una ruta sobre
  | `process.cwd()`— se pone a la defensiva y se lleva **la raíz entera**:
  | `public/` con sus 300 MB de fotos y fondos, la carpeta `videos/` con los
  | partidos, los arneses de `scripts/`… `api/coding/export` acabó pesando
  | 250,33 MB y Vercel se planta en 250: el despliegue del 30/08/2026 se cayó
  | por 0,33 MB, justo al añadir un .pptx de referencia a `public/`.
  |
  | Nada de esto hace falta ahí dentro. `public/` lo sirve Vercel como
  | estático, aparte de las funciones, y **ninguna ruta de servidor lee un
  | fichero de ahí** —las fotos de jugador viajan por URL, no por disco—. Los
  | vídeos de partido viven fuera del proyecto en el despliegue
  | (`CODING_VIDEOS_DIR`), y en local no tienen por qué entrar en un bundle.
  |
  | Si algún día una función SÍ necesita un fichero del repo, se añade con
  | `outputFileTracingIncludes` para esa ruta; no se quita esta exclusión.
  */
  outputFileTracingExcludes: {
    "**": [
      "public/**",
      "videos/**",
      "scripts/**",
      ".git/**",
      ".next/cache/**",
    ],
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.realmadrid.com",
      },
      {
        protocol: "https",
        hostname: "elqaoxhxoybhoavkrpob.supabase.co",
      },
    ],
  },
};

export default nextConfig;
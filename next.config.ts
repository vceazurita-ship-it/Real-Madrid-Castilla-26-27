import type { NextConfig } from "next";

/* Render gratis = 512 MB en total (montón de JS + memoria nativa + sharp). El
   05/11/2026 se pasó y Render reinició el servicio (503/429 mientras tanto).
   Por eso, sólo allí: no precargar las ~120 rutas al arrancar, caché de
   páginas en disco y no en memoria, y fotos de una en una. Ver
   node_modules/next/dist/docs/01-app/02-guides/memory-usage.md. */
const enRender = Boolean(process.env.RENDER);

/* CACHE_BUILD=1 sólo en la copia de las ideas de X (scripts/x-idea-aplica.mjs):
   caché de Turbopack en disco para que su build de comprobación salga templado.
   Experimental en build; nunca en Render ni en el build normal. */
const cacheBuild = !enRender && process.env.CACHE_BUILD === "1";

/* TURBOPACK_RAIZ (19/11/2026), también sólo para la copia de X: vive fuera del
   repo (../x-ideas-obra) con node_modules enlazado al del repo, y Turbopack
   exige que el enlace caiga dentro de su raíz. Antes vivía DENTRO del repo y
   Next cogía el repo de fuera como raíz: compilaba los ficheros de arriba (su
   proxy.ts sin subir) y fallaba con «Module not found: @/lib/acceso/…». */
const raizTurbopack = !enRender ? process.env.TURBOPACK_RAIZ : undefined;

const nextConfig: NextConfig = {
  turbopack: raizTurbopack ? { root: raizTurbopack } : {},
  ...(raizTurbopack ? { outputFileTracingRoot: raizTurbopack } : {}),

  ...(enRender
    ? {
        cacheMaxMemorySize: 16 * 1024 * 1024,
        experimental: {
          preloadEntriesOnStart: false,
          imgOptConcurrency: 1,
          imgOptSequentialRead: true,
        },
      }
    : cacheBuild
      ? { experimental: { turbopackFileSystemCacheForBuild: true } }
      : {}),

  /*
  | Los binarios de vídeo no se empaquetan.
  |
  | `ffmpeg-static` y `ffprobe-static` no son código: son un `.exe` al lado de
  | un módulo que lo señala con `__dirname`. Si el empaquetador se los lleva
  | dentro del bundle del servidor, esa ruta deja de existir y el coding
  | responde que en esta máquina no hay motor de vídeo —aunque lo haya—.
  */
  /* En Render (512 MB) el repaso de tipos del build se queda sin memoria; los
     tipos ya los comprueba el CI de GitHub en cada push. */
  typescript: { ignoreBuildErrors: Boolean(process.env.RENDER) || process.env.SIN_TIPOS_EN_BUILD === "1" },
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static", "postgres"],

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
    /* 21/11/2026: un día en el navegador (por defecto 4 h): menos tráfico de Render (5 GB al mes). */
    minimumCacheTTL: 86400,
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
import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
});

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

export default withPWA(nextConfig);
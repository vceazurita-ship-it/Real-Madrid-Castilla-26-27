import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  turbopack: {},
};

export default withPWA(nextConfig);
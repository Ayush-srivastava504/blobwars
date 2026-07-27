// Next.js build config: standalone output for Docker, transpiles the
// shared workspace package and Phaser, and forwards public env vars
// (game server WS/HTTP URLs, Google client id) to the client bundle.
// No custom webpack or routing overrides.
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@blobwars/shared", "phaser"],
  env: {
    NEXT_PUBLIC_GAME_SERVER_WS: process.env.NEXT_PUBLIC_GAME_SERVER_WS,
    NEXT_PUBLIC_GAME_SERVER_HTTP: process.env.NEXT_PUBLIC_GAME_SERVER_HTTP,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  },
};

module.exports = nextConfig;
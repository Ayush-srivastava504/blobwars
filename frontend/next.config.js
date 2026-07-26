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
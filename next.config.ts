import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/catalog": ["./data/catalog.json"],
    "/api/costumes": ["./data/costumes.json"],
    "/api/costume-image": ["./data/costumes.json"],
    "/api/pose-image": ["./data/catalog.json"],
    "/api/prompt": ["./data/catalog.json", "./data/costumes.json"],
    "/api/character-sheet": ["./public/muse/dafeiyu-sheet.png"],
    "/api/generate": [
      "./data/catalog.json",
      "./data/costumes.json",
      "./public/muse/dafeiyu-sheet.png",
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-linuxmusl-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linuxmusl-x64/**/*",
    ],
  },
}

export default nextConfig

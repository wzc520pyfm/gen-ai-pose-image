import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/catalog": ["./data/catalog.json"],
    "/api/costumes": ["./data/costumes.json"],
    "/api/costume-image": ["./data/costumes.json"],
    "/api/pose-image": ["./data/catalog.json"],
    "/api/prompt": ["./data/catalog.json", "./data/costumes.json"],
    "/api/generate": ["./data/catalog.json", "./data/costumes.json", "./public/muse/dafeiyu-sheet.png"],
  },
}

export default nextConfig

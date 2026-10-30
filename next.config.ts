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
      "./shared/workflows/local-tryon.api.json",
      "./data/catalog.json",
      "./data/costumes.json",
      "./public/muse/dafeiyu-sheet.png",
      "./public/muse/claude-sheet.png",
      "./public/muse/gemini-sheet.png",
      "./public/muse/glm-sheet.png",
      "./public/muse/gpt-sheet.png",
      "./public/muse/grok-sheet.png",
      "./public/muse/kimi-sheet.png",
      "./public/muse/llama-sheet.png",
      "./public/muse/minimax-sheet.png",
      "./public/muse/qwen-sheet.png",
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-linuxmusl-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linuxmusl-x64/**/*",
    ],
  },
}

export default nextConfig

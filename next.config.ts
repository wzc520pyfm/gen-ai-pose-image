import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/catalog": ["./data/catalog.json"],
    "/api/costumes": ["./data/costumes.json"],
    "/api/costume-image": ["./data/costumes.json"],
    "/api/faces": ["./data/faces.json"],
    "/api/face-image": ["./data/faces.json"],
    "/api/pose-image": ["./data/catalog.json"],
    "/api/prompt": ["./data/catalog.json", "./data/costumes.json", "./data/faces.json"],
    "/api/character-sheet": ["./public/muse/dafeiyu-sheet.png"],
    "/api/generate": [
      "./data/catalog.json",
      "./data/costumes.json",
      "./data/faces.json",
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
      "./node_modules/@img/sharp*-linux*/**/*",
    ],
  },
}

export default nextConfig

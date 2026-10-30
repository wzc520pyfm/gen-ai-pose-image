import { NextResponse } from "next/server"
import { applyEnvCredentials } from "@/shared/credentials.mjs"
import { assertBaseURL, defaultModel, generateImage } from "@/shared/generate.mjs"

export const maxDuration = 300

const ASPECTS = new Set(["1:1", "3:4", "4:3", "9:16", "16:9"])

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "请求不是 JSON" }, { status: 400 })
  }
  const filled = applyEnvCredentials(body)
  const provider = filled.provider === "openai" || filled.provider === "seedream" || filled.provider === "gemini" ? filled.provider : null
  if (!provider) return NextResponse.json({ error: "不支持的生图接口" }, { status: 400 })
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
  if (!prompt) return NextResponse.json({ error: "先写好提示词" }, { status: 400 })
  const apiKey = typeof filled.apiKey === "string" ? filled.apiKey.trim() : ""
  if (!apiKey) return NextResponse.json({ error: "还没有填写 API Key" }, { status: 400 })
  const aspectRatio = typeof body.aspectRatio === "string" && ASPECTS.has(body.aspectRatio) ? body.aspectRatio : "3:4"
  try {
    const image = await generateImage({
      provider,
      apiKey,
      baseURL: assertBaseURL(typeof filled.baseURL === "string" ? filled.baseURL : ""),
      model: (typeof filled.model === "string" && filled.model.trim()) || defaultModel(provider),
      prompt: prompt.slice(0, 4000),
      images: [],
      aspectRatio,
      signal: request.signal,
    })
    return NextResponse.json({
      mediaType: image.mediaType,
      imageBase64: image.buffer.toString("base64"),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "参考图没有生成"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

import { NextResponse } from "next/server"
import { generateCharacterSheet } from "@/shared/character-sheet.mjs"
import { applyEnvCredentials } from "@/shared/credentials.mjs"
import { assertBaseURL, defaultModel } from "@/shared/generate.mjs"

export const maxDuration = 300

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "请求不是 JSON" }, { status: 400 })
  }
  const image = body.image
  if (!image || typeof image !== "object" || !("dataBase64" in image) || typeof image.dataBase64 !== "string" || image.dataBase64.trim() === "") {
    return NextResponse.json({ error: "先导入一张模特照片" }, { status: 400 })
  }
  const filled = applyEnvCredentials(body)
  const provider = filled.provider === "openai" || filled.provider === "seedream" || filled.provider === "gemini" ? filled.provider : null
  if (!provider) return NextResponse.json({ error: "不支持的生图接口" }, { status: 400 })
  const apiKey = typeof filled.apiKey === "string" ? filled.apiKey.trim() : ""
  if (!apiKey) return NextResponse.json({ error: "还没有填写 API Key" }, { status: 400 })
  try {
    const result = await generateCharacterSheet({
      provider,
      apiKey,
      baseURL: assertBaseURL(typeof filled.baseURL === "string" ? filled.baseURL : ""),
      model: (typeof filled.model === "string" && filled.model.trim()) || defaultModel(provider),
      image: {
        mediaType: "mediaType" in image && typeof image.mediaType === "string" ? image.mediaType : "image/jpeg",
        dataBase64: image.dataBase64,
      },
      signal: request.signal,
    })
    return NextResponse.json({
      mediaType: result.mediaType,
      imageBase64: result.buffer.toString("base64"),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "多视角 sheet 没有生成"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

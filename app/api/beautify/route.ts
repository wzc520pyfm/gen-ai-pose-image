import { NextResponse } from "next/server"
import { beautifyPrompt } from "@/shared/beautify.mjs"
import { applyEnvCredentials } from "@/shared/credentials.mjs"

export const maxDuration = 60

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "请求不是 JSON" }, { status: 400 })
  }
  const kind = body.kind === "costume" ? "costume" : body.kind === "pose" ? "pose" : ""
  if (!kind) return NextResponse.json({ error: "需要说明是姿势还是服装" }, { status: 400 })
  const filled = applyEnvCredentials(body)
  const provider = filled.provider === "openai" || filled.provider === "seedream" || filled.provider === "gemini" ? filled.provider : "gemini"
  const result = await beautifyPrompt({
    provider,
    apiKey: typeof filled.apiKey === "string" ? filled.apiKey : "",
    baseURL: typeof filled.baseURL === "string" ? filled.baseURL : "",
    textModel: typeof body.textModel === "string" ? body.textModel : "",
    kind,
    userPrompt: typeof body.userPrompt === "string" ? body.userPrompt : "",
    adult: body.adult === true,
    signal: request.signal,
  })
  return NextResponse.json(result)
}

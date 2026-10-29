import { NextResponse } from "next/server"
import { runGeneration } from "@/shared/jobs.mjs"

export const maxDuration = 300

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "请求不是 JSON" }, { status: 400 })
  }
  if (typeof body.apiKey !== "string" || body.apiKey.trim() === "") {
    body = { ...body, apiKey: process.env.POSE_MUSE_API_KEY ?? "" }
  }
  if ((typeof body.provider !== "string" || body.provider.trim() === "") && process.env.POSE_MUSE_PROVIDER) {
    body = { ...body, provider: process.env.POSE_MUSE_PROVIDER }
  }
  if (body.provider === "seedream") {
    if (typeof body.model !== "string" || body.model.trim() === "" || body.model === "gemini-2.5-flash-image") {
      body = { ...body, model: process.env.POSE_MUSE_MODEL?.trim() || "doubao-seedream-5-0-flash-260915" }
    }
    if (typeof body.baseURL !== "string" || body.baseURL.trim() === "") {
      body = { ...body, baseURL: process.env.POSE_MUSE_BASE_URL?.trim() || "https://ark.cn-beijing.volces.com/api/v3" }
    }
  }
  try {
    const { results } = await runGeneration(body, { signal: request.signal })
    return NextResponse.json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : "生图失败"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

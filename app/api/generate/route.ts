import { NextResponse } from "next/server"
import { applyEnvCredentials } from "@/shared/credentials.mjs"
import { statusForStudioError } from "@/shared/http-status.mjs"
import { runGeneration } from "@/shared/jobs.mjs"

export const maxDuration = 300

export async function POST(request: Request) {
  const mediaType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()
  if (mediaType !== "application/json") {
    return NextResponse.json({ error: "请使用 JSON 提交生图请求。" }, { status: 415 })
  }
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "请求不是 JSON" }, { status: 400 })
  }
  if (body.engine === "comfyui") {
    return NextResponse.json({ error: "不再支持服务端执行 ComfyUI，请使用新版网页直接连接。" }, { status: 400 })
  }
  try {
    const { results } = await runGeneration(applyEnvCredentials(body), { signal: request.signal })
    return NextResponse.json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : "生图失败"
    return NextResponse.json({ error: message }, { status: statusForStudioError(error) })
  }
}

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
  try {
    const { results } = await runGeneration(body, { signal: request.signal })
    return NextResponse.json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : "生图失败"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

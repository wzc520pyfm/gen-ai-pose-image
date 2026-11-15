import { NextResponse } from "next/server"
import { statusForStudioError } from "@/shared/http-status.mjs"
import { runProviderAction } from "@/shared/provider-settings.mjs"

export const maxDuration = 300

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "请使用 JSON 提交设置。" }, { status: 415 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求不是 JSON" }, { status: 400 })
  }
  try {
    return NextResponse.json(await runProviderAction(body, { signal: request.signal }), {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "接口请求失败" }, { status: statusForStudioError(error) })
  }
}

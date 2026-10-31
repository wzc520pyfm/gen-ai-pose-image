import { NextResponse } from "next/server"
import { assertLocalRequest, checkComfy } from "@/shared/comfyui.mjs"

export async function GET(request: Request) {
  try {
    assertLocalRequest(`${new URL(request.url).protocol}//${request.headers.get("host")}`, request.headers.get("origin"))
    return NextResponse.json(await checkComfy({ signal: request.signal }))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "连接失败" }, { status: 503 })
  }
}

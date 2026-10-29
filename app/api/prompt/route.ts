import { NextResponse } from "next/server"
import { planRequest, promptCards } from "@/shared/jobs.mjs"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求不是 JSON" }, { status: 400 })
  }
  try {
    const plan = planRequest(body)
    return NextResponse.json({ prompts: promptCards(plan) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "提示词无法生成"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

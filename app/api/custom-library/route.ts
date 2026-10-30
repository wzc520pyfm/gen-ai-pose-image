import { NextResponse } from "next/server"
import { replaceCustomLibrary, upsertCustomCostume, upsertCustomPose } from "@/shared/registry.mjs"

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { poses?: unknown[]; costumes?: unknown[] }
    replaceCustomLibrary({ poses: body.poses ?? [], costumes: body.costumes ?? [] })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "自定义参考没有保存"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { kind?: string; item?: unknown }
    if (body.kind === "costume") upsertCustomCostume(body.item)
    else upsertCustomPose(body.item)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "自定义参考没有保存"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

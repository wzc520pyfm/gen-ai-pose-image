import { NextResponse } from "next/server"
import { resolveView } from "@/shared/catalog.mjs"
import { fetchPoseBytes, poseFileFor } from "@/shared/poses.mjs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const found = resolveView(url.searchParams.get("id") ?? "")
  if (!found) return NextResponse.json({ error: "找不到姿势" }, { status: 404 })
  const size = url.searchParams.get("size") === "full" ? "full" : "thumb"
  try {
    const image = await fetchPoseBytes(poseFileFor(found.view, size))
    return new NextResponse(new Uint8Array(image.buffer), {
      headers: {
        "content-type": image.mediaType,
        "cache-control": "public, max-age=86400",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "姿势图读取失败"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

import { NextResponse } from "next/server"
import { costumeFile, fetchCostumeBytes, getCostume } from "@/shared/costumes.mjs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const costume = getCostume(url.searchParams.get("id") ?? "")
  if (!costume) return NextResponse.json({ error: "找不到服装" }, { status: 404 })
  const size = url.searchParams.get("size") === "full"
    ? "full"
    : url.searchParams.get("size") === "preview"
      ? "preview"
      : "thumb"
  try {
    const image = await fetchCostumeBytes(costumeFile(costume, size))
    return new NextResponse(new Uint8Array(image.buffer), {
      headers: {
        "content-type": image.mediaType,
        "cache-control": "public, max-age=86400",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "服装图读取失败"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

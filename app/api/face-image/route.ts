import { NextResponse } from "next/server"
import { faceFile, fetchFaceBytes, getFace } from "@/shared/faces.mjs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const face = getFace(url.searchParams.get("id") ?? "")
  if (!face) return NextResponse.json({ error: "找不到脸部参考" }, { status: 404 })
  const size = url.searchParams.get("size") === "full" ? "full" : "thumb"
  try {
    const image = await fetchFaceBytes(faceFile(face, size))
    return new NextResponse(new Uint8Array(image.buffer), {
      headers: {
        "content-type": image.mediaType,
        "cache-control": "public, max-age=86400",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "脸部图读取失败"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

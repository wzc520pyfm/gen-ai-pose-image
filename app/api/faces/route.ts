import { NextResponse } from "next/server"
import { getFaceCatalog } from "@/shared/faces.mjs"

export function GET() {
  return NextResponse.json(getFaceCatalog(), {
    headers: { "cache-control": "public, max-age=3600" },
  })
}

import { NextResponse } from "next/server"
import { getAnimeFaceCatalog } from "@/shared/faces.mjs"

export function GET() {
  return NextResponse.json(getAnimeFaceCatalog(), {
    headers: { "cache-control": "public, max-age=3600" },
  })
}

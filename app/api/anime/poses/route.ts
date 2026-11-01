import { NextResponse } from "next/server"
import { getAnimePoseCatalog } from "@/shared/catalog.mjs"

export function GET() {
  return NextResponse.json(getAnimePoseCatalog(), {
    headers: { "cache-control": "public, max-age=3600" },
  })
}

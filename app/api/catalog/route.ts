import { NextResponse } from "next/server"
import { getCatalog } from "@/shared/catalog.mjs"

export function GET() {
  return NextResponse.json(getCatalog(), {
    headers: { "cache-control": "public, max-age=3600" },
  })
}

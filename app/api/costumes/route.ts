import { NextResponse } from "next/server"
import { getCostumeCatalog } from "@/shared/costumes.mjs"

export function GET() {
  return NextResponse.json(getCostumeCatalog(), {
    headers: { "cache-control": "public, max-age=3600" },
  })
}

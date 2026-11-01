import { NextResponse } from "next/server"
import { getAnimeCostumeCatalog } from "@/shared/costumes.mjs"

export function GET() {
  return NextResponse.json(getAnimeCostumeCatalog(), {
    headers: { "cache-control": "public, max-age=3600" },
  })
}

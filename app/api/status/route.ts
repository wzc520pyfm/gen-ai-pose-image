import { NextResponse } from "next/server"
import { serverProviderStatus } from "@/shared/credentials.mjs"

export function GET() {
  return NextResponse.json(serverProviderStatus())
}

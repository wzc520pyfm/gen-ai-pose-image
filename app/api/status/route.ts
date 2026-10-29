import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({
    keyConfigured: Boolean(process.env.POSE_MUSE_API_KEY?.trim()),
  })
}

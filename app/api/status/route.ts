import { NextResponse } from "next/server"

export function GET() {
  const provider = process.env.POSE_MUSE_PROVIDER === "seedream" || process.env.POSE_MUSE_PROVIDER === "openai" || process.env.POSE_MUSE_PROVIDER === "gemini"
    ? process.env.POSE_MUSE_PROVIDER
    : ""
  return NextResponse.json({
    keyConfigured: Boolean(process.env.POSE_MUSE_API_KEY?.trim()),
    provider,
    model: process.env.POSE_MUSE_MODEL?.trim() || "",
    baseURL: process.env.POSE_MUSE_BASE_URL?.trim() || "",
  })
}

export function applyEnvCredentials(body) {
  const next = { ...body }
  if (typeof next.apiKey !== "string" || next.apiKey.trim() === "") {
    next.apiKey = process.env.POSE_MUSE_API_KEY ?? ""
  }
  if ((typeof next.provider !== "string" || next.provider.trim() === "") && process.env.POSE_MUSE_PROVIDER) {
    next.provider = process.env.POSE_MUSE_PROVIDER
  }
  if (next.provider === "seedream") {
    if (typeof next.model !== "string" || next.model.trim() === "" || next.model === "gemini-2.5-flash-image") {
      next.model = process.env.POSE_MUSE_MODEL?.trim() || "doubao-seedream-5-0-flash-260915"
    }
    if (typeof next.baseURL !== "string" || next.baseURL.trim() === "") {
      next.baseURL = process.env.POSE_MUSE_BASE_URL?.trim() || "https://ark.cn-beijing.volces.com/api/v3"
    }
  }
  return next
}

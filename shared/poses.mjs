const poseCache = new Map()

export function poseFileFor(view, size) {
  return size === "thumb" ? view.thumb : view.full
}

export function isSafePosePath(relativePath) {
  return /^(thumbs|img)\/[A-Za-z0-9_]+\.(jpg|png)$/.test(relativePath)
}

export async function fetchPoseBytes(relativePath, fetchImpl = fetch) {
  if (!isSafePosePath(relativePath)) throw new Error("姿势图路径无效")
  const cached = poseCache.get(relativePath)
  if (cached) return cached
  const response = await fetchImpl(`https://ai-pose-gallery.anhao.app/${relativePath}`, {
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`姿势图暂时读不到（${response.status}）`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength < 32 || buffer.byteLength > 8_000_000) throw new Error("姿势图大小异常")
  const mediaType = relativePath.endsWith(".png") ? "image/png" : "image/jpeg"
  const value = { mediaType, buffer, role: "pose" }
  if (poseCache.size > 80) poseCache.delete(poseCache.keys().next().value)
  poseCache.set(relativePath, value)
  return value
}

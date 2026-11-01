const HOSTS = new Set(["charadb-2fi.pages.dev"])

export function isAbsoluteImageUrl(value) {
  return typeof value === "string" && /^[a-z][a-z0-9+.-]*:/i.test(value)
}

export function isAllowedRemoteImage(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== "https:") return false
  if (url.username || url.password || url.port) return false
  if (url.search || url.hash) return false
  if (!HOSTS.has(url.hostname)) return false
  const path = decodeURI(url.pathname)
  if (path.includes("..") || path.includes("//")) return false
  return /^\/thumb\/[HOP]\d{3}(?:-[a-z0-9]+)?\.webp$/.test(path)
    || /^\/img\/[HOP]\d{3}(?:-[a-z0-9]+)?\.jpg$/.test(path)
    || /^\/line\/P\d{3}(?:-[a-z0-9]+)?\.png$/.test(path)
}

function mediaTypeFor(remoteUrl, header) {
  const declared = String(header || "").split(";")[0].trim().toLowerCase()
  if (declared === "image/jpeg" || declared === "image/png" || declared === "image/webp") return declared
  const path = remoteUrl.toLowerCase()
  if (path.endsWith(".png")) return "image/png"
  if (path.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}

export async function fetchRemoteImage(remoteUrl, { role, fetchImpl = fetch, maxBytes = 8_000_000 } = {}) {
  if (!isAllowedRemoteImage(remoteUrl)) throw new Error("图片地址无效")
  const response = await fetchImpl(remoteUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: {
      "user-agent": "Lanzi/0.2 (image catalog)",
      referer: `${new URL(remoteUrl).origin}/`,
    },
  })
  if (!response.ok) throw new Error(`图片暂时读不到（${response.status}）`)
  const finalUrl = typeof response.url === "string" && response.url ? response.url : remoteUrl
  const settled = new URL(finalUrl)
  settled.search = ""
  settled.hash = ""
  if (!isAllowedRemoteImage(settled.href)) throw new Error("图片地址无效")
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength < 32 || buffer.byteLength > maxBytes) throw new Error("图片大小异常")
  return { mediaType: mediaTypeFor(settled.href, response.headers?.get?.("content-type")), buffer, role }
}

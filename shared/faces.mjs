import baseCatalog from "../data/faces.json" with { type: "json" }
import { ANIME_FACE_NOTE, animeFaces } from "./anime-library.mjs"
import { fetchRemoteImage, isAbsoluteImageUrl, isAllowedRemoteImage } from "./remote-image.mjs"

function counted(rows, extras, key) {
  const groups = rows.map((item) => ({ ...item }))
  const byKey = new Map(groups.map((item) => [item.id, item]))
  for (const extra of extras) {
    const found = byKey.get(extra[key])
    if (found) found.count += 1
  }
  return groups
}

const animeSections = [
  { id: "anime-closeup", label: "二次元特写", count: animeFaces.filter((item) => item.section === "anime-closeup").length },
  { id: "anime-expression", label: "表情", count: animeFaces.filter((item) => item.section === "anime-expression").length },
]

const catalog = {
  ...baseCatalog,
  attribution: `${baseCatalog.attribution}${ANIME_FACE_NOTE}`,
  total: baseCatalog.total + animeFaces.length,
  sections: [...baseCatalog.sections, ...animeSections],
  hairs: counted(baseCatalog.hairs, animeFaces, "hair"),
  faces: [...baseCatalog.faces, ...animeFaces],
}

const byId = new Map(catalog.faces.map((face) => [face.id, face]))
const cache = new Map()
const ORIGIN = "https://ai-portrait-gallery.pages.dev"

export function getFaceCatalog() {
  return catalog
}

export function getFace(id) {
  return byId.get(id)
}

export function searchFaces({ query = "", section = "", hair = "", limit = 60 } = {}) {
  const parts = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean)
  const cap = Math.max(1, Math.min(120, Number(limit) || 60))
  const matches = []
  for (const face of catalog.faces) {
    if (section && face.section !== section) continue
    if (hair && face.hair !== hair) continue
    if (parts.length > 0) {
      const hay = `${face.id} ${face.section} ${face.hair} ${face.label} ${face.keywords} ${face.credit ?? ""} ${face.hot ? "热门 hot" : ""}`.toLowerCase()
      if (!parts.every((part) => hay.includes(part))) continue
    }
    matches.push(face)
    if (matches.length >= cap) break
  }
  return matches
}

export function faceFile(face, size) {
  return size === "full" ? face.full : face.thumb
}

export function isSafeFacePath(relativePath) {
  return /^img\/thumb\/f[0-9a-f]{10}\.webp$/.test(relativePath)
    || /^img\/full\/f[0-9a-f]{10}\.png$/.test(relativePath)
}

export async function fetchFaceBytes(relativePath, fetchImpl = fetch) {
  if (isAbsoluteImageUrl(relativePath)) {
    if (!isAllowedRemoteImage(relativePath)) throw new Error("图片地址无效")
    const cached = cache.get(relativePath)
    if (cached) return cached
    const value = await fetchRemoteImage(relativePath, { role: "face", fetchImpl, maxBytes: 12_000_000 })
    if (cache.size > 80) cache.delete(cache.keys().next().value)
    cache.set(relativePath, value)
    return value
  }
  if (!isSafeFacePath(relativePath)) throw new Error("脸部图路径无效")
  const cached = cache.get(relativePath)
  if (cached) return cached
  const response = await fetchImpl(`${ORIGIN}/${relativePath}`, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`脸部图暂时读不到（${response.status}）`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength < 32 || buffer.byteLength > 12_000_000) throw new Error("脸部图大小异常")
  const mediaType = relativePath.endsWith(".png") ? "image/png" : "image/webp"
  const value = { mediaType, buffer, role: "face" }
  if (cache.size > 80) cache.delete(cache.keys().next().value)
  cache.set(relativePath, value)
  return value
}

export function toFaceSearchResult(faces) {
  const list = Array.isArray(faces) ? faces : []
  return {
    count: list.length,
    faces: list.map((face) => ({
      id: face.id,
      section: face.section,
      hair: face.hair,
      label: face.label,
      keywords: face.keywords,
      hot: face.hot === true,
      source: "catalog",
      ...(face.credit ? { credit: face.credit, sourceUrl: face.sourceUrl || "", license: face.license || "" } : {}),
      ...(face.author ? { author: face.author } : {}),
    })),
  }
}

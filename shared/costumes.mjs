import catalog from "../data/costumes.json" with { type: "json" }
import { ANIME_COSTUME_CATEGORIES, animeCostumeCatalog } from "./anime-library.mjs"
import { customCostumeRecord, isCustomCostumeId } from "./custom.mjs"
import { fetchRemoteImage, isAbsoluteImageUrl, isAllowedRemoteImage } from "./remote-image.mjs"

const byId = new Map([...catalog.costumes, ...animeCostumeCatalog.costumes].map((costume) => [costume.id, costume]))
const cache = new Map()
const ORIGIN = "https://ai-costume-gallery.pages.dev"

export function getCostumeCatalog() {
  return catalog
}

export function getAnimeCostumeCatalog() {
  return animeCostumeCatalog
}

export function getCostume(id) {
  return byId.get(id)
}

export function searchCostumes({ query = "", category = "", realm = "", includeAdult = false, limit = 60, custom = [] } = {}) {
  const parts = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean)
  const cap = Math.max(1, Math.min(120, Number(limit) || 60))
  const matches = []
  const animeOnly = realm === "anime" || ANIME_COSTUME_CATEGORIES.has(category)
  const wantCustom = !animeOnly && (!category || category === "自定义")
  if (wantCustom) {
    for (const asset of custom) {
      if (!asset || !isCustomCostumeId(asset.id) || !asset.dataBase64) continue
      if (!includeAdult && asset.adult === true) continue
      const costume = customCostumeRecord(asset)
      if (parts.length > 0) {
        const hay = `${costume.id} ${costume.keywords} ${costume.label} ${asset.userPrompt ?? ""}`.toLowerCase()
        if (!parts.every((part) => hay.includes(part))) continue
      }
      matches.push(costume)
      if (matches.length >= cap) return matches
    }
  }
  if (category === "自定义") return matches
  const pool = animeOnly ? animeCostumeCatalog.costumes : catalog.costumes
  for (const costume of pool) {
    if (!includeAdult && costume.adult) continue
    if (category && costume.category !== category) continue
    if (parts.length > 0) {
      const hay = `${costume.id} ${costume.keywords} ${costume.label} ${costume.credit ?? ""}`.toLowerCase()
      if (!parts.every((part) => hay.includes(part))) continue
    }
    matches.push(costume)
    if (matches.length >= cap) break
  }
  return matches
}

export function isSafeCostumePath(relativePath) {
  return /^(?:thumbs|img)\/(?:SPR|SUM|AUT|WIN|LNG|PTY|SWM|SXY)-\d{4}\.webp$/.test(relativePath)
    || /^png\/(?:SPR|SUM|AUT|WIN|LNG|PTY|SWM|SXY)-\d{4}\.png$/.test(relativePath)
}

export function costumeFile(costume, size) {
  if (size === "full") return costume.full
  if (size === "preview") return costume.preview
  return costume.thumb
}

export async function fetchCostumeBytes(relativePath, fetchImpl = fetch) {
  if (isAbsoluteImageUrl(relativePath)) {
    if (!isAllowedRemoteImage(relativePath)) throw new Error("图片地址无效")
    const cached = cache.get(relativePath)
    if (cached) return cached
    const value = await fetchRemoteImage(relativePath, { role: "costume", fetchImpl, maxBytes: 12_000_000 })
    if (cache.size > 80) cache.delete(cache.keys().next().value)
    cache.set(relativePath, value)
    return value
  }
  if (!isSafeCostumePath(relativePath)) throw new Error("服装图路径无效")
  const cached = cache.get(relativePath)
  if (cached) return cached
  const response = await fetchImpl(`${ORIGIN}/${relativePath}`, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`服装图暂时读不到（${response.status}）`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength < 32 || buffer.byteLength > 12_000_000) throw new Error("服装图大小异常")
  const mediaType = relativePath.endsWith(".png") ? "image/png" : "image/webp"
  const value = { mediaType, buffer, role: "costume" }
  if (cache.size > 80) cache.delete(cache.keys().next().value)
  cache.set(relativePath, value)
  return value
}

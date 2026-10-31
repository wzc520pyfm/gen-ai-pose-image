import { costumeVisiblePrompt } from "./costume-prompt.mjs"

export function createCustomId(kind, random = () => globalThis.crypto.randomUUID()) {
  const suffix = String(random())
  return kind === "costume" ? `custom-costume-${suffix}` : `custom-pose-${suffix}`
}

export function isCustomPoseId(id) {
  return typeof id === "string" && /^custom-pose-.+/.test(id)
}

export function isCustomCostumeId(id) {
  return typeof id === "string" && /^custom-costume-.+/.test(id)
}

export function fitEdge(width, height, maxEdge = 2048) {
  const w = Number(width)
  const h = Number(height)
  const max = Number(maxEdge) || 2048
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) throw new Error("图片尺寸无效")
  const scale = Math.min(1, max / Math.max(w, h))
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  }
}

export function isStorageHigh(usage, quota, threshold = 0.8) {
  const used = Number(usage) || 0
  const cap = Number(quota) || 0
  if (cap <= 0) return false
  return used / cap >= threshold
}

export function missingCustomPoseMessage(id) {
  return `找不到自定义姿势 ${id} 的参考图。请先在澜姿工作室上传或生成这张姿势，再重新打开工作室。不会改用姿势库里的其他姿势。`
}

export function missingCustomCostumeMessage(id) {
  return `找不到自定义服装 ${id} 的参考图。请先在澜姿工作室上传或生成这套服装，再重新打开工作室。不会改用衣装集里的其他服装。`
}

export function customPoseRecord(asset) {
  const label = String(asset?.label || asset?.name || "自定义姿势").slice(0, 80)
  return {
    id: asset.id,
    name: label,
    code: "自定义",
    system: "自定义",
    systemId: "custom",
    category: "自定义",
    adult: asset?.adult === true,
    people: 1,
    source: "custom",
    views: [{ id: asset.id, angle: "自定义" }],
  }
}

export function customCostumeRecord(asset) {
  const label = String(asset?.label || "自定义服装").slice(0, 80)
  return {
    id: asset.id,
    category: "自定义",
    label,
    keywords: String(asset?.keywords || label).slice(0, 300),
    adult: asset?.adult === true,
    source: "custom",
  }
}

export const POSE_STYLE_LOCK = "严格模仿参考图的线稿风格与人偶质感，只按描述改姿态。"

export function expandReferencePrompt({ kind = "pose", userPrompt = "", adult = false, sensitivePromptOptimize = false } = {}) {
  const note = String(userPrompt ?? "").trim().slice(0, 2000)
  const safe = adult ? "" : "保持日常、得体、可公开展示的画面。"
  const optimize = sensitivePromptOptimize === true
  if (kind === "costume") {
    return costumeVisiblePrompt({ userPrompt: note, adult: adult === true, sensitivePromptOptimize: optimize })
  }
  return [
    "白底单人姿势线稿参考图，黑色干净线条，球关节人偶，全身，只表现身体姿态、重心、四肢和镜头角度。",
    POSE_STYLE_LOCK,
    "不要上色，不要服装设计，不要五官细节，不要背景场景。",
    safe,
    note ? `姿势描述：${note}` : "一个清楚的站立或动态姿势，关节可读。",
    "不要文字，不要水印。",
  ].filter(Boolean).join("\n")
}

export function reuseFromHistory(entry) {
  const selected = {}
  const selection = Array.isArray(entry?.selection) ? entry.selection : []
  for (const item of selection) {
    if (!item?.poseId || !item?.viewId) continue
    selected[item.poseId] = item.viewId
  }
  const costume = entry?.costume?.id
    ? {
        id: String(entry.costume.id),
        label: String(entry.costume.label || ""),
        keywords: String(entry.costume.keywords || ""),
      }
    : null
  return {
    selected,
    extraPrompt: typeof entry?.extraPrompt === "string" ? entry.extraPrompt : "",
    costume,
  }
}

export function toPoseSearchResult(poses) {
  const list = Array.isArray(poses) ? poses : []
  return {
    count: list.length,
    poses: list.map((pose) => ({
      id: pose.id,
      name: pose.name,
      code: pose.code,
      system: pose.system,
      category: pose.category,
      adult: pose.adult,
      people: pose.people,
      source: pose.source === "custom" ? "custom" : "catalog",
      views: (pose.views || []).map((view) => ({ id: view.id, angle: view.angle })),
    })),
  }
}

export function toCostumeSearchResult(costumes) {
  const list = Array.isArray(costumes) ? costumes : []
  return {
    count: list.length,
    costumes: list.map((costume) => ({
      id: costume.id,
      category: costume.category,
      label: costume.label,
      keywords: costume.keywords,
      adult: costume.adult,
      source: costume.source === "custom" ? "custom" : "catalog",
    })),
  }
}

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
export const COSTUME_STYLE_LOCK = "严格模仿参考图的构图、取景、机位距离、光线和地面柔和棚拍阴影。衣服必须是隐形人穿着的立体成套造型：鞋穿在脚下，包和配饰按穿着方式佩戴或拿着，不要飘着的散件，不要平铺。只按描述更换衣服，不要改参考图的呈现方式。不要头、脸、手、皮肤、人台、假人，不要裸体。"

export function expandReferencePrompt({ kind = "pose", userPrompt = "", adult = false } = {}) {
  const note = String(userPrompt ?? "").trim().slice(0, 2000)
  const safe = adult ? "" : "画面保持非露骨：不要裸体，不要内衣，不要性暗示。"
  if (kind === "costume") {
    return [
      "服装参考图是隐形人穿着的成套造型。照着参考图的构图、取景、机位距离、光线和地面柔和棚拍阴影，只更换用户描述的衣服。",
      "鞋穿在脚下，包和配饰按穿着方式佩戴或拿着。不要飘着的散件，不要平铺，不要把单件拆开放在地上。",
      "不要把头、脸、手、皮肤、人台或假人画出来，不要裸体。看不见的穿着者只用来撑起衣服。",
      COSTUME_STYLE_LOCK,
      safe,
      note ? `服装描述：${note}` : "一套完整的日常外衣，像已经穿好。",
      "不要文字，不要水印，不要人脸。",
    ].filter(Boolean).join("\n")
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

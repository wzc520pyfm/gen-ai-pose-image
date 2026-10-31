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

const COSTUME_STYLE_SHARED = "严格模仿参考图的构图、取景、机位距离、光线和地面柔和棚拍阴影。只画用户写到的衣物，不要照抄参考图里多出来的单件。未描述时严禁丝袜、连裤袜、黑丝、打底裤。没有提到的包、鞋、外套都不要添加。描述到的衣服要有穿上身后的立体体积，不要飘着的散件，不要平铺。描述里有鞋才把鞋穿在脚下，有包或配饰才佩戴或拿着。若有帽子，帽子与领口之间必须留出明显的空白，帽子悬在领口上方，不能贴在衣领上。"

/** Blunt lock is the default. Optimize=true swaps in the scrubbed lock. */
export function costumeStyleLock(sensitivePromptOptimize = false) {
  if (sensitivePromptOptimize === true) {
    return `${COSTUME_STYLE_SHARED}画面里只有衣服，头部、脸部、手部和腿部不出现。裙子和袜子之间用衣物挡住，不要露出肢体。`
  }
  return `${COSTUME_STYLE_SHARED}不要人，不要头，不要脸，不要手，不要腿，不要身体，不要皮肤。裙子和袜子之间不能露出腿或皮肤，必须用衣物挡住。`
}

export const COSTUME_STYLE_LOCK = costumeStyleLock(false)

export function expandReferencePrompt({ kind = "pose", userPrompt = "", adult = false, sensitivePromptOptimize = false } = {}) {
  const note = String(userPrompt ?? "").trim().slice(0, 2000)
  const safe = adult ? "" : "保持日常、得体、可公开展示的画面。"
  const optimize = sensitivePromptOptimize === true
  if (kind === "costume") {
    return [
      "服装参考图是隐形人穿着的造型。照着参考图的构图、取景、机位距离、光线和地面柔和棚拍阴影，只画用户写到的衣物。",
      costumeStyleLock(optimize),
      safe,
      note ? `服装描述：${note}` : "只画一件日常上衣，像已经穿好。不要自行添加袜子、鞋或包。",
      "不要文字，不要水印。",
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

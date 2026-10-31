import { defaultModel } from "./generate.mjs"

export const WEAR_MARKER = "这一步先画成年模特穿着衣服。"

const GARMENT_SOURCE = [
  "berets?",
  "trench(?:\\s*coats?)?",
  "jackets?",
  "blouses?",
  "dresses?",
  "trousers?",
  "sneakers?",
  "shorts?",
  "gloves?",
  "scarves?",
  "scarfs?",
  "shirts?",
  "skirts?",
  "coats?",
  "pants?",
  "boots?",
  "shoes?",
  "socks?",
  "belts?",
  "bags?",
  "hats?",
  "贝雷帽",
  "鸭舌帽",
  "渔夫帽",
  "小腿袜",
  "过膝袜",
  "及膝袜",
  "船袜",
  "连裤袜",
  "中筒袜",
  "长筒袜",
  "短袜",
  "帽子",
  "头盔",
  "风衣",
  "大衣",
  "外套",
  "衬衫",
  "衬衣",
  "上衣",
  "T恤",
  "卫衣",
  "毛衣",
  "针织",
  "马甲",
  "背心",
  "连衣裙",
  "半身裙",
  "百褶裙",
  "短裙",
  "长裙",
  "裙子",
  "牛仔裤",
  "短裤",
  "长裤",
  "裤子",
  "袜子",
  "丝袜",
  "运动鞋",
  "球鞋",
  "凉鞋",
  "靴子",
  "皮鞋",
  "鞋子",
  "手套",
  "围巾",
  "腰带",
  "皮带",
  "手提包",
  "背包",
  "项链",
  "耳环",
  "眼镜",
  "领结",
  "领带",
  "配饰",
  "贝雷",
  "帽",
  "裙",
  "裤",
  "袜",
  "鞋",
  "包",
  "衣",
].join("|")

const PERSON_SOURCE = [
  "heads?",
  "faces?",
  "hairs?",
  "necks?",
  "hands?",
  "arms?",
  "legs?",
  "skins?",
  "bodies",
  "body",
  "persons?",
  "people",
  "models?",
  "头部",
  "脑袋",
  "脸部",
  "面部",
  "五官",
  "头发",
  "发型",
  "刘海",
  "脖子",
  "颈部",
  "手部",
  "双手",
  "手指",
  "手掌",
  "手臂",
  "胳膊",
  "腿部",
  "双腿",
  "大腿",
  "小腿",
  "皮肤",
  "身体",
  "躯干",
  "模特",
  "人物",
  "人体",
  "真人",
  "人像",
].join("|")

function hasGarment(text) {
  return new RegExp(GARMENT_SOURCE, "i").test(text)
}

function withoutGarments(text) {
  return String(text || "").replace(new RegExp(GARMENT_SOURCE, "gi"), " ")
}

function hasPerson(text) {
  return new RegExp(PERSON_SOURCE, "i").test(text)
}

function isBarePersonName(name) {
  return /^(头|脸|手|腿|发|脚|人|颈|脖|头部|脸部|头发|脖子|手部|腿部|皮肤|身体|head|face|hair|neck|hand|hands|arm|arms|leg|legs|skin|body|person|model)$/i.test(String(name || "").trim())
}

export function stripGhostClauses(userPrompt) {
  const ghostClause = /不要人|不要头|不要脸|不要手|不要腿|不要身体|不要皮肤|不要露出(?:腿|皮肤)|裙子和袜子之间[^，。；\n]{0,24}|帽子悬在领口上方[^，。；\n]{0,24}|帽子与领口之间[^，。；\n]{0,24}|不能贴在衣领上|隐形人|画面里只有衣服|头部、脸部、手部和腿部不出现|头部、脸部和手部不出现/g
  return String(userPrompt || "")
    .replace(ghostClause, " ")
    .replace(/[，,]{2,}/g, "，")
    .replace(/\s+/g, " ")
    .replace(/^[\s，,。；;、.]+/, "")
    .replace(/[\s，,。；;、.]+$/, "")
    .trim()
    .slice(0, 1200)
}

export function supportsCostumeLayerSplit(provider, model) {
  if (provider !== "seedream") return false
  const id = String(model || "").trim() || defaultModel("seedream")
  if (/lite/i.test(id)) return false
  return /seedream-5-0-(?:pro|flash)(?:-|$)/i.test(id)
}

export function costumeBeautifyRole(sensitivePromptOptimize = false) {
  const direct = sensitivePromptOptimize === true
    ? "用含蓄、可公开展示的说法描写已经穿好衣服的成年模特。"
    : "直接写模特穿着这些衣服，头、脸和手正常可见。"
  return [
    "你在写服装参考图的文生图提示词。画面是一位成年模特穿着用户描述的衣服。",
    "浅灰无缝棚拍，正面全身，脚入镜，地面有柔和阴影。衣服穿在身上，不要摊开平铺。只写用户提到的衣物，不要加丝袜、连裤袜、打底裤，也不要加没写到的鞋、包或外套。帽子戴在头上，帽檐和衣领之间留出头发或额头。",
    direct,
    "只写画面，不要写生成步骤。",
  ].join("\n")
}

/** Shown in the prompt box. The server still wraps this into the wear instruction at generation time. */
export function costumeVisiblePrompt({ userPrompt = "", adult = false, sensitivePromptOptimize = false } = {}) {
  const note = stripGhostClauses(userPrompt)
  const optimize = sensitivePromptOptimize === true
  const lines = [
    "浅灰无缝棚拍，正面全身，脚要入镜，地面有柔和阴影。成年模特穿着描述里的衣服，衣服要有立体体积，不要摊开平铺。",
    "帽子戴在头上，帽檐和衣领之间留出头发或额头。",
    "只穿描述里写到的衣物。没写到的鞋、包、外套、袜子都不要加，也不要自行加丝袜、连裤袜或打底裤。",
    optimize ? "用日常、含蓄的说法。" : "头、脸、头发和手正常可见。",
    adult ? "" : "保持日常、得体、可公开展示的画面。",
    note ? `服装描述：${note}` : "一件日常上衣和及膝裙。不要自行添加袜子、鞋或包。",
    "不要文字，不要水印。",
  ]
  return lines.filter(Boolean).join("\n").slice(0, 4000)
}

export function costumeWearPrompt({ userPrompt = "", adult = false, sensitivePromptOptimize = false } = {}) {
  const note = stripGhostClauses(userPrompt)
  const optimize = sensitivePromptOptimize === true
  const lines = [
    `${WEAR_MARKER}下一步才会把人抠掉，所以这一步必须有头、有身体。`,
    "如果描述里要求去掉人物，或把帽子悬空、贴在领口上，都不要照做。帽子戴在头上，帽檐和衣领之间要能看到头发或额头。",
    "浅灰无缝棚拍，正面全身，脚要入镜，地面有柔和阴影。衣服穿在身上，要有立体体积，不要摊开平铺。",
    "只穿描述里写到的衣物。没写到的鞋、包、外套、袜子都不要加，也不要自行加丝袜、连裤袜或打底裤。",
    optimize
      ? "用日常、含蓄的说法画一位已经穿好衣服的成年模特。"
      : "头、脸、头发和手要画出来。描述里没有被衣服挡住的腿也画出来，不要用额外的裤子或袜子挡住。",
    adult ? "" : "保持日常、得体、可公开展示的画面。",
    note ? `服装描述：${note}` : "只穿一件日常上衣和及膝裙。不要自行添加袜子、鞋或包。",
    "不要文字，不要水印。",
  ]
  return lines.filter(Boolean).join("\n").slice(0, 4000)
}

export function ensureWearPrompt(prompt, options = {}) {
  const text = String(prompt || "").trim()
  if (!text) throw new Error("先写好提示词")
  if (text.includes(WEAR_MARKER)) return text.slice(0, 4000)
  return costumeWearPrompt({ ...options, userPrompt: text })
}

export function costumeLayerPrompt(sensitivePromptOptimize = false) {
  if (sensitivePromptOptimize === true) {
    return "拆成独立图层：浅灰背景一层；帽子和每一件衣物各自一层；头部、头发、脸部、脖子、手部和腿部各自一层。衣物不要和人物放在同一层。"
  }
  return "拆成独立图层：浅灰背景一层；帽子和每一件衣物各自一层；头部、头发、脸、脖子、手、腿和皮肤各自一层。衣物不要和人物放在同一层。"
}

export function costumeRemovalPrompt(sensitivePromptOptimize = false) {
  if (sensitivePromptOptimize === true) {
    return [
      "编辑这张已经穿好衣服的全身图。",
      "去掉人物，只保留身上的衣物，衣物的位置、形状和颜色都不要改。",
      "头部、头发、脸部、脖子、手部和腿部都去掉，空出来的地方用原来的浅灰棚拍背景补上。",
      "帽子留在原来的高度，头所在的位置留空，不要把帽子移到领口上。",
      "不要新加丝袜、连裤袜、打底裤或其他没有出现的服饰。",
      "不要文字，不要水印。",
    ].join("")
  }
  return [
    "编辑这张图：把人抠掉，只留已经穿上的衣服，位置和形状保持不变。",
    "去掉头、头发、脸、脖子、手、腿和皮肤，这些位置用原来的浅灰棚拍背景填上。",
    "帽子不要往下移，头的位置留空。",
    "不要新加丝袜、连裤袜或打底裤。",
    "不要文字，不要水印。",
  ].join("")
}

export function classifyCostumeLayer({ name = "", description = "" } = {}) {
  const label = String(name || "").trim()
  const raw = `${label} ${description || ""}`.trim()
  if (!raw) return "unknown"
  if (/^(背景|地面|棚拍|阴影|background|floor|shadow)$/i.test(label)) return "skip"
  const garment = hasGarment(raw)
  const person = hasPerson(withoutGarments(raw)) || isBarePersonName(label)
  if (person && garment) return "mixed"
  if (person) return "drop"
  if (garment) return "keep"
  return "unknown"
}

export function selectGhostLayers(layers) {
  const tagged = (Array.isArray(layers) ? layers : []).map((layer) => ({
    ...layer,
    layerRole: classifyCostumeLayer(layer),
  }))
  const keep = tagged.filter((layer) => layer.layerRole === "keep")
  const erase = tagged.filter((layer) => layer.layerRole === "drop")
  if (keep.length === 0) return { ok: false, reason: "没有拆出单独的衣物图层", keep: [], erase: [] }
  if (erase.length === 0) return { ok: false, reason: "没有拆出单独的人物图层", keep: [], erase: [] }
  return { ok: true, reason: "", keep, erase }
}


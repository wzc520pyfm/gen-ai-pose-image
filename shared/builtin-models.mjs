/** Built-in models, in switcher order. Custom models are appended after these. */
export const BUILTIN_MODELS = Object.freeze([
  Object.freeze({
    id: "dafeiyu",
    name: "大肥鱼",
    portrait: "/muse/dafeiyu-portrait.jpg",
    sheet: "/muse/dafeiyu-sheet.png",
    blurb: "社区鲸鱼娘的成年形象。",
  }),
  Object.freeze({
    id: "claude",
    name: "Claude 娘",
    portrait: "/muse/claude-portrait.jpg",
    sheet: "/muse/claude-sheet.png",
    blurb: "长橙发，白橙礼裙，手里捧着一本书。",
  }),
  Object.freeze({
    id: "gemini",
    name: "Gemini 娘",
    portrait: "/muse/gemini-portrait.jpg",
    sheet: "/muse/gemini-sheet.png",
    blurb: "蓝紫长发，猫耳，星星配饰。",
  }),
  Object.freeze({
    id: "glm",
    name: "GLM 娘",
    portrait: "/muse/glm-portrait.jpg",
    sheet: "/muse/glm-sheet.png",
    blurb: "黑发狐耳，黑白长裙。",
  }),
  Object.freeze({
    id: "gpt",
    name: "GPT 娘",
    portrait: "/muse/gpt-portrait.jpg",
    sheet: "/muse/gpt-sheet.png",
    blurb: "白发龙角，白裙与龙尾。",
  }),
  Object.freeze({
    id: "grok",
    name: "Grok 娘",
    portrait: "/muse/grok-portrait.jpg",
    sheet: "/muse/grok-sheet.png",
    blurb: "金发双马尾，黑金礼裙。",
  }),
  Object.freeze({
    id: "kimi",
    name: "Kimi 娘",
    portrait: "/muse/kimi-portrait.jpg",
    sheet: "/muse/kimi-sheet.png",
    blurb: "银白长发，星空披风与音符。",
  }),
  Object.freeze({
    id: "llama",
    name: "llama 娘",
    portrait: "/muse/llama-portrait.jpg",
    sheet: "/muse/llama-sheet.png",
    blurb: "白发羊耳，宽松白裙。",
  }),
  Object.freeze({
    id: "minimax",
    name: "Minimax 娘",
    portrait: "/muse/minimax-portrait.jpg",
    sheet: "/muse/minimax-sheet.png",
    blurb: "橙发白帽，粉色外套。",
  }),
  Object.freeze({
    id: "qwen",
    name: "Qwen 娘",
    portrait: "/muse/qwen-portrait.jpg",
    sheet: "/muse/qwen-sheet.png",
    blurb: "蓝发侧辫，折扇与蓝白长裙。",
  }),
])

export function isBuiltinModelId(id) {
  return BUILTIN_MODELS.some((model) => model.id === id)
}

export function getBuiltinModel(id) {
  return BUILTIN_MODELS.find((model) => model.id === id) || null
}

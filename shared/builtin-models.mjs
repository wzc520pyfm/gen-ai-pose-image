/** Built-in models. Add another entry here; the switcher does not need new logic. */
export const BUILTIN_MODELS = Object.freeze([
  Object.freeze({
    id: "dafeiyu",
    name: "大肥鱼",
    portrait: "/muse/dafeiyu-portrait.jpg",
    sheet: "/muse/dafeiyu-sheet.png",
  }),
])

export function isBuiltinModelId(id) {
  return BUILTIN_MODELS.some((model) => model.id === id)
}

export function getBuiltinModel(id) {
  return BUILTIN_MODELS.find((model) => model.id === id) || null
}

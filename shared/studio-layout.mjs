export const DEFAULT_STUDIO_LAYOUT = "C"
export const STUDIO_LAYOUT_KEY = "lanzi.studio.layout"
const ALLOWED = new Set(["A", "B", "C", "D"])

export function normalizeStudioLayout(value) {
  return ALLOWED.has(value) ? value : DEFAULT_STUDIO_LAYOUT
}

export function loadStudioLayout(storage) {
  const store = storage ?? (typeof globalThis !== "undefined" ? globalThis.localStorage : null)
  if (!store || typeof store.getItem !== "function") return DEFAULT_STUDIO_LAYOUT
  try {
    return normalizeStudioLayout(store.getItem(STUDIO_LAYOUT_KEY))
  } catch {
    return DEFAULT_STUDIO_LAYOUT
  }
}

export function saveStudioLayout(id, storage) {
  const store = storage ?? (typeof globalThis !== "undefined" ? globalThis.localStorage : null)
  if (!store || typeof store.setItem !== "function") return
  try {
    store.setItem(STUDIO_LAYOUT_KEY, normalizeStudioLayout(id))
  } catch {
    // ignore quota / private mode
  }
}

export function projectLayoutChange(state, next) {
  return { ...state, layout: normalizeStudioLayout(next) }
}

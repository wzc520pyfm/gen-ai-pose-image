export const STUDIO_LAYOUT_KEY = "lanzi.studio.layout"

export function retireStudioLayout(storage) {
  const store = storage ?? (typeof globalThis !== "undefined" ? globalThis.localStorage : null)
  if (!store || typeof store.removeItem !== "function") return
  try {
    store.removeItem(STUDIO_LAYOUT_KEY)
  } catch {
    // ignore private mode
  }
}

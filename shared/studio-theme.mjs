export const STUDIO_THEME_KEY = "lanzi.studio.theme"

export function normalizeStudioTheme(value) {
  return value === "light" || value === "dark" || value === "system" ? value : "system"
}

export function loadStudioTheme(storage) {
  const store = storage ?? (typeof globalThis !== "undefined" ? globalThis.localStorage : null)
  if (!store || typeof store.getItem !== "function") return "system"
  try {
    return normalizeStudioTheme(store.getItem(STUDIO_THEME_KEY))
  } catch {
    return "system"
  }
}

export function saveStudioTheme(theme, storage) {
  const store = storage ?? (typeof globalThis !== "undefined" ? globalThis.localStorage : null)
  if (!store || typeof store.setItem !== "function") return
  try {
    store.setItem(STUDIO_THEME_KEY, normalizeStudioTheme(theme))
  } catch {
    // ignore quota / private mode
  }
}

export function resolveStudioTheme(preference, systemDark) {
  const theme = normalizeStudioTheme(preference)
  if (theme === "system") return systemDark ? "dark" : "light"
  return theme
}

export function applyStudioTheme(element, mode) {
  if (!element || typeof element.classList?.toggle !== "function") return
  const dark = mode === "dark"
  element.classList.toggle("dark", dark)
  element.classList.toggle("light", !dark)
  if (element.dataset) element.dataset.theme = dark ? "dark" : "light"
  if (element.style) element.style.colorScheme = dark ? "dark" : "light"
}

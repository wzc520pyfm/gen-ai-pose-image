export {
  STUDIO_THEME_KEY,
  applyStudioTheme,
  loadStudioTheme,
  normalizeStudioTheme,
  resolveStudioTheme,
  saveStudioTheme,
} from "../shared/studio-theme.mjs"

export type StudioThemePreference = "light" | "dark" | "system"
export type StudioThemeMode = "light" | "dark"

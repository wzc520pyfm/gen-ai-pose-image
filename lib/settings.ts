import { DEFAULT_COMFYUI_URL } from "../shared/comfyui-client.mjs"
import type { AspectRatio, GenerateMode, ProviderId } from "@/lib/types"

export type StudioSettings = {
  engine: "cloud" | "comfyui"
  comfyuiURL: string
  comfyuiToken: string
  provider: ProviderId
  apiKey: string
  baseURL: string
  model: string
  textModel: string
  aspectRatio: AspectRatio
  keepOutfit: boolean
  mode: GenerateMode
  showAdult: boolean
  sensitivePromptOptimize: boolean
}

export const DEFAULT_SETTINGS: StudioSettings = {
  engine: "cloud",
  comfyuiURL: DEFAULT_COMFYUI_URL,
  comfyuiToken: "",
  provider: "gemini",
  apiKey: "",
  baseURL: "",
  model: "gemini-2.5-flash-image",
  textModel: "",
  aspectRatio: "3:4",
  keepOutfit: true,
  mode: "each",
  showAdult: false,
  sensitivePromptOptimize: false,
}

const KEY = "lanpose-settings-v1"

export function loadSettings(): StudioSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<StudioSettings>
    const provider = parsed.provider === "openai" || parsed.provider === "seedream" ? parsed.provider : "gemini"
    const aspect = parsed.aspectRatio
    const aspectRatio = aspect === "1:1" || aspect === "3:4" || aspect === "4:3" || aspect === "9:16" || aspect === "16:9" ? aspect : "3:4"
    return {
      engine: parsed.engine === "comfyui" ? "comfyui" : "cloud",
      comfyuiURL: typeof parsed.comfyuiURL === "string" && parsed.comfyuiURL.trim() ? parsed.comfyuiURL : DEFAULT_COMFYUI_URL,
      comfyuiToken: "",
      provider,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      baseURL: typeof parsed.baseURL === "string" ? parsed.baseURL : "",
      model: typeof parsed.model === "string" && parsed.model.trim() ? parsed.model : DEFAULT_SETTINGS.model,
      textModel: typeof parsed.textModel === "string" ? parsed.textModel : "",
      aspectRatio,
      keepOutfit: parsed.keepOutfit !== false,
      mode: parsed.mode === "sheet" ? "sheet" : "each",
      showAdult: parsed.showAdult === true,
      sensitivePromptOptimize: parsed.sensitivePromptOptimize === true,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: StudioSettings) {
  const stored = { ...settings, comfyuiToken: undefined }
  window.localStorage.setItem(KEY, JSON.stringify(stored))
}

export function modelFor(provider: ProviderId) {
  if (provider === "gemini") return "gemini-2.5-flash-image"
  if (provider === "seedream") return "doubao-seedream-5-0-flash-260915"
  return "gpt-image-1"
}

export function baseURLFor(provider: ProviderId) {
  if (provider === "seedream") return "https://ark.cn-beijing.volces.com/api/v3"
  if (provider === "openai") return "https://api.openai.com/v1"
  return ""
}

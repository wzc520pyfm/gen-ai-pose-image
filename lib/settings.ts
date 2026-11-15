import { DEFAULT_COMFYUI_URL } from "../shared/comfyui-client.mjs"
import { defaultBaseURL, defaultModel } from "../shared/generate.mjs"
import type { ServerProviderStatus } from "../shared/credentials.mjs"
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
  baseURL: defaultBaseURL("gemini"),
  model: defaultModel("gemini"),
  textModel: "",
  aspectRatio: "3:4",
  keepOutfit: true,
  mode: "each",
  showAdult: false,
  sensitivePromptOptimize: false,
}

const KEY = "lanpose-settings-v1"
const SELECTION = `${KEY}:selection`
const COMMON_FIELDS = ["comfyuiURL", "aspectRatio", "keepOutfit", "mode", "showAdult", "sensitivePromptOptimize"] as const
const CLOUD_FIELDS = ["apiKey", "baseURL", "model", "textModel"] as const

type CloudProfile = Pick<StudioSettings, typeof CLOUD_FIELDS[number]>

function cloudKey(provider: ProviderId) {
  return `lanpose-cloud-${provider}-v1`
}

function isProvider(value: unknown): value is ProviderId {
  return value === "openai" || value === "gemini" || value === "seedream"
}

function readValue(key: string): unknown {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}

function readStored(key: string): Partial<StudioSettings> | undefined {
  const value = readValue(key)
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Partial<StudioSettings>
}

// Grouped records from earlier versions provide defaults for fields that have never been edited.
function readFields(scope: string, fields: readonly (keyof StudioSettings)[], saved?: Partial<StudioSettings>) {
  const values: Record<string, unknown> = { ...saved }
  for (const field of fields) {
    const value = readValue(`${scope}:${field}`)
    if (value !== undefined) values[field] = value
  }
  return values as Partial<StudioSettings>
}

// The old form kept one connection even when its active tab changed.
function legacyOwner(stored: Partial<StudioSettings>): ProviderId | undefined {
  if (!CLOUD_FIELDS.some(field => Object.hasOwn(stored, field))) return
  const selected = isProvider(stored.provider) ? stored.provider : "gemini"
  // OpenAI-compatible connections can intentionally point at another vendor's service.
  if (selected === "openai") return selected
  const root = typeof stored.baseURL === "string" ? stored.baseURL.trim().replace(/\/+$/, "") : ""
  if (!root) return selected
  for (const provider of ["gemini", "seedream", "openai"] as const) {
    if (root === defaultBaseURL(provider)) return provider
  }
  if (/\/v1$/i.test(root) && typeof stored.model === "string" && /^(?:gpt-image|chatgpt-image|dall-e)(?:-|$)/i.test(stored.model.trim())) return "openai"
  return selected
}

function cloudProfile(provider: ProviderId, saved?: Partial<CloudProfile>, server?: ServerProviderStatus | null): CloudProfile {
  const defaults = server?.provider === provider ? server : null
  return {
    apiKey: typeof saved?.apiKey === "string" ? saved.apiKey : "",
    baseURL: typeof saved?.baseURL === "string" ? saved.baseURL : defaults?.baseURL || defaultBaseURL(provider),
    model: typeof saved?.model === "string" ? saved.model : defaults?.model || defaultModel(provider),
    textModel: typeof saved?.textModel === "string" ? saved.textModel : "",
  }
}

function loadCloudProfile(provider: ProviderId, stored: Partial<StudioSettings>, server?: ServerProviderStatus | null) {
  const scope = cloudKey(provider)
  const saved = readStored(scope) ?? (legacyOwner(stored) === provider ? stored : undefined)
  return cloudProfile(provider, readFields(scope, CLOUD_FIELDS, saved), server)
}

export function loadSettings(server?: ServerProviderStatus | null, tab?: StudioSettings): StudioSettings {
  const legacy = readStored(KEY) ?? {}
  const stored = readFields(KEY, COMMON_FIELDS, legacy)
  const selection = tab ?? readStored(SELECTION) ?? legacy
  const fallback = isProvider(server?.provider) ? server.provider : DEFAULT_SETTINGS.provider
  const provider = isProvider(selection.provider) ? selection.provider : legacyOwner(legacy) ?? fallback
  const aspect = stored.aspectRatio
  const comfyuiURL = typeof stored.comfyuiURL === "string" && stored.comfyuiURL.trim() ? stored.comfyuiURL : DEFAULT_COMFYUI_URL
  return {
    engine: selection.engine === "comfyui" ? "comfyui" : "cloud",
    comfyuiURL,
    comfyuiToken: tab?.comfyuiURL === comfyuiURL ? tab.comfyuiToken : "",
    provider,
    ...loadCloudProfile(provider, legacy, server),
    aspectRatio: aspect === "1:1" || aspect === "4:3" || aspect === "9:16" || aspect === "16:9" ? aspect : "3:4",
    keepOutfit: stored.keepOutfit !== false,
    mode: stored.mode === "sheet" ? "sheet" : "each",
    showAdult: stored.showAdult === true,
    sensitivePromptOptimize: stored.sensitivePromptOptimize === true,
  }
}

export function isSharedSettingsEdit(key: string | null, provider: ProviderId) {
  return key === null || COMMON_FIELDS.some(field => key === `${KEY}:${field}`)
    || CLOUD_FIELDS.some(field => key === `${cloudKey(provider)}:${field}`)
}

export function selectCloudProvider(settings: StudioSettings, provider: ProviderId, server?: ServerProviderStatus | null): StudioSettings {
  if (settings.provider === provider) return { ...settings, engine: "cloud" }
  return { ...settings, engine: "cloud", provider, ...loadCloudProfile(provider, readStored(KEY) ?? {}, server) }
}

function discardReplacedKey(scope: string) {
  const saved = readStored(scope)
  if (saved && Object.hasOwn(saved, "apiKey") && readValue(`${scope}:apiKey`) !== undefined) {
    delete saved.apiKey
    window.localStorage.setItem(scope, JSON.stringify(saved))
  }
}

function migrateLegacySettings() {
  const stored = readStored(KEY)
  if (!stored) return
  const owner = legacyOwner(stored)
  if (!owner && !Object.hasOwn(stored, "comfyuiToken")) return
  if (owner) {
    const scope = cloudKey(owner)
    if (!readStored(scope)) window.localStorage.setItem(scope, JSON.stringify(cloudProfile(owner, stored)))
    discardReplacedKey(scope)
    if (!isProvider(stored.provider)) stored.provider = owner
    for (const field of CLOUD_FIELDS) delete stored[field]
  }
  delete stored.comfyuiToken
  window.localStorage.setItem(KEY, JSON.stringify(stored))
}

export function saveSettings(current: StudioSettings, edits: Partial<StudioSettings>, server?: ServerProviderStatus | null): StudioSettings {
  const selected = edits.provider ? selectCloudProvider(current, edits.provider, server) : current
  const next = { ...selected, ...edits }
  migrateLegacySettings()
  // A setItem per edited field keeps simultaneous updates in different tabs independent.
  for (const field of COMMON_FIELDS) {
    if (edits[field] !== undefined) window.localStorage.setItem(`${KEY}:${field}`, JSON.stringify(edits[field]))
  }
  const scope = cloudKey(next.provider)
  for (const field of CLOUD_FIELDS) {
    if (edits[field] !== undefined) window.localStorage.setItem(`${scope}:${field}`, JSON.stringify(edits[field]))
  }
  if (edits.apiKey !== undefined) discardReplacedKey(scope)
  if (edits.provider !== undefined || edits.engine !== undefined) {
    window.localStorage.setItem(SELECTION, JSON.stringify({ provider: next.provider, engine: next.engine }))
  }
  return next
}

export const WEAR_MARKER: string

export function stripGhostClauses(userPrompt?: string): string

export function supportsCostumeLayerSplit(provider?: string, model?: string): boolean

export function costumeBeautifyRole(sensitivePromptOptimize?: boolean): string

export function costumeWearPrompt(input?: {
  userPrompt?: string
  adult?: boolean
  sensitivePromptOptimize?: boolean
}): string

export function ensureWearPrompt(prompt?: string, options?: {
  adult?: boolean
  sensitivePromptOptimize?: boolean
}): string

export function costumeLayerPrompt(sensitivePromptOptimize?: boolean): string

export function costumeRemovalPrompt(sensitivePromptOptimize?: boolean): string

export function classifyCostumeLayer(layer?: { name?: string; description?: string }): "keep" | "drop" | "mixed" | "skip" | "unknown"

export function selectGhostLayers(layers?: Array<{ name?: string; description?: string; zIndex?: number; buffer?: Buffer; absolute?: number[] | null; normalized?: number[] | null }>): {
  ok: boolean
  reason: string
  keep: Array<{ name?: string; description?: string; zIndex?: number; buffer?: Buffer; absolute?: number[] | null; normalized?: number[] | null; layerRole: string }>
  erase: Array<{ name?: string; description?: string; zIndex?: number; buffer?: Buffer; absolute?: number[] | null; normalized?: number[] | null; layerRole: string }>
}

export function prepareCostumeLayerImage(image: { buffer: Buffer }): Promise<{ mediaType: string; buffer: Buffer }>

export function compositeGhostLayers(
  baseBuffer: Buffer,
  layers?: Array<{ buffer?: Buffer; zIndex?: number; absolute?: number[] | null; normalized?: number[] | null }>,
  eraseLayers?: Array<{ absolute?: number[] | null; normalized?: number[] | null }>,
): Promise<{ mediaType: string; buffer: Buffer }>

export function generateGhostCostume(input?: {
  provider?: string
  apiKey?: string
  baseURL?: string
  model?: string
  prompt?: string
  aspectRatio?: string
  adult?: boolean
  sensitivePromptOptimize?: boolean
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  generate?: (input: {
    provider?: string
    apiKey?: string
    prompt?: string
    images?: Array<{ mediaType?: string; buffer: Buffer; role?: string }>
    watermark?: boolean
    allowReferenceFallback?: boolean
    timeoutMs?: number
  }) => Promise<{ mediaType?: string; buffer?: Buffer; referencesSent?: boolean; warning?: string; model?: string }>
  decompose?: (input: {
    prompt?: string
    image?: { mediaType?: string; buffer: Buffer }
  }) => Promise<{
    base: { buffer: Buffer }
    layers: Array<{ name?: string; description?: string; zIndex?: number; buffer?: Buffer; absolute?: number[] | null; normalized?: number[] | null }>
  }>
}): Promise<{ mediaType: string; buffer: Buffer; warning?: string; referencesSent?: boolean; model?: string }>

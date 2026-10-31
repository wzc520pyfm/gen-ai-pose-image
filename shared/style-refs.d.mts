export const POSE_STYLE_PATHS: readonly string[]
export const COSTUME_STYLE_PATHS: readonly string[]

export function stylePaths(kind: "pose" | "costume"): readonly string[]

export function loadStyleRefs(kind: "pose" | "costume", deps?: {
  fetchPose?: (relativePath: string) => Promise<{ mediaType: string; buffer: Buffer; role?: string }>
  fetchCostume?: (relativePath: string) => Promise<{ mediaType: string; buffer: Buffer; role?: string }>
  modelImage?: (image: { mediaType: string; buffer: Buffer; role?: string }) => Promise<{ mediaType: string; buffer: Buffer; role?: string }>
}): Promise<Array<{ mediaType: string; buffer: Buffer; role: string }>>

export function generateStyledReference(input: {
  kind?: string
  provider: "gemini" | "openai" | "seedream"
  apiKey: string
  baseURL?: string
  model?: string
  prompt: string
  aspectRatio?: string
  sensitivePromptOptimize?: boolean
  signal?: AbortSignal
  fetchPose?: (relativePath: string) => Promise<{ mediaType: string; buffer: Buffer; role?: string }>
  fetchCostume?: (relativePath: string) => Promise<{ mediaType: string; buffer: Buffer; role?: string }>
  generate?: (input: {
    provider: string
    apiKey: string
    baseURL?: string
    model?: string
    prompt: string
    images: Array<{ mediaType: string; buffer: Buffer; role?: string }>
    aspectRatio?: string
    signal?: AbortSignal
  }) => Promise<{ mediaType: string; buffer: Buffer; referencesSent?: boolean }>
}): Promise<{ mediaType: string; buffer: Buffer; referencesSent?: boolean }>

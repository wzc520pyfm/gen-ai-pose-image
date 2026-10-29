export function defaultModel(provider: "gemini" | "openai"): string
export function defaultBaseURL(provider: "gemini" | "openai"): string
export function openAISize(aspectRatio: string): string
export function assertBaseURL(baseURL: string): string
export function redact(text: unknown, secret?: string): string
export function extractGeminiImage(payload: unknown): { mediaType: string; base64: string }
export function extractOpenAIImage(payload: unknown): { mediaType: string; base64?: string; url?: string }
export function generateImage(input: {
  provider: "gemini" | "openai"
  apiKey: string
  baseURL?: string
  model?: string
  prompt: string
  images: Array<{ mediaType: string; buffer: Buffer; role?: string }>
  aspectRatio: string
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}): Promise<{ mediaType: string; buffer: Buffer; referencesSent: boolean; warning?: string; model: string }>

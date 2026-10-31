export function textModelFor(provider: string, textModel?: string): string
export function beautifyPrompt(input: {
  provider?: string
  apiKey?: string
  baseURL?: string
  textModel?: string
  kind?: "pose" | "costume"
  userPrompt?: string
  adult?: boolean
  sensitivePromptOptimize?: boolean
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}): Promise<{ prompt: string; source: "template" | "model"; notice: string }>

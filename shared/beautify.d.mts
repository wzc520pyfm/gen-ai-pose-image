export function textModelFor(provider: string, model?: string): string
export function beautifyPrompt(input: {
  provider?: string
  apiKey?: string
  baseURL?: string
  model?: string
  kind?: "pose" | "costume"
  userPrompt?: string
  adult?: boolean
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}): Promise<{ prompt: string; source: "template" | "model"; notice: string }>

export type ServerProviderStatus = {
  provider: "gemini" | "openai" | "seedream" | ""
  keyConfigured: boolean
  model: string
  baseURL: string
}

export function sameProviderRoot(provider: string, first: string, second: string): boolean
export function serverProviderStatus(config?: Record<string, unknown>): ServerProviderStatus
export function applyEnvCredentials<T extends Record<string, unknown>>(body: T, config?: Record<string, unknown>): T & {
  apiKey?: string
  provider?: string
  model?: string
  baseURL?: string
}

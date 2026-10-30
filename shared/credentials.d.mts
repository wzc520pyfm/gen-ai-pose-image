export function applyEnvCredentials<T extends Record<string, unknown>>(body: T): T & {
  apiKey?: string
  provider?: string
  model?: string
  baseURL?: string
}

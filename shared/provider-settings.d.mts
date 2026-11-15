export type ProviderModel = { id: string; outputs?: string[] }
export type ModelListResult = { models: ProviderModel[] }
export type ConnectionTestResult = { connected: true; latencyMs: number }
export type ImageTestResult = { model: string; previewBase64: string }

export function runProviderAction(input: unknown, options?: {
  config?: Record<string, unknown>
  signal?: AbortSignal
}): Promise<ModelListResult | ConnectionTestResult | ImageTestResult>

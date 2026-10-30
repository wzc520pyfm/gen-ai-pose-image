import type { AspectRatio, GenerateMode, GeneratedResult, PromptCard, ProviderId } from "../lib/types"

export function poseFileFor(view: { thumb: string; full: string }, size: "thumb" | "full"): string
export function isSafePosePath(relativePath: string): boolean
export function fetchPoseBytes(relativePath: string, fetchImpl?: typeof fetch): Promise<{ mediaType: string; buffer: Buffer; role: string }>
export function loadDefaultCharacterImage(): Promise<{ mediaType: string; buffer: Buffer; role: string }>
export function decodeCharacterImage(input: { mediaType?: string; dataBase64?: string }): { mediaType: string; buffer: Buffer; role: string }
export function planRequest(input?: unknown): {
  engine: "cloud" | "comfyui"
  provider: ProviderId
  apiKey: string
  baseURL: string
  model: string
  aspectRatio: AspectRatio
  mode: GenerateMode
  items: Array<{ viewId: string; title: string; prompt: string }>
  sheetPrompt: string
}
export function runGeneration(input: unknown, deps?: { signal?: AbortSignal }): Promise<{ results: GeneratedResult[] }>
export function promptCards(plan: { mode: GenerateMode; sheetPrompt: string; items: Array<{ viewId: string; title: string; prompt: string }> }): PromptCard[]

import type { ComfyPose } from "./comfyui.mjs"
export const DEFAULT_COMFYUI_URL: string
export type Connection = { url: string; token?: string; signal?: AbortSignal; fetchImpl?: typeof fetch }
export function connectionURL(value?: string): string
export function createComfyClient(options: Connection): { request(path: string, init?: RequestInit): Promise<Response> }
export function checkComfyConnection(options: Connection): Promise<{ available: boolean; workflow: string }>
export function generateComfyTask(input: Connection & { characters: Blob[]; garment?: Blob; poseImage?: Blob; faceImage?: Blob; face?: unknown; pose?: ComfyPose | null; costume?: unknown; aspectRatio?: string; extraPrompt?: string; keepOutfit?: boolean; seed?: number }): Promise<Blob>
export function createSheetCache(options?: { now?: () => number }): { cells(key: string): Map<string, Blob>; delete(key: string): void }

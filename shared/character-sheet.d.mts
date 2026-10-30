export const LAYOUT_SHEET_FILE: string
export const CHARACTER_SHEET_PROMPT: string

export function loadLayoutSheet(deps?: {
  readFile?: (file: string) => Promise<Buffer>
  layoutFile?: string
}): Promise<{ mediaType: string; buffer: Buffer; role: string }>

export function generateCharacterSheet(input: {
  provider: "gemini" | "openai" | "seedream"
  apiKey: string
  baseURL?: string
  model?: string
  image?: { mediaType?: string; dataBase64?: string }
  signal?: AbortSignal
  readFile?: (file: string) => Promise<Buffer>
  layoutFile?: string
  generate?: (input: {
    provider: string
    apiKey: string
    baseURL?: string
    model?: string
    prompt: string
    images: Array<{ mediaType: string; buffer: Buffer; role?: string }>
    aspectRatio?: string
    signal?: AbortSignal
  }) => Promise<{ mediaType: string; buffer: Buffer }>
}): Promise<{ mediaType: string; buffer: Buffer }>

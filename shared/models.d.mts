export type ModelImage = {
  id: string
  mediaType: "image/jpeg"
  dataBase64: string
  role?: "photo" | "sheet"
}

export type SavedModel = {
  id: string
  label: string
  createdAt: number
  updatedAt: number
  lastUsedAt?: number
  images: ModelImage[]
}

export const DEFAULT_MODEL_ID: string

export function createModelId(random?: () => string): string
export function photosOnly(images: ModelImage[]): ModelImage[]
export function identityImage(images: ModelImage[]): ModelImage | null
export function withGeneratedSheet(images: ModelImage[], sheet: ModelImage): ModelImage[]
export function withUploadedSheet(images: ModelImage[], sheet: ModelImage): ModelImage[]
export function syncLibrary(models: SavedModel[], activeId: string | null, images: ModelImage[], now?: number, random?: () => string): {
  models: SavedModel[]
  activeId: string | null
  removedId: string | null
  entry: SavedModel | null
}
export function adoptCurrent(models: SavedModel[], images: ModelImage[], activeId: string | null, now?: number, random?: () => string): {
  models: SavedModel[]
  activeId: string | null
  adopted: boolean
  entry: SavedModel | null
}
export function activateModel(models: SavedModel[], id: string): SavedModel
export function renameModel(models: SavedModel[], id: string, label: string): SavedModel[]
export function deleteFromLibrary(models: SavedModel[], id: string, activeId: string | null): {
  models: SavedModel[]
  activeId: string | null
  cleared: boolean
}
export function markModelUsed(models: SavedModel[], id: string, now?: number): SavedModel[]
export function cycleModelId(entries: Array<{ id: string }>, activeId: string, direction: "prev" | "next"): string
export function switcherEntries(input?: {
  models?: SavedModel[]
  builtinUsed?: Record<string, number>
}): Array<{
  id: string
  label: string
  builtin: boolean
  lastUsedAt: number
  portrait: string
  sheet: string
}>

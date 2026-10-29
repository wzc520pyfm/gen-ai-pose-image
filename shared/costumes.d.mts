export type Costume = {
  id: string
  category: string
  label: string
  keywords: string
  adult: boolean
  thumb: string
  preview: string
  full: string
}

export type CostumeCatalog = {
  version: 1
  source: string
  origin: string
  attribution: string
  total: number
  categories: Array<{ id: string; label: string; count: number; adult: boolean }>
  costumes: Costume[]
}

export function getCostumeCatalog(): CostumeCatalog
export function getCostume(id: string): Costume | undefined
export function searchCostumes(query?: {
  query?: string
  category?: string
  includeAdult?: boolean
  limit?: number
}): Costume[]
export function isSafeCostumePath(relativePath: string): boolean
export function costumeFile(costume: Costume, size: "thumb" | "preview" | "full"): string
export function fetchCostumeBytes(relativePath: string, fetchImpl?: typeof fetch): Promise<{ mediaType: string; buffer: Buffer; role: string }>

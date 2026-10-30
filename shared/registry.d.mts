export type CustomAssetRecord = {
  id: string
  label: string
  keywords: string
  adult: boolean
  source: "upload" | "generated"
  userPrompt: string
  beautifiedPrompt: string
  mediaType: string
  dataBase64: string
  createdAt: number
}

export function resetCustomLibrary(): void
export function replaceCustomLibrary(input?: { poses?: unknown[]; costumes?: unknown[] }): void
export function upsertCustomPose(input: unknown): CustomAssetRecord
export function upsertCustomCostume(input: unknown): CustomAssetRecord
export function removeCustomAsset(id: string): boolean
export function listCustomPoseAssets(): CustomAssetRecord[]
export function listCustomCostumeAssets(): CustomAssetRecord[]
export function getCustomPoseAsset(id: string): CustomAssetRecord | undefined
export function getCustomCostumeAsset(id: string): CustomAssetRecord | undefined

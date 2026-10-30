import type { Catalog, Pose, PoseView } from "../lib/types"

export type ResolvedView = { pose: Pose; view: PoseView }

export function getCatalog(): Catalog
export function getPose(id: string): Pose | undefined
export function getView(id: string): ResolvedView | undefined
export function resolveView(id: string): ResolvedView | undefined
export function searchPoses(query?: {
  query?: string
  systemId?: string
  category?: string
  includeAdult?: boolean
  limit?: number
  custom?: Array<{ id?: string; label?: string; name?: string; adult?: boolean; userPrompt?: string; dataBase64?: string }>
}): Pose[]

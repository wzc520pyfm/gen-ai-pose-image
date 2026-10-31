export function createCustomId(kind: "pose" | "costume", random?: () => string): string
export function isCustomPoseId(id: string): boolean
export function isCustomCostumeId(id: string): boolean
export function fitEdge(width: number, height: number, maxEdge?: number): { width: number; height: number }
export function isStorageHigh(usage: number, quota: number, threshold?: number): boolean
export function missingCustomPoseMessage(id: string): string
export function missingCustomCostumeMessage(id: string): string
export function expandReferencePrompt(input?: { kind?: "pose" | "costume"; userPrompt?: string; adult?: boolean }): string
export function reuseFromHistory(entry: {
  extraPrompt?: string
  costume?: { id?: string; label?: string; keywords?: string } | null
  face?: { id?: string; section?: string; hair?: string; label?: string; keywords?: string } | null
  selection?: Array<{ poseId?: string; viewId?: string; title?: string; angle?: string }>
}): {
  selected: Record<string, string>
  extraPrompt: string
  costume: { id: string; label: string; keywords: string } | null
  face: { id: string; section: string; hair: string; label: string; keywords: string } | null
}

export type ComfyPose = { name: string; angle: string; category: string; system?: string; people: number }
export type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>
export function dimensions(aspect?: string): [number, number]
export function localPrompts(input: { pose?: ComfyPose | null; costume?: unknown; extraPrompt?: string; characterCount?: number; keepOutfit?: boolean }): { outfit: string; scaffold: string; final: string }
export function activeGraph(source: Graph, output: string): Graph
export function buildLocalGraph(input: { files: { characters: string[]; garment?: string; pose?: string }; pose?: ComfyPose | null; costume?: unknown; aspectRatio?: string; seed?: number; extraPrompt?: string; keepOutfit?: boolean; prefix?: string }): Promise<{ graph: Graph; output: string; prompts: ReturnType<typeof localPrompts> }>

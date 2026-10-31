export function composePrompt(input: {
  character: { prompt: string }
  poses: Array<{ name: string; category: string; system: string; angle: string; people: number }>
  extraPrompt?: string
  keepOutfit?: boolean
  mode?: "each" | "sheet"
  costume?: { id: string; keywords: string } | null
  face?: { id: string; section?: string; hair?: string; label?: string } | null
  characterCount?: number
}): string

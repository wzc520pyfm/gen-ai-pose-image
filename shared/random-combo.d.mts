export type RandomPose = {
  id: string
  adult?: boolean
  views: Array<{ id: string; angle?: string }>
}

export type RandomCostume = {
  id: string
  label: string
  keywords: string
  adult?: boolean
}

export function pickRandomCombo(input?: {
  poses?: RandomPose[]
  costumes?: RandomCostume[]
  showAdult?: boolean
  random?: () => number
}): {
  ok: boolean
  message: string
  pose: RandomPose | null
  view: { id: string; angle?: string } | null
  costume: RandomCostume | null
}

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

export type RandomFace = {
  id: string
  section?: string
  hair?: string
  label?: string
  keywords?: string
}

export function pickRandomCombo(input?: {
  poses?: RandomPose[]
  costumes?: RandomCostume[]
  faces?: RandomFace[]
  showAdult?: boolean
  random?: () => number
}): {
  ok: boolean
  message: string
  pose: RandomPose | null
  view: { id: string; angle?: string } | null
  costume: RandomCostume | null
  face: RandomFace | null
}
